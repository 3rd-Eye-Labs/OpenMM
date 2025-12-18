# OpenMM CLI Documentation

OpenMM provides a command-line interface for interacting with multiple cryptocurrency exchanges using a unified set of commands.

## Installation & Setup

### Recommended: Global Installation
```bash
# Build the project first
npm install
npm run build

# Install globally to use 'openmm' command anywhere
npm install -g .

# Now use openmm from anywhere
openmm [command] [options]
```

### Alternative: Development Mode
```bash
# Run commands during development (without global install)
npm run cli -- [command] [options]
```

### Alternative: Using npx
```bash
# Run without global installation (requires build first)
npx openmm [command] [options]
```

## Supported Exchanges

Currently supported exchanges:
- **mexc** - MEXC Exchange (fully implemented)
- **gateio** - Gate.io (coming soon)
- **bitget** - Bitget (fully implemented)
- **kraken** - Kraken (coming soon)

## Cardano Integration

OpenMM includes comprehensive Cardano DEX integration through Iris Protocol:
- **Pool Discovery** - Find optimal liquidity pools for Cardano native tokens
- **Price Aggregation** - Get liquidity-weighted prices from multiple DEXes
- **Token Management** - Easy addition and configuration of new Cardano tokens

📖 **For token setup guide, see [CARDANO_TOKENS.md](guides/CARDANO_TOKENS.md)**

## Commands

### Main Help
```bash
openmm --help
```

---

## 📊 Balance Commands

Get account balance information from exchanges.

### Get All Balances
```bash
# MEXC Example
openmm balance --exchange mexc

# Bitget Example
openmm balance --exchange bitget
```

### Get Specific Asset Balance
```bash
# MEXC Examples
openmm balance --exchange mexc --asset BTC
openmm balance --exchange mexc --asset USDT

# Bitget Examples
openmm balance --exchange bitget --asset BTC
openmm balance --exchange bitget --asset USDT
```

### JSON Output
```bash
# MEXC Example
openmm balance --exchange mexc --json

# Bitget Example
openmm balance --exchange bitget --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-a, --asset <asset>` - Specific asset to query (optional)
- `--json` - Output in JSON format

---

## 📋 Order Commands

Manage trading orders on exchanges.

### List Open Orders
```bash
# MEXC Examples
openmm orders list --exchange mexc
openmm orders list --exchange mexc --limit 5
openmm orders list --exchange mexc --symbol BTC/USDT

# Bitget Examples
openmm orders list --exchange bitget
openmm orders list --exchange bitget --limit 5
openmm orders list --exchange bitget --symbol SNEK/USDT
```

### Get Specific Order
```bash
# MEXC Example
openmm orders get --exchange mexc --id 123456 --symbol BTC/USDT

# Bitget Example
openmm orders get --exchange bitget --id 1385288398060044291 --symbol SNEK/USDT
```

### Create New Order
```bash
# MEXC Examples
openmm orders create --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 50000
openmm orders create --exchange mexc --symbol BTC/USDT --side sell --type market --amount 0.001

# Bitget Examples
openmm orders create --exchange bitget --symbol SNEK/USDT --side buy --type limit --amount 10000 --price 0.00001
openmm orders create --exchange bitget --symbol SNEK/USDT --side sell --type market --amount 5000
```

### Cancel Order
```bash
# MEXC Example
openmm orders cancel --exchange mexc --id C02__626091255599874048060 --symbol INDY/USDT

# Bitget Example
openmm orders cancel --exchange bitget --id 1385288398060044291 --symbol SNEK/USDT
```

**List Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Filter by trading pair (optional)
- `-l, --limit <limit>` - Number of orders to display (default: all)
- `--json` - Output in JSON format

**Get Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-i, --id <orderId>` - Order ID (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `--json` - Output in JSON format

**Create Options:**
- `-e, --exchange <exchange>` - Exchange to use (required)
- `-s, --symbol <symbol>` - Trading pair (required)
- `--side <side>` - Order side: buy/sell (required)
- `--type <type>` - Order type: market/limit (required)
- `--amount <amount>` - Order amount (required)
- `--price <price>` - Order price (required for limit orders)
- `--json` - Output in JSON format

**Cancel Options:**
- `-e, --exchange <exchange>` - Exchange to use (required)
- `-i, --id <orderId>` - Order ID to cancel (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `--json` - Output in JSON format

---

## 📈 Market Data Commands

Get real-time market data from exchanges.

### Ticker Data
```bash
# MEXC Examples
openmm ticker --exchange mexc --symbol BTC/USDT
openmm ticker --exchange mexc --symbol ETH/USDT --json

# Bitget Examples
openmm ticker --exchange bitget --symbol SNEK/USDT
openmm ticker --exchange bitget --symbol BTC/USDT --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `--json` - Output in JSON format

