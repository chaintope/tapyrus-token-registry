#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { Metadata, crypto: tCrypto, payments } = require('tapyrusjs-lib');

// Color ID validation pattern: c[123] + 64 hex characters = 66 characters total
const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;

// Payment Base validation pattern: 33 bytes compressed public key (66 hex chars)
const PAYMENT_BASE_PATTERN = /^(02|03)[0-9a-f]{64}$/i;

// Txid validation pattern: 64 hex characters
const TXID_PATTERN = /^[0-9a-f]{64}$/i;

// Network definitions (TIP-0044)
const NETWORKS = {
  'Tapyrus API - Network ID: 15215628': {
    id: '15215628',
    name: 'Tapyrus API',
    label: 'api',
    explorerApi: 'https://explorer.api.tapyrus.chaintope.com/api'
  },
  'Tapyrus Testnet - Network ID: 1939510133': {
    id: '1939510133',
    name: 'Tapyrus Testnet',
    label: 'testnet',
    explorerApi: 'https://testnet-explorer.tapyrus.dev.chaintope.com/api'
  }
};

// Map Color ID prefix to token type
const COLOR_ID_PREFIX_TO_TYPE = {
  'c1': 'reissuable',
  'c2': 'non_reissuable',
  'c3': 'nft'
};

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Parse GitHub Issue form body
 */
function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');

  let currentField = null;
  let currentValue = [];

  for (const line of lines) {
    // Check for field header (### Field Name)
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      // Save previous field
      if (currentField) {
        data[currentField] = currentValue.join('\n').trim();
      }

      // Map field names to keys
      const fieldName = headerMatch[1].trim();
      currentField = mapFieldName(fieldName);
      currentValue = [];
      continue;
    }

    // Skip checkbox lines
    if (line.startsWith('- [')) {
      continue;
    }

    // Accumulate value lines
    if (currentField) {
      currentValue.push(line);
    }
  }

  // Save last field
  if (currentField) {
    data[currentField] = currentValue.join('\n').trim();
  }

  // Clean up empty values and "_No response_"
  for (const key of Object.keys(data)) {
    if (!data[key] || data[key] === '_No response_') {
      delete data[key];
    }
  }

  return data;
}

/**
 * Map field names from Issue template to keys
 */
