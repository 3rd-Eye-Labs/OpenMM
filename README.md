# OpenMM - Cardano's Universal Market Making Toolkit

[![npm version](https://img.shields.io/npm/v/@3rd-eye-labs/openmm)](https://www.npmjs.com/package/@3rd-eye-labs/openmm)
[![npm downloads](https://img.shields.io/npm/dm/@3rd-eye-labs/openmm)](https://www.npmjs.com/package/@3rd-eye-labs/openmm)
[![license](https://img.shields.io/npm/l/@3rd-eye-labs/openmm)](https://github.com/3rd-Eye-Labs/OpenMM/blob/main/LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/3rd-Eye-Labs/OpenMM)

OpenMM is an open-source SDK designed to democratize market-making for Cardano projects. It provides a unified interface for trading Cardano Native Tokens (CNTs) across multiple centralized exchanges.

## What is OpenMM?

Traditional market-making services are expensive and fragmented, making it difficult for smaller Cardano projects to maintain healthy liquidity. OpenMM solves this by offering:

- **Multi-Exchange Support**: 13 tools that work across 4 exchanges (MEXC, Gate.io, Bitget, Kraken) for any trading pair — one interface, unlimited assets
- **Advanced Strategies**: Grid trading, liquidity provision, and dynamic rebalancing
- **Complete CNT Integration**: Full support for Cardano Native Tokens

This toolkit aims to improve liquidity for Cardano projects, reduce trading spreads, and potentially become the standard liquidity infrastructure for the Cardano ecosystem.

## ⚡ Quick Start

### CLI Tool

```bash
# 1. Install & Setup OpenMM
npm install -g openmm
npx openmm setup
```

The setup wizard will:
- Let you select exchanges (MEXC, Gate.io, Kraken, Bitget)
- Prompt for API credentials
- Create a `.env` file with your credentials

### MCP Server — For AI Agents

```bash
# 2. Install & Setup OpenMM MCP (13 tools)
npm install -g @qbtlabs/openmm-mcp
npx @qbtlabs/openmm-mcp setup
```

Configures Claude Desktop, Claude Code, Cursor, or Windsurf to use OpenMM tools.

### Verify Installation

```bash
openmm balance --exchange mexc
```

Or ask your AI agent: *"What is my balance on MEXC?"*

## Getting Started (Development)

### Prerequisites

- Node.js 20.x LTS or higher
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Running Trading Strategies

OpenMM includes automated trading strategies for market making:

- **CLI Commands**: See [CLI.md](docs/CLI.md) for all available commands
- **Grid Strategy**: See [GRID_STRATEGY.md](docs/guides/GRID_STRATEGY.md) for grid trading setup and examples

```bash
# Example: Start grid trading on MEXC
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT
```

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Contributing

Please read our contributing guidelines before submitting pull requests.