#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Metadata } = require('tapyrusjs-lib');

// Color ID validation pattern: c[123] + 64 hex characters = 66 characters total
const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;

// Payment Base validation pattern: 33 bytes compressed public key (66 hex chars)
const PAYMENT_BASE_PATTERN = /^(02|03)[0-9a-f]{64}$/i;

// Network definitions (TIP-0044)
const NETWORKS = {
  'Tapyrus API - Network ID: 15215628': {
    id: '15215628',
    name: 'Tapyrus API',
    label: 'api'
  },
  'Tapyrus Testnet - Network ID: 1939510133': {
    id: '1939510133',
    name: 'Tapyrus Testnet',
    label: 'testnet'
  }
};

// Map Color ID prefix to token type
const COLOR_ID_PREFIX_TO_TYPE = {
  'c1': 'reissuable',
  'c2': 'non_reissuable',
  'c3': 'nft'
};

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
 * Verify Color ID using tapyrusjs-lib Metadata class
 */
function verifyColorId(metadataFields, paymentBase, expectedColorId) {
  const tokenType = COLOR_ID_PREFIX_TO_TYPE[expectedColorId.substring(0, 2).toLowerCase()];

  // Add version and tokenType for Metadata class
  const fieldsWithType = {
    version: '1.0',
    tokenType: tokenType,
    ...metadataFields
  };

  // Create Metadata instance (this also validates the metadata)
  const metadata = new Metadata(fieldsWithType);

  // Derive Color ID using Payment Base
  const paymentBaseBuffer = Buffer.from(paymentBase, 'hex');
  const derivedColorIdBuffer = metadata.deriveColorId(paymentBaseBuffer);
  const derivedColorId = derivedColorIdBuffer.toString('hex');

  return {
    match: derivedColorId.toLowerCase() === expectedColorId.toLowerCase(),
    derived: derivedColorId,
    expected: expectedColorId.toLowerCase(),
    metadataDigest: metadata.digest().toString('hex'),
    canonical: metadata.toCanonical()
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

  // Verify Color ID using tapyrusjs-lib Metadata class
  console.log('Verifying Color ID with tapyrusjs-lib...');
  let verification;
  try {
    verification = verifyColorId(metadataFields, data.payment_base, data.color_id);
  } catch (err) {
    const errorMessage = `Metadata validation error: ${err.message}`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  if (!verification.match) {
    const errorMessage = `Color ID verification failed.\n` +
      `- Expected: ${verification.expected}\n` +
      `- Derived:  ${verification.derived}\n` +
      `- Metadata digest: ${verification.metadataDigest}\n\n` +
      `Please ensure the metadata JSON exactly matches what was used to derive the Color ID.\n\n` +
      `Canonical form used for derivation:\n${verification.canonical}`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  console.log('Color ID verified successfully');
  console.log(`  Metadata digest: ${verification.metadataDigest}`);

  const colorId = data.color_id.toLowerCase();
  const networkInfo = parseNetwork(data.network);
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