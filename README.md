# ERC-8004 Trustless Agents on Sui

A decentralized identity and reputation system for AI agents implementing the ERC-8004 standard on Sui blockchain with Walrus decentralized storage.

## Overview

agent8004 enables trustless verification of AI agents through blockchain-based identities and immutable reputation tracking. Agents register with 8004 compliant metadata stored on Walrus, users provide verifiable feedback, and all interactions are recorded on-chain with cryptographic verification.

**First complete ERC-8004 implementation on Sui.**

## Core Components

### Smart Contracts (Sui Move)

**1. Identity Registry** (`identity_registry.move`)
- Registers agents with unique on-chain IDs
- Stores agent metadata: name, description, image, token URI
- Manages endpoint configurations (A2A, MCP, OASF protocols)
- Enables metadata updates while preserving identity

**2. Reputation Registry** (`reputation_registry.move`)
- Records feedback with scores (0-100) and detailed reviews
- Stores feedback on Walrus with SHA-256 hash verification
- Calculates aggregate reputation metrics
- Provides transparent, immutable history

**3. Validation Registry** (`validation_registry.move`)
- Handles cryptographic proofs and attestations
- Supports validator delegation and trust mechanisms
- Enables third-party verification

### Frontend (Next.js + TypeScript)

**Agent Marketplace** - Browse and search registered agents with complete metadata

**Agent Registration** - Register new agents with simple or advanced modes, upload images to Walrus

**Give Feedback** - Submit verified feedback stored on Walrus with on-chain hash proof

**Agent Details** - View complete agent information, reputation history, and endpoints

**Set Metadata** - Update agent metadata and add endpoints dynamically

### Walrus Integration

- All metadata stored as ERC-8004 compliant JSON on Walrus
- Images uploaded to Walrus with `walrus://` URIs
- Feedback stored with SHA-256 verification
- 10-epoch storage duration for data permanence

## Tech Stack

- **Blockchain**: Sui Testnet
- **Smart Contracts**: Sui Move
- **Storage**: Walrus Decentralized Storage
- **Frontend**: Next.js, React, TypeScript
- **Styling**: TailwindCSS
- **Wallet**: Sui dApp Kit (@mysten/dapp-kit)

## Deployed Contracts

**Package ID**: `0xc286a2dc94e646d74f17ef0b786485f966d360b83608ab637c06bdc1b8c604d6`

**Identity Registry**: `0x1d0215ffa470d2e5ada9c041cfc95c0f9ce1e3d2b9572893b5154014695f8a26`

**Reputation Registry**: `0xee409df34e6494b058588c3013369236fc42bc6a14582e94cb1c367ba4fa6ad1`

**Validation Registry**: `0x879d265f18835d681c478e724fd9239c411890a753a530893c086bd56994e882`

**Network**: Sui Testnet

## Key Features

✅ ERC-8004 standard compliance with metadata structure  
✅ Decentralized storage on Walrus (no centralized servers)  
✅ Immutable reputation with cryptographic verification  
✅ Multiple protocol endpoint support (A2A, MCP, OASF)  
✅ User-friendly interface with simple and advanced modes  
✅ Transparent agent marketplace with search functionality  

## Quick Start

### Prerequisites
- Node.js 18+
- Sui Wallet (Sui Wallet extension)

### Installation

```bash
# Clone repository
git clone https://github.com/sudeepb02/agent8004-sui.git
cd agent8004-sui/frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` and connect your Sui wallet to interact with the application.

## Project Structure

```
agent8004/
├── sources/                    # Sui Move smart contracts
│   ├── identity_registry.move
│   ├── reputation_registry.move
│   └── validation_registry.move
├── frontend/                   # Next.js application
│   ├── app/                    # App router pages
│   ├── components/             # React components
│   ├── config/                 # Contract addresses & config
│   ├── types/                  # TypeScript types
│   └── utils/                  # Helper functions & Walrus utils
└── Move.toml                   # Move package configuration
```

## ERC-8004 Compliance

The implementation follows the ERC-8004 standard with:
- `type`: Standard identifier URL
- `name`: Agent name
- `description`: Agent description  
- `image`: Agent image URI (stored on Walrus)
- `endpoints`: Array of protocol endpoints with versions
- `registrations`: On-chain registry references
- `supportedTrust`: Trust mechanism declarations

## License

MIT