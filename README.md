# OpenMM - Cardano's Universal Market Making Toolkit

OpenMM is an open-source SDK designed to democratize market-making for Cardano projects. It provides a unified interface for trading Cardano Native Tokens (CNTs) across multiple centralized exchanges.

## What is OpenMM?

Traditional market-making services are expensive and fragmented, making it difficult for smaller Cardano projects to maintain healthy liquidity. OpenMM solves this by offering:

- **Multi-Exchange Support**: Trade on MEXC, Gate.io, Bitget, Kraken and more through a single interface
- **Advanced Strategies**: Grid trading, liquidity provision, and dynamic rebalancing
- **Complete CNT Integration**: Full support for Cardano Native Tokens

This toolkit aims to improve liquidity for Cardano projects, reduce trading spreads, and potentially become the standard liquidity infrastructure for the Cardano ecosystem.

## Getting Started

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