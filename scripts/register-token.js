#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color ID validation pattern: c[123] + 64 hex characters = 66 characters total
const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;

// Token type mapping
const TOKEN_TYPES = {
  c1: 'reissuable',
  c2: 'non-reissuable',
  c3: 'nft'
};

// Network definitions (TIP-0044)
const NETWORKS = {
  'Tapyrus API (prod) - Network ID: 15215628': {
    id: '15215628',
    name: 'Tapyrus API',
    label: 'prod'
  },
  'Tapyrus Testnet - Network ID: 1939510133': {
    id: '1939510133',
    name: 'Tapyrus Testnet',
    label: 'testnet'
  }
};

const VALID_NETWORK_IDS = ['15215628', '1939510133'];

// Validation limits
const LIMITS = {
  name: 64,
  symbol: 12,
  description: 256
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

    // Skip checkbox lines and empty confirmation sections
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
 * Map field names from Issue template to metadata keys
 */
function mapFieldName(name) {
  const mapping = {
    'Network': 'network',
    'Color ID': 'color_id',
    'Token Name': 'name',
    'Symbol': 'symbol',
    'Decimals': 'decimals',
    'Description': 'description',
    'Icon URL': 'icon',
    'Website': 'website',
    'Terms of Service URL': 'terms',
    'Issuer Name': 'issuer_name',
    'Issuer URL': 'issuer_url',
    'Issuer Email': 'issuer_email',
    'Image URL': 'image',
    'Animation URL': 'animation_url',
    'External URL': 'external_url',
    'Attributes (JSON format)': 'attributes',
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
 * Validate URL format (HTTPS required)
 */
function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate token metadata
 */
function validateMetadata(data) {
  const errors = [];

  // Required: network
  if (!data.network) {
    errors.push('Network is required');
  } else {
    const networkInfo = parseNetwork(data.network);
    if (!networkInfo) {
      errors.push('Invalid network selected. Please select Tapyrus API (prod) or Tapyrus Testnet');
    }
  }

  // Required: color_id
  if (!data.color_id) {
    errors.push('Color ID is required');
  } else if (!COLOR_ID_PATTERN.test(data.color_id)) {
    errors.push('Invalid Color ID format. Must be c1/c2/c3 prefix + 64 hex characters');
  }

  // Required: name
  if (!data.name) {
    errors.push('Token name is required');
  } else if (data.name.length > LIMITS.name) {
    errors.push(`Token name must be ${LIMITS.name} characters or less`);
  }

  // Required: symbol
  if (!data.symbol) {
    errors.push('Symbol is required');
  } else if (data.symbol.length > LIMITS.symbol) {
    errors.push(`Symbol must be ${LIMITS.symbol} characters or less`);
  }

  // Optional: decimals
  if (data.decimals !== undefined) {
    const decimals = parseInt(data.decimals, 10);
    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      errors.push('Decimals must be an integer between 0 and 18');
    }
  }

  // Optional: description
  if (data.description && data.description.length > LIMITS.description) {
    errors.push(`Description must be ${LIMITS.description} characters or less`);
  }

  // URL validations
  const urlFields = ['icon', 'website', 'terms', 'issuer_url', 'image', 'animation_url', 'external_url'];
  for (const field of urlFields) {
    if (data[field] && !isValidHttpsUrl(data[field])) {
      errors.push(`${field} must be a valid HTTPS URL`);
    }
  }

  // Email validation
  if (data.issuer_email && !isValidEmail(data.issuer_email)) {
    errors.push('Invalid issuer email format');
  }

  // Attributes validation (JSON format)
  if (data.attributes) {
    try {
      const parsed = JSON.parse(data.attributes);
      if (!Array.isArray(parsed)) {
        errors.push('Attributes must be a JSON array');
      }
    } catch {
      errors.push('Invalid JSON format for attributes');
    }
  }

  return errors;
}

/**
 * Build metadata object following TIP-0020
 */
function buildMetadata(data) {
  const colorIdPrefix = data.color_id.substring(0, 2).toLowerCase();
  const tokenType = TOKEN_TYPES[colorIdPrefix];

  const metadata = {
    version: '1.0',
    name: data.name,
    symbol: data.symbol
  };

  // Add optional fields in specific order for consistency
  if (data.decimals !== undefined) {
    metadata.decimals = parseInt(data.decimals, 10);
  } else {
    metadata.decimals = 0;
  }

  if (data.description) {
    metadata.description = data.description;
  }

  if (data.icon) {
    metadata.icon = data.icon;
  }

  if (data.website) {
    metadata.website = data.website;
  }

  if (data.terms) {
    metadata.terms = data.terms;
  }

  // Issuer information
  if (data.issuer_name || data.issuer_url || data.issuer_email) {
    metadata.issuer = {};
    if (data.issuer_name) metadata.issuer.name = data.issuer_name;
    if (data.issuer_url) metadata.issuer.url = data.issuer_url;
    if (data.issuer_email) metadata.issuer.email = data.issuer_email;
  }

  // Token type
  metadata.token_type = tokenType;

  // NFT extensions (only for c3 tokens)
  if (colorIdPrefix === 'c3') {
    if (data.image) metadata.image = data.image;
    if (data.animation_url) metadata.animation_url = data.animation_url;
    if (data.external_url) metadata.external_url = data.external_url;
    if (data.attributes) {
      metadata.attributes = JSON.parse(data.attributes);
    }
  }

  return metadata;
}

/**
 * Serialize JSON following RFC 8785 (JCS - JSON Canonicalization Scheme)
 * Keys are sorted lexicographically
 */
function canonicalJsonStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort(), 2);
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

  console.log('Validating metadata...');
  const errors = validateMetadata(data);

  if (errors.length > 0) {
    const errorMessage = errors.map(e => `- ${e}`).join('\n');
    console.error('Validation errors:\n' + errorMessage);

    // Write error to file for GitHub Actions
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  console.log('Building metadata...');
  const metadata = buildMetadata(data);
  const colorId = data.color_id.toLowerCase();
  const networkInfo = parseNetwork(data.network);
  const networkId = networkInfo.id;

  // Check for existing token in network-specific directory
  const tokenPath = path.join('docs', 'tokens', networkId, `${colorId}.json`);
  if (fs.existsSync(tokenPath)) {
    const errorMessage = `Color ID ${colorId} is already registered on ${networkInfo.name} (Network ID: ${networkId})`;
    console.error(errorMessage);
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

  // Write metadata file
  const jsonContent = canonicalJsonStringify(metadata);
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