function mapFieldName(name) {
  const mapping = {
    'Network': 'network',
    'Color ID': 'color_id',
    'Payment Base': 'payment_base',
    'OutPoint Txid (for Non-Reissuable/NFT only)': 'outpoint_txid',
    'OutPoint Index (for Non-Reissuable/NFT only)': 'outpoint_index',
    'Token Metadata (JSON)': 'metadata',
    'Confirmation': 'confirmation'
  };
  return mapping[name] || name.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse network from dropdown label to network info
 */
function parseNetwork(networkLabel) {
  // Direct match
  if (NETWORKS[networkLabel]) {
    return NETWORKS[networkLabel];
  }

  // Try to extract network ID from the label
  const match = networkLabel.match(/Network ID:\s*(\d+)/);
  if (match) {
    const networkId = match[1];
    for (const [label, info] of Object.entries(NETWORKS)) {
      if (info.id === networkId) {
        return info;
      }
    }
  }

  return null;
}

/**
 * Validate basic input fields (before Metadata class validation)
 */
function validateInputFields(data) {
  const errors = [];

  // Required: network
  if (!data.network) {
    errors.push('Network is required');
  } else {
    const networkInfo = parseNetwork(data.network);
    if (!networkInfo) {
      errors.push('Invalid network selected. Please select Tapyrus API or Tapyrus Testnet');
    }
  }

  // Required: color_id
  if (!data.color_id) {
    errors.push('Color ID is required');
  } else if (!COLOR_ID_PATTERN.test(data.color_id)) {
    errors.push('Invalid Color ID format. Must be c1/c2/c3 prefix + 64 hex characters');
  }

  // Required: payment_base
  if (!data.payment_base) {
    errors.push('Payment Base is required');
  } else if (!PAYMENT_BASE_PATTERN.test(data.payment_base)) {
    errors.push('Invalid Payment Base format. Must be 33 bytes compressed public key (66 hex characters starting with 02 or 03)');
  }

  // Required: metadata
  if (!data.metadata) {
    errors.push('Token metadata is required');
  }

  // For c2/c3 tokens, OutPoint is required
  if (data.color_id) {
    const prefix = data.color_id.substring(0, 2).toLowerCase();
    if (prefix === 'c2' || prefix === 'c3') {
      if (!data.outpoint_txid) {
        errors.push('OutPoint Txid is required for Non-Reissuable and NFT tokens');
      } else if (!TXID_PATTERN.test(data.outpoint_txid)) {
        errors.push('Invalid OutPoint Txid format. Must be 64 hex characters');
      }

      if (data.outpoint_index === undefined || data.outpoint_index === '') {
        errors.push('OutPoint Index is required for Non-Reissuable and NFT tokens');
      } else {
        const index = parseInt(data.outpoint_index, 10);
        if (isNaN(index) || index < 0) {
          errors.push('OutPoint Index must be a non-negative integer');
        }
      }
    }
  }

  return errors;
}

/**
 * Parse metadata JSON from issue body
 */
function parseMetadataJson(jsonString) {
  // Remove markdown code block markers if present
  let cleaned = jsonString.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

/**
 * Derive P2PKH scriptPubkey from P2C public key
 */
function deriveP2PKHScriptPubkey(p2cPubkey) {
  const { output } = payments.p2pkh({ pubkey: p2cPubkey });
  return output;
}

/**
 * Verify Color ID for Reissuable (c1) tokens
 */
function verifyReissuableColorId(metadata, paymentBase, expectedColorId) {
  const paymentBaseBuffer = Buffer.from(paymentBase, 'hex');
  const derivedColorIdBuffer = metadata.deriveColorId(paymentBaseBuffer);
  const derivedColorId = derivedColorIdBuffer.toString('hex');

  return {
    match: derivedColorId.toLowerCase() === expectedColorId.toLowerCase(),
    derived: derivedColorId,
    expected: expectedColorId.toLowerCase()
  };
}

/**
 * Verify Color ID for Non-Reissuable (c2) and NFT (c3) tokens
 */
function verifyOutPointColorId(metadata, outPointTxid, outPointIndex, expectedColorId) {
  // Reverse txid for internal byte order (little-endian)
  const txidBuffer = Buffer.from(outPointTxid, 'hex').reverse();
  const outPoint = {
    txid: txidBuffer,
    index: outPointIndex
  };

  const derivedColorIdBuffer = metadata.deriveColorId(undefined, outPoint);
  const derivedColorId = derivedColorIdBuffer.toString('hex');

  return {
    match: derivedColorId.toLowerCase() === expectedColorId.toLowerCase(),
    derived: derivedColorId,
    expected: expectedColorId.toLowerCase()
  };
}

/**
 * Fetch transaction output scriptPubkey from explorer
 */
async function fetchOutPointScriptPubkey(explorerApi, txid, index) {
  const url = `${explorerApi}/tx/${txid}`;
  console.log(`Fetching transaction from: ${url}`);

  const txData = await fetchJson(url);

  if (!txData || !txData.vout || !txData.vout[index]) {
    throw new Error(`Output index ${index} not found in transaction ${txid}`);
  }

  const output = txData.vout[index];
  if (!output.scriptpubkey) {
    throw new Error(`scriptpubkey not found for output ${index} in transaction ${txid}`);
  }

  return Buffer.from(output.scriptpubkey, 'hex');
}

/**
 * Verify OutPoint scriptPubkey matches P2C derived scriptPubkey
 */
async function verifyOutPointScriptPubkey(metadata, paymentBase, explorerApi, txid, index) {
  // Derive P2C public key from Payment Base + Metadata
  const paymentBaseBuffer = Buffer.from(paymentBase, 'hex');
  const p2cPubkey = metadata.p2cPublicKey(paymentBaseBuffer);

  // Derive expected P2PKH scriptPubkey
  const expectedScriptPubkey = deriveP2PKHScriptPubkey(p2cPubkey);

  // Fetch actual scriptPubkey from explorer
  const actualScriptPubkey = await fetchOutPointScriptPubkey(explorerApi, txid, index);

  return {
    match: expectedScriptPubkey.equals(actualScriptPubkey),
    expected: expectedScriptPubkey.toString('hex'),
    actual: actualScriptPubkey.toString('hex'),
    p2cPubkey: p2cPubkey.toString('hex')
  };
}

/**
 * Main execution
 */
async function main() {
  const issueBody = process.env.ISSUE_BODY;

  if (!issueBody) {
    console.error('ISSUE_BODY environment variable is not set');
    process.exit(1);
  }

  console.log('Parsing issue body...');
  const data = parseIssueBody(issueBody);
  console.log('Parsed data:', JSON.stringify(data, null, 2));

  // Parse metadata JSON
  let metadataFields = null;
  if (data.metadata) {
    try {
      metadataFields = parseMetadataJson(data.metadata);
      console.log('Parsed metadata:', JSON.stringify(metadataFields, null, 2));
    } catch (err) {
      const errorMessage = `Invalid JSON format in metadata: ${err.message}`;
      console.error(errorMessage);
      fs.writeFileSync('validation-error.txt', errorMessage);
      process.exit(1);
    }
  }

  console.log('Validating input fields...');
  const inputErrors = validateInputFields(data);

  if (inputErrors.length > 0) {
    const errorMessage = inputErrors.map(e => `- ${e}`).join('\n');
    console.error('Validation errors:\n' + errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  const colorId = data.color_id.toLowerCase();
  const prefix = colorId.substring(0, 2);
  const tokenType = COLOR_ID_PREFIX_TO_TYPE[prefix];
  const networkInfo = parseNetwork(data.network);

  // Add version and tokenType for Metadata class
  const fieldsWithType = {
    version: '1.0',
    tokenType: tokenType,
    ...metadataFields
  };

  // Create Metadata instance (this also validates the metadata)
  let metadata;
  try {
    metadata = new Metadata(fieldsWithType);
  } catch (err) {
    const errorMessage = `Metadata validation error: ${err.message}`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  console.log(`Token type: ${tokenType}`);
  console.log(`Metadata digest: ${metadata.digest().toString('hex')}`);

  // Verify Color ID
  let colorIdVerification;
  if (prefix === 'c1') {
    // Reissuable: verify using Payment Base
    console.log('Verifying Color ID for Reissuable token...');
    colorIdVerification = verifyReissuableColorId(metadata, data.payment_base, colorId);
  } else {
    // Non-Reissuable or NFT: verify using OutPoint
    console.log('Verifying Color ID for Non-Reissuable/NFT token...');
    const outPointIndex = parseInt(data.outpoint_index, 10);
    colorIdVerification = verifyOutPointColorId(metadata, data.outpoint_txid, outPointIndex, colorId);
  }

  if (!colorIdVerification.match) {
    const errorMessage = `Color ID verification failed.\n` +
      `- Expected: ${colorIdVerification.expected}\n` +
      `- Derived:  ${colorIdVerification.derived}\n` +
      `- Metadata digest: ${metadata.digest().toString('hex')}\n\n` +
      `Please ensure the metadata JSON and OutPoint exactly match what was used to derive the Color ID.\n\n` +
      `Canonical form used for derivation:\n${metadata.toCanonical()}`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  console.log('Color ID verified successfully');

  // For c2/c3, also verify the OutPoint scriptPubkey matches P2C derived scriptPubkey
  if (prefix === 'c2' || prefix === 'c3') {
    console.log('Verifying OutPoint scriptPubkey matches P2C derived scriptPubkey...');
    try {
      const scriptVerification = await verifyOutPointScriptPubkey(
        metadata,
        data.payment_base,
        networkInfo.explorerApi,
        data.outpoint_txid,
        parseInt(data.outpoint_index, 10)
      );

      if (!scriptVerification.match) {
        const errorMessage = `OutPoint scriptPubkey verification failed.\n` +
          `- Expected (from P2C): ${scriptVerification.expected}\n` +
          `- Actual (from chain): ${scriptVerification.actual}\n` +
          `- P2C pubkey: ${scriptVerification.p2cPubkey}\n\n` +
          `The OutPoint's scriptPubkey does not match the P2C address derived from Payment Base and Metadata.`;
        console.error(errorMessage);
        fs.writeFileSync('validation-error.txt', errorMessage);
        process.exit(1);
      }

      console.log('OutPoint scriptPubkey verified successfully');
      console.log(`  P2C pubkey: ${scriptVerification.p2cPubkey}`);
    } catch (err) {
      const errorMessage = `Failed to verify OutPoint scriptPubkey: ${err.message}`;
      console.error(errorMessage);
      fs.writeFileSync('validation-error.txt', errorMessage);
      process.exit(1);
    }
  }

  const networkId = networkInfo.id;

  // Check for existing token in network-specific directory
  const tokenDir = path.join('docs', 'tokens', networkId);
  const tokenPath = path.join(tokenDir, `${colorId}.json`);

  // Ensure directory exists
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }

  if (fs.existsSync(tokenPath)) {
    const errorMessage = `Color ID ${colorId} is already registered on ${networkInfo.name} (Network ID: ${networkId})`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  // Write metadata file (preserve original JSON exactly as input)
  const jsonContent = JSON.stringify(metadataFields, null, 2);
  fs.writeFileSync(tokenPath, jsonContent + '\n');
  console.log(`Token metadata written to ${tokenPath}`);

  // Write network info for GitHub Actions
  fs.writeFileSync('token-network.txt', networkId);
  fs.writeFileSync('token-network-name.txt', networkInfo.name);
  fs.writeFileSync('token-color-id.txt', colorId);

  console.log('Registration successful!');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  fs.writeFileSync('validation-error.txt', `Unexpected error: ${err.message}`);
  process.exit(1);
});
