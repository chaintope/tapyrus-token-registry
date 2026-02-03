#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color ID validation pattern: c[123] + 64 hex characters = 66 characters total
const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;

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
function validateMetadata(data, metadata) {
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

  // Required: metadata
  if (!data.metadata) {
    errors.push('Token metadata is required');
  }

  // Validate metadata JSON structure
  if (metadata) {
    // Required fields
    if (!metadata.name) {
      errors.push('Metadata: "name" field is required');
    } else if (metadata.name.length > LIMITS.name) {
      errors.push(`Metadata: "name" must be ${LIMITS.name} characters or less`);
    }

    if (!metadata.symbol) {
      errors.push('Metadata: "symbol" field is required');
    } else if (metadata.symbol.length > LIMITS.symbol) {
      errors.push(`Metadata: "symbol" must be ${LIMITS.symbol} characters or less`);
    }

    // Optional field validations
    if (metadata.decimals !== undefined) {
      if (!Number.isInteger(metadata.decimals) || metadata.decimals < 0 || metadata.decimals > 18) {
        errors.push('Metadata: "decimals" must be an integer between 0 and 18');
      }
    }

    if (metadata.description && metadata.description.length > LIMITS.description) {
      errors.push(`Metadata: "description" must be ${LIMITS.description} characters or less`);
    }

    // URL validations
    const urlFields = ['icon', 'website', 'terms', 'image', 'animation_url', 'external_url'];
    for (const field of urlFields) {
      if (metadata[field] && !isValidHttpsUrl(metadata[field])) {
        errors.push(`Metadata: "${field}" must be a valid HTTPS URL`);
      }
    }

    // Issuer URL validation
    if (metadata.issuer && metadata.issuer.url && !isValidHttpsUrl(metadata.issuer.url)) {
      errors.push('Metadata: "issuer.url" must be a valid HTTPS URL');
    }

    // Issuer email validation
    if (metadata.issuer && metadata.issuer.email && !isValidEmail(metadata.issuer.email)) {
      errors.push('Metadata: "issuer.email" must be a valid email address');
    }

    // Attributes validation (must be array)
    if (metadata.attributes !== undefined && !Array.isArray(metadata.attributes)) {
      errors.push('Metadata: "attributes" must be an array');
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
  let metadata = null;
  if (data.metadata) {
    try {
      metadata = parseMetadataJson(data.metadata);
      console.log('Parsed metadata:', JSON.stringify(metadata, null, 2));
    } catch (err) {
      const errorMessage = `Invalid JSON format in metadata: ${err.message}`;
      console.error(errorMessage);
      fs.writeFileSync('validation-error.txt', errorMessage);
      process.exit(1);
    }
  }

  console.log('Validating metadata...');
  const errors = validateMetadata(data, metadata);

  if (errors.length > 0) {
    const errorMessage = errors.map(e => `- ${e}`).join('\n');
    console.error('Validation errors:\n' + errorMessage);

    // Write error to file for GitHub Actions
    fs.writeFileSync('validation-error.txt', errorMessage);
    process.exit(1);
  }

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

  // Write metadata file (preserve original JSON structure)
  const jsonContent = JSON.stringify(metadata, null, 2);
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