### Order Book
```bash
# MEXC Examples
openmm orderbook --exchange mexc --symbol BTC/USDT
openmm orderbook --exchange mexc --symbol BTC/USDT --limit 5

# Bitget Examples
openmm orderbook --exchange bitget --symbol SNEK/USDT
openmm book --exchange bitget --symbol BTC/USDT --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `-l, --limit <limit>` - Number of bid/ask levels (default: 10)
- `--json` - Output in JSON format

### Recent Trades
```bash
# MEXC Examples
openmm trades --exchange mexc --symbol BTC/USDT
openmm trades --exchange mexc --symbol BTC/USDT --limit 50
openmm trades --exchange mexc --symbol ETH/USDT --json

# Bitget Examples
openmm trades --exchange bitget --symbol SNEK/USDT
openmm trades --exchange bitget --symbol BTC/USDT --limit 50
openmm trades --exchange bitget --symbol SNEK/USDT --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `-l, --limit <limit>` - Number of trades to display (default: 20)
- `--json` - Output in JSON format

---

## 🔧 Environment Setup

### Required Configuration
Ensure your `.env` file contains the necessary API credentials:

```env
# MEXC Configuration
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key

# Bitget Configuration
BITGET_API_KEY=your_bitget_api_key
BITGET_SECRET=your_bitget_secret_key
BITGET_PASSPHRASE=your_bitget_passphrase  # Set when creating API key - API TOKEN

```

### Symbol Format
- Use standard format: `BTC/USDT`, `ETH/USDT`, `INDY/USDT`
- The CLI automatically converts to exchange-specific format

---

## 🔍 Common Examples

### Check Balance
```bash
# MEXC - Check BTC Balance
openmm balance --exchange mexc --asset BTC

# Bitget - Check USDT Balance
openmm balance --exchange bitget --asset USDT
```

### Get Ticker Price
```bash
# MEXC - Get ETH/USDT Price
openmm ticker --exchange mexc --symbol ETH/USDT

# Bitget - Get SNEK/USDT Price
openmm ticker --exchange bitget --symbol SNEK/USDT
```

### View Order Book
```bash
# MEXC - BTC/USDT Order Book
openmm orderbook --exchange mexc --symbol BTC/USDT --limit 5

# Bitget - SNEK/USDT Order Book
openmm orderbook --exchange bitget --symbol SNEK/USDT --limit 10
```

### Place Orders
```bash
# MEXC - Limit Buy Order
openmm orders create --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 45000

# Bitget - Limit Buy Order
openmm orders create --exchange bitget --symbol SNEK/USDT --side buy --type limit --amount 10000 --price 0.00001
```

### List Open Orders
```bash
# MEXC - All Open Orders
openmm orders list --exchange mexc

# Bitget - Open Orders for SNEK/USDT
openmm orders list --exchange bitget --symbol SNEK/USDT
```

---

## 🏊 Cardano Pool Discovery Commands

Discover and analyze Cardano DEX liquidity pools for native tokens.

### Discover Pools for a Token
```bash
# Discover pools for NIGHT token
openmm pool-discovery discover NIGHT

# Discover top 5 pools for SNEK token
openmm pool-discovery discover SNEK --limit 5

# Find pools with minimum $50K liquidity for INDY
openmm pool-discovery discover INDY --min-liquidity 50000

# Show all available pools for a token
openmm pool-discovery discover INDY --show-all
```

### List Supported Tokens
```bash
# See all supported Cardano tokens
openmm pool-discovery supported
```

### Get Live Pool Prices
```bash
openmm pool-discovery prices NIGHT
```

### Generate Custom Token Configuration
```bash
# Generate config for a new token (advanced users)
openmm pool-discovery custom POLICY_ID ASSET_NAME_HEX SYMBOL

# Example for hypothetical token
openmm pool-discovery custom 533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0 494e4459 INDY
```

**Pool Discovery Options:**
- `--limit <number>` - Limit number of pools shown (default: 10)
- `--min-liquidity <number>` - Filter pools by minimum TVL in dollars
- `--show-all` - Show all pools (ignore limit)

**Supported Cardano Tokens:**
- **NIGHT** - Midnight
- **SNEK** - Snek Token
- **INDY** - Indigo Protocol
---

## 📖 Help

Get help for any command:
```bash
openmm --help                    # Main help
openmm balance --help            # Balance command help  
openmm orders --help             # Orders command help
openmm orders create --help      # Order creation help
openmm ticker --help             # Ticker command help
openmm orderbook --help          # Order book command help
openmm trades --help             # Trades command help
openmm pool-discovery --help     # Pool discovery help
```

---