#!/usr/bin/env node

/**
 * Test script for token registration validation
 */

const { Metadata } = require('tapyrusjs-lib');

const COLOR_ID_PATTERN = /^c[123][0-9a-f]{64}$/i;
const PAYMENT_BASE_PATTERN = /^(02|03)[0-9a-f]{64}$/i;

const VALID_COLOR_IDS = [
  'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c2a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c3a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c1AABBCCDD1122334455667788990011AABBCCDD1122334455667788990011AABB',
];

const INVALID_COLOR_IDS = [
  '',
  'c0a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c4a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'c1a1b2c3d4e5',
  'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  'c1g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'a1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
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

console.log('\n=== Payment Base Validation Tests ===\n');

const validPaymentBases = [
  '02a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  '03a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  '02AABBCCDD1122334455667788990011AABBCCDD1122334455667788990011AABB',
];

const invalidPaymentBases = [
  '',
  '04a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // uncompressed prefix
  '02a1b2c3d4e5f6', // too short
  '00a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // invalid prefix
];

console.log('Valid Payment Bases:');
for (const pb of validPaymentBases) {
  test(`  ${pb.substring(0, 20)}...`, PAYMENT_BASE_PATTERN.test(pb));
}

console.log('\nInvalid Payment Bases:');
for (const pb of invalidPaymentBases) {
  const display = pb ? `${pb.substring(0, 20)}...` : '(empty)';
  test(`  ${display}`, !PAYMENT_BASE_PATTERN.test(pb));
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

const NETWORKS = {
  'Tapyrus API - Network ID: 15215628': { id: '15215628', name: 'Tapyrus API' },
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

console.log('\n=== tapyrusjs-lib Metadata Class Tests ===\n');

// Test with a known payment base (secp256k1 generator point G)
const testPaymentBase = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const testMetadataFields = {
  version: '1.0',
  name: 'Test',
  symbol: 'TST',
  tokenType: 'reissuable'
};

try {
  const metadata = new Metadata(testMetadataFields);
  test('Metadata class instantiation', true);

  const digest = metadata.digest();
  test('Metadata digest computation', digest.length === 32);

  const canonical = metadata.toCanonical();
  test('Metadata canonical form', typeof canonical === 'string' && canonical.includes('"name":"Test"'));

  const paymentBaseBuffer = Buffer.from(testPaymentBase, 'hex');
  const colorId = metadata.deriveColorId(paymentBaseBuffer);
  test('Color ID derivation', colorId.length === 33);
  test('Color ID prefix (c1)', colorId[0] === 0xc1);

  const colorIdHex = colorId.toString('hex');
  test('Color ID format', COLOR_ID_PATTERN.test(colorIdHex));

  console.log(`  Test metadata digest: ${digest.toString('hex')}`);
  console.log(`  Test canonical form: ${canonical}`);
  console.log(`  Test Color ID: ${colorIdHex}`);
} catch (e) {
  test('Metadata class tests', false);
  console.error('  Error:', e.message);
}

console.log('\n=== Metadata Validation Tests ===\n');

// Test invalid metadata
const invalidMetadataTests = [
  { fields: { version: '2.0', name: 'Test', symbol: 'TST', tokenType: 'reissuable' }, error: 'version' },
  { fields: { version: '1.0', name: '', symbol: 'TST', tokenType: 'reissuable' }, error: 'name required' },
  { fields: { version: '1.0', name: 'Test', symbol: '', tokenType: 'reissuable' }, error: 'symbol required' },
  { fields: { version: '1.0', name: 'A'.repeat(65), symbol: 'TST', tokenType: 'reissuable' }, error: 'name too long' },
  { fields: { version: '1.0', name: 'Test', symbol: 'TOOLONGSYMBOL', tokenType: 'reissuable' }, error: 'symbol too long' },
];

for (const testCase of invalidMetadataTests) {
  try {
    new Metadata(testCase.fields);
    test(`  Invalid metadata (${testCase.error}) rejected`, false);
  } catch (e) {
    test(`  Invalid metadata (${testCase.error}) rejected`, true);
  }
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

Tapyrus API - Network ID: 15215628

### Color ID

c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

### Payment Base

0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798

### Token Metadata (JSON)

\`\`\`json
{
  "name": "Test Token",
  "symbol": "TST",
  "decimals": 8
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
    'Payment Base': 'payment_base',
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

test('Parsed network', parsed.network === 'Tapyrus API - Network ID: 15215628');
test('Parsed color_id', parsed.color_id === 'c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
test('Parsed payment_base', parsed.payment_base === '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
test('Parsed metadata (exists)', !!parsed.metadata);

// Parse and validate metadata JSON
try {
  const metadataFields = parseMetadataJson(parsed.metadata);
  test('Metadata name', metadataFields.name === 'Test Token');
  test('Metadata symbol', metadataFields.symbol === 'TST');
  test('Metadata decimals', metadataFields.decimals === 8);
} catch (e) {
  test('Metadata JSON parsing', false);
}

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);