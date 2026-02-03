# Tapyrus Token Registry

A TIP-0020 compliant metadata registry for Tapyrus colored coins.

## Overview

This repository manages metadata for colored coins (tokens) issued on the Tapyrus blockchain. Anyone can easily register token metadata using GitHub Issues and GitHub Actions.

## Supported Networks

Based on network IDs defined in TIP-0044:

| Network | Network ID |
|---------|-----------|
| Tapyrus API | `15215628` |
| Tapyrus Testnet | `1939510133` |

## How to Register a Token

1. [Create a new Issue](../../issues/new?template=register-token.yml) in this repository
2. Select the "Token Registration" template
3. Fill in the required information and submit
4. GitHub Actions will automatically validate and register the metadata
5. Upon successful registration, a comment with the metadata URL will be added to the Issue

## Retrieving Metadata

Registered token metadata can be accessed at the following URLs by network ID:

```
# Tapyrus API - Network ID: 15215628
https://chaintope.github.io/tapyrus-token-registry/tokens/15215628/{color_id}.json

# Tapyrus Testnet - Network ID: 1939510133
https://chaintope.github.io/tapyrus-token-registry/tokens/1939510133/{color_id}.json
```

### Registered Token List

View all registered tokens at the [index page](https://chaintope.github.io/tapyrus-token-registry/).

## Metadata Specification

See [TIP-0020](https://github.com/chaintope/tips/blob/main/tip-0020.md) for the token metadata specification.

## Developer Information

### Local Validation

```bash
# Clone the repository
git clone https://github.com/{username}/tapyrus-token-registry.git
cd tapyrus-token-registry

# Install dependencies
npm install

# Update index page
npm run update-index

# Run tests
npm test
```

### Directory Structure

```
tapyrus-token-registry/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── register-token.yml    # Token registration Issue template
│   └── workflows/
│       └── register-token.yml    # Issue processing workflow
├── scripts/
│   ├── register-token.js         # Metadata validation & registration script
│   ├── update-index.js           # Index page update script
│   └── test.js                   # Validation test script
├── docs/                         # GitHub Pages
│   ├── index.html                # Token list page
│   └── tokens/                   # Token metadata storage
│       ├── 15215628/             # Tapyrus API
│       └── 1939510133/           # Tapyrus Testnet
├── package.json
└── README.md
```

## References

- [TIP-0020: Token Metadata Specification](https://github.com/chaintope/tips/blob/main/tip-0020.md)
- [TIP-0044: Tapyrus Network IDs](https://github.com/chaintope/tips/blob/main/tip-0044.md)
- [Tapyrus Core](https://github.com/chaintope/tapyrus-core)

## License

MIT License
