#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TOKENS_DIR = 'docs/tokens';
const INDEX_FILE = 'docs/index.html';

// Network definitions (TIP-0044)
const NETWORKS = [
  { id: '15215628', name: 'Tapyrus API', label: 'api' },
  { id: '1939510133', name: 'Tapyrus Testnet', label: 'testnet' }
];

/**
 * Read all token metadata files from all networks
 */
function readTokens() {
  const tokensByNetwork = {};

  for (const network of NETWORKS) {
    tokensByNetwork[network.id] = [];
    const networkDir = path.join(TOKENS_DIR, network.id);

    if (!fs.existsSync(networkDir)) {
      continue;
    }

    const files = fs.readdirSync(networkDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(networkDir, file), 'utf8');
        const metadata = JSON.parse(content);
        const colorId = file.replace('.json', '');
        tokensByNetwork[network.id].push({
          color_id: colorId,
          network_id: network.id,
          ...metadata
        });
      } catch (err) {
        console.error(`Error reading ${network.id}/${file}:`, err.message);
      }
    }

    // Sort by name
    tokensByNetwork[network.id].sort((a, b) => a.name.localeCompare(b.name));
  }

  return tokensByNetwork;
}

/**
 * Generate HTML for token table rows
 */
function generateTokenRows(tokens, networkId) {
  if (tokens.length === 0) {
    return `<tr><td colspan="6" class="empty-message">No tokens registered</td></tr>`;
  }

  return tokens.map(token => {
    const typeLabel = {
      'reissuable': 'Reissuable',
      'non-reissuable': 'Non-Reissuable',
      'nft': 'NFT'
    }[token.token_type] || token.token_type;

    const typeClass = {
      'reissuable': 'type-reissuable',
      'non-reissuable': 'type-non-reissuable',
      'nft': 'type-nft'
    }[token.token_type] || '';

    const icon = token.icon
      ? `<img src="${escapeHtml(token.icon)}" alt="${escapeHtml(token.name)}" class="token-icon" onerror="this.style.display='none'">`
      : '<div class="token-icon-placeholder"></div>';

    const website = token.website
      ? `<a href="${escapeHtml(token.website)}" target="_blank" rel="noopener">Website</a>`
      : '';

    return `
      <tr>
        <td class="token-info">
          ${icon}
          <div class="token-details">
            <strong>${escapeHtml(token.name)}</strong>
            <span class="token-symbol">${escapeHtml(token.symbol)}</span>
          </div>
        </td>
        <td><code class="color-id">${escapeHtml(token.color_id)}</code></td>
        <td><span class="token-type ${typeClass}">${typeLabel}</span></td>
        <td>${token.decimals !== undefined ? token.decimals : 0}</td>
        <td>${website}</td>
        <td>
          <a href="tokens/${networkId}/${escapeHtml(token.color_id)}.json" target="_blank">JSON</a>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Generate HTML for the index page
 */
function generateHtml(tokensByNetwork) {
  const prodTokens = tokensByNetwork['15215628'] || [];
  const testnetTokens = tokensByNetwork['1939510133'] || [];
  const totalTokens = prodTokens.length + testnetTokens.length;

  const prodRows = generateTokenRows(prodTokens, '15215628');
  const testnetRows = generateTokenRows(testnetTokens, '1939510133');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tapyrus Token Registry</title>
  <style>
    :root {
      --primary-color: #2563eb;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --text-color: #1e293b;
      --text-secondary: #64748b;
      --border-color: #e2e8f0;
      --type-reissuable: #10b981;
      --type-non-reissuable: #f59e0b;
      --type-nft: #8b5cf6;
      --prod-color: #059669;
      --testnet-color: #d97706;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
    }

    .card {
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      margin-bottom: 2rem;
    }

    .card-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .network-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .network-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .network-id {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-family: monospace;
    }

    .network-prod {
      background: #d1fae5;
      color: var(--prod-color);
    }

    .network-testnet {
      background: #fef3c7;
      color: var(--testnet-color);
    }

    .token-count {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .stats {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .stat-item {
      background: var(--card-bg);
      padding: 1rem 2rem;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      background: var(--bg-color);
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }

    tr:hover {
      background: var(--bg-color);
    }

    .token-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .token-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .token-icon-placeholder {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--border-color);
    }

    .token-details {
      display: flex;
      flex-direction: column;
    }

    .token-symbol {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .color-id {
      font-size: 0.75rem;
      background: var(--bg-color);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      word-break: break-all;
      max-width: 200px;
      display: inline-block;
    }

    .token-type {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .type-reissuable {
      background: #d1fae5;
      color: var(--type-reissuable);
    }

    .type-non-reissuable {
      background: #fef3c7;
      color: var(--type-non-reissuable);
    }

    .type-nft {
      background: #ede9fe;
      color: var(--type-nft);
    }

    a {
      color: var(--primary-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .empty-message {
      text-align: center;
      color: var(--text-secondary);
      padding: 3rem 1rem;
    }

    footer {
      text-align: center;
      margin-top: 2rem;
      padding: 1rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    footer a {
      color: var(--text-secondary);
    }

    @media (max-width: 768px) {
      .color-id {
        max-width: 120px;
      }

      th, td {
        padding: 0.75rem 0.5rem;
        font-size: 0.875rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Tapyrus Token Registry</h1>
      <p class="subtitle"><a href="https://github.com/chaintope/tips/blob/main/tip-0020.md" target="_blank">TIP-0020</a> Compliant Colored Coin Metadata Registry</p>
    </header>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${totalTokens}</div>
        <div class="stat-label">Registered</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${prodTokens.length}</div>
        <div class="stat-label">Tapyrus API</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${testnetTokens.length}</div>
        <div class="stat-label">Testnet</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="network-info">
          <h2>
            <span class="network-badge network-prod">Tapyrus API</span>
          </h2>
          <span class="network-id">Network ID: 15215628</span>
        </div>
        <span class="token-count">${prodTokens.length} registered</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Color ID</th>
            <th>Type</th>
            <th>Decimals</th>
            <th>Website</th>
            <th>Metadata</th>
          </tr>
        </thead>
        <tbody>
          ${prodRows}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="network-info">
          <h2>
            <span class="network-badge network-testnet">Tapyrus Testnet</span>
          </h2>
          <span class="network-id">Network ID: 1939510133</span>
        </div>
        <span class="token-count">${testnetTokens.length} registered</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Color ID</th>
            <th>Type</th>
            <th>Decimals</th>
            <th>Website</th>
            <th>Metadata</th>
          </tr>
        </thead>
        <tbody>
          ${testnetRows}
        </tbody>
      </table>
    </div>

    <footer>
      <p>
        <a href="https://github.com/chaintope/tapyrus-core" target="_blank">Tapyrus</a> |
        <a href="https://github.com/chaintope/tips/blob/main/tip-0020.md" target="_blank">TIP-0020</a> |
        <a href="https://github.com/chaintope/tips/blob/main/tip-0044.md" target="_blank">TIP-0044</a>
      </p>
      <p>Last updated: ${new Date().toISOString().split('T')[0]}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Main execution
 */
function main() {
  console.log('Reading token metadata...');
  const tokensByNetwork = readTokens();
  console.log(`Found ${(tokensByNetwork['15215628'] || []).length} Tapyrus API tokens`);
  console.log(`Found ${(tokensByNetwork['1939510133'] || []).length} Testnet tokens`);

  console.log('Generating index.html...');
  const html = generateHtml(tokensByNetwork);

  fs.writeFileSync(INDEX_FILE, html);
  console.log(`Updated ${INDEX_FILE}`);
}

main();
