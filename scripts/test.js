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

console.log('\n=== Issue Body Parsing Test ===\n');

const sampleIssueBody = `### Network

Tapyrus API (prod) - Network ID: 15215628

### Color ID

c1a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

### Token Name

Test Token

### Symbol

TST

### Decimals

8

### Description

This is a test token

### Icon URL

https://example.com/icon.png

### Website

https://example.com

### Terms of Service URL

_No response_

### Issuer Name

Test Issuer

### Issuer URL

https://issuer.example.com

### Issuer Email

issuer@example.com

### Image URL

_No response_

### Animation URL

_No response_

### External URL

_No response_

### Attributes (JSON format)

_No response_

### Confirmation

- [X] I am the issuer of this token or have permission from the issuer to register
- [X] The information provided is accurate and does not contain false information`;

function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');

  let currentField = null;
  let currentValue = [];

  const fieldMapping = {
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
test('Parsed name', parsed.name === 'Test Token');
test('Parsed symbol', parsed.symbol === 'TST');
test('Parsed decimals', parsed.decimals === '8');
test('Parsed description', parsed.description === 'This is a test token');
test('Parsed icon', parsed.icon === 'https://example.com/icon.png');
test('Parsed website', parsed.website === 'https://example.com');
test('No terms (was _No response_)', !parsed.terms);
test('Parsed issuer_name', parsed.issuer_name === 'Test Issuer');
test('Parsed issuer_url', parsed.issuer_url === 'https://issuer.example.com');
test('Parsed issuer_email', parsed.issuer_email === 'issuer@example.com');

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
