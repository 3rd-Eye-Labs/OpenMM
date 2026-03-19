# Installation

## NPM Package

```bash
npm install -g @3rd-eye-labs/openmm
```

## From Source

```bash
git clone https://github.com/3rd-Eye-Labs/OpenMM.git
cd OpenMM
npm install
npm run build
npm install -g .
```

## Verify Installation

```bash
openmm --version
openmm --help
```

## Exchange Setup

Run the interactive setup wizard:

```bash
openmm setup
```

This will guide you through:
1. Selecting exchanges to configure
2. Entering API credentials
3. Testing connectivity

### Manual Configuration

Create a `.env` file in your working directory:

```env
# MEXC (required)
MEXC_API_KEY=your-api-key
MEXC_SECRET=your-secret-key

# Gate.io (optional)
GATEIO_API_KEY=your-api-key
GATEIO_SECRET_KEY=your-secret-key

# Bitget (optional)
BITGET_API_KEY=your-api-key
BITGET_SECRET_KEY=your-secret-key
BITGET_PASSPHRASE=your-passphrase

# Kraken (optional)
KRAKEN_API_KEY=your-api-key
KRAKEN_SECRET_KEY=your-secret-key
```

## MCP Server

For AI agent integration:

```bash
npm install -g @qbtlabs/openmm-mcp
npx @qbtlabs/openmm-mcp setup
```

See [MCP documentation](https://github.com/QBT-Labs/openMM-MCP) for client configuration.
