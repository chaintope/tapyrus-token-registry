#!/usr/bin/env node

/**
 * Test script for token registration validation
 */

const fs = require('fs');
const path = require('path');

const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;

const VALID_COLOR_IDS = [
  'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c2a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c3a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c1AABBCCDD1122334455667788990011AABBCCDD1122334455667788990011AABB',
];

const INVALID_COLOR_IDS = [
  '',
  'c0a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // c0 is invalid
  'c4a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // c4 is invalid
  'c1a1b2c3d4e5', // too short
  'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', // too long
  'c1g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // invalid hex (g)
  'a1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // no c prefix
];

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
}

console.log('=== Color ID Validation Tests ===\n');

console.log('Valid Color IDs:');
for (const id of VALID_COLOR_IDS) {
  test(`  ${id.substring(0, 20)}...`, COLOR_ID_PATTERN.test(id));
}

console.log('\nInvalid Color IDs:');
for (const id of INVALID_COLOR_IDS) {
  const display = id ? `${id.substring(0, 20)}...` : '(empty)';
  test(`  ${display}`, !COLOR_ID_PATTERN.test(id));
}

console.log('\n=== URL Validation Tests ===\n');

function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const validUrls = [
  'https://example.com',
  'https://example.com/path/to/file.png',
  'https://sub.domain.example.com',
];

const invalidUrls = [
  'http://example.com',
  'ftp://example.com',
  'example.com',
  'not a url',
  '',
];

console.log('Valid HTTPS URLs:');
for (const url of validUrls) {
  test(`  ${url}`, isValidHttpsUrl(url));
}

console.log('\nInvalid URLs:');
for (const url of invalidUrls) {
  const display = url || '(empty)';
  test(`  ${display}`, !isValidHttpsUrl(url));
}

console.log('\n=== Email Validation Tests ===\n');

function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

const validEmails = [
  'test@example.com',
  'user.name@domain.co.jp',
  'a@b.c',
];

const invalidEmails = [
  'not-an-email',
  '@example.com',
  'user@',
  'user @example.com',
  '',
];

console.log('Valid Emails:');
for (const email of validEmails) {
  test(`  ${email}`, isValidEmail(email));
}

console.log('\nInvalid Emails:');
for (const email of invalidEmails) {
  const display = email || '(empty)';
  test(`  ${display}`, !isValidEmail(email));
}

console.log('\n=== Network Validation Tests (TIP-0044) ===\n');

// Network definitions from TIP-0044
const NETWORKS = {
  'Tapyrus API (prod) - Network ID: 15215628': { id: '15215628', name: 'Tapyrus API' },
  'Tapyrus Testnet - Network ID: 1939510133': { id: '1939510133', name: 'Tapyrus Testnet' }
};

function parseNetwork(label) {
  if (NETWORKS[label]) return NETWORKS[label];
  const match = label.match(/Network ID:\s*(\d+)/);
  if (match) {
    for (const [key, info] of Object.entries(NETWORKS)) {
      if (info.id === match[1]) return info;
    }
  }
  return null;
}

console.log('Valid Network Labels:');
for (const label of Object.keys(NETWORKS)) {
  const info = parseNetwork(label);
  test(`  ${label.substring(0, 30)}...`, info !== null && info.id !== undefined);
}

console.log('\nInvalid Network Labels:');
const invalidNetworks = ['', 'mainnet', 'testnet', 'devnet', 'Network ID: 999'];
for (const network of invalidNetworks) {
  const display = network || '(empty)';
  test(`  ${display}`, parseNetwork(network) === null);
}

console.log('\n=== JSON Metadata Parsing Tests ===\n');

function parseMetadataJson(jsonString) {
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

const validJsonInputs = [
  '{"name": "Test", "symbol": "TST"}',
  '```json\n{"name": "Test", "symbol": "TST"}\n```',
  '```\n{"name": "Test", "symbol": "TST"}\n```',
];

console.log('Valid JSON inputs:');
for (const input of validJsonInputs) {
  try {
    const result = parseMetadataJson(input);
    test(`  Parse JSON (${input.substring(0, 20)}...)`, result.name === 'Test' && result.symbol === 'TST');
  } catch (e) {
    test(`  Parse JSON (${input.substring(0, 20)}...)`, false);
  }
}

console.log('\n=== Issue Body Parsing Test ===\n');

const sampleIssueBody = `### Network

Tapyrus API (prod) - Network ID: 15215628

### Color ID

c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

### Token Metadata (JSON)

\`\`\`json
{
  "name": "Test Token",
  "symbol": "TST",
  "decimals": 8,
  "description": "This is a test token",
  "icon": "https://example.com/icon.png",
  "website": "https://example.com"
}
\`\`\`

### Confirmation

- [X] I am the issuer of this token or have permission from the issuer to register
- [X] The provided metadata matches what was used to derive the Color ID
- [X] The information provided is accurate and does not contain false information`;

function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');

  let currentField = null;
  let currentValue = [];

  const fieldMapping = {
    'Network': 'network',
    'Color ID': 'color_id',
    'Token Metadata (JSON)': 'metadata',
    'Confirmation': 'confirmation'
  };

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      if (currentField) {
        data[currentField] = currentValue.join('\n').trim();
      }
      const fieldName = headerMatch[1].trim();
      currentField = fieldMapping[fieldName] || fieldName.toLowerCase().replace(/\s+/g, '_');
      currentValue = [];
      continue;
    }

    if (line.startsWith('- [')) {
      continue;
    }

    if (currentField) {
      currentValue.push(line);
    }
  }

  if (currentField) {
    data[currentField] = currentValue.join('\n').trim();
  }

  for (const key of Object.keys(data)) {
    if (!data[key] || data[key] === '_No response_') {
      delete data[key];
    }
  }

  return data;
}

const parsed = parseIssueBody(sampleIssueBody);

test('Parsed network', parsed.network === 'Tapyrus API (prod) - Network ID: 15215628');
test('Parsed color_id', parsed.color_id === 'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
test('Parsed metadata (exists)', !!parsed.metadata);

// Parse and validate metadata JSON
try {
  const metadata = parseMetadataJson(parsed.metadata);
  test('Metadata name', metadata.name === 'Test Token');
  test('Metadata symbol', metadata.symbol === 'TST');
  test('Metadata decimals', metadata.decimals === 8);
  test('Metadata description', metadata.description === 'This is a test token');
  test('Metadata icon', metadata.icon === 'https://example.com/icon.png');
  test('Metadata website', metadata.website === 'https://example.com');
} catch (e) {
  test('Metadata JSON parsing', false);
}

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
