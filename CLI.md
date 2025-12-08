# OpenMM CLI Documentation

OpenMM provides a command-line interface for interacting with multiple cryptocurrency exchanges using a unified set of commands.

## Installation & Setup

### Development Mode
```bash
# Run commands during development
npm run cli -- [command] [options]
```

### Global Installation
```bash
# Install globally to use 'openmm' command anywhere
npm install -g .
openmm [command] [options]
```

### Using npx
```bash
# Run without global installation
npx openmm [command] [options]
```

## Supported Exchanges

Currently supported exchanges:
- **mexc** - MEXC Exchange (fully implemented)
- **gateio** - Gate.io (coming soon)
- **bitget** - Bitget (coming soon)
- **kraken** - Kraken (coming soon)

## Commands

### Main Help
```bash
npm run cli -- --help
```

---

## 📊 Balance Commands

Get account balance information from exchanges.

### Get All Balances
```bash
npm run cli -- balance --exchange mexc
```

### Get Specific Asset Balance
```bash
npm run cli -- balance --exchange mexc --asset BTC
npm run cli -- balance --exchange mexc --asset USDT
```

### JSON Output
```bash
npm run cli -- balance --exchange mexc --json
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
# List all open orders
npm run cli -- orders list --exchange mexc

# List only 5 orders
npm run cli -- orders list --exchange mexc --limit 5

# List orders for specific symbol
npm run cli -- orders list --exchange mexc --symbol BTC/USDT

# List only 3 orders for specific symbol
npm run cli -- orders list --exchange mexc --symbol BTC/USDT --limit 3
```

### Get Specific Order
```bash
npm run cli -- orders get --exchange mexc --id 123456 --symbol BTC/USDT
```

### Create New Order
```bash
# Create limit buy order
npm run cli -- orders create --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 50000

# Create market sell order
npm run cli -- orders create --exchange mexc --symbol BTC/USDT --side sell --type market --amount 0.001
```

### Cancel Order
```bash
# Cancel specific order
npm run cli -- orders cancel --exchange mexc --id C02__626091255599874048060 --symbol INDY/USDT
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
# Get ticker for BTC/USDT
npm run cli -- ticker --exchange mexc --symbol BTC/USDT

# Get ticker in JSON format
npm run cli -- ticker --exchange mexc --symbol ETH/USDT --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `--json` - Output in JSON format

### Order Book
```bash
# Get order book with default 10 levels
npm run cli -- orderbook --exchange mexc --symbol BTC/USDT

# Get order book with 5 levels
npm run cli -- orderbook --exchange mexc --symbol BTC/USDT --limit 5

# Using alias 'book'
npm run cli -- book --exchange mexc --symbol ETH/USDT --json
```

**Options:**
- `-e, --exchange <exchange>` - Exchange to query (required)
- `-s, --symbol <symbol>` - Trading pair symbol (required)
- `-l, --limit <limit>` - Number of bid/ask levels (default: 10)
- `--json` - Output in JSON format

### Recent Trades
```bash
# Get 20 recent trades (default)
npm run cli -- trades --exchange mexc --symbol BTC/USDT

# Get 50 recent trades
npm run cli -- trades --exchange mexc --symbol BTC/USDT --limit 50

# Get trades in JSON format
npm run cli -- trades --exchange mexc --symbol ETH/USDT --json
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
```

### Symbol Format
- Use standard format: `BTC/USDT`, `ETH/USDT`, `INDY/USDT`
- The CLI automatically converts to exchange-specific format

---

## 🔍 Common Examples

### Check BTC Balance
```bash
npm run cli -- balance --exchange mexc --asset BTC
```

### Get ETH/USDT Price
```bash
npm run cli -- ticker --exchange mexc --symbol ETH/USDT
```

### View BTC/USDT Order Book
```bash
npm run cli -- orderbook --exchange mexc --symbol BTC/USDT --limit 5
```

### Place Limit Buy Order
```bash
npm run cli -- orders create --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 45000
```

### List All Open Orders
```bash
npm run cli -- orders list --exchange mexc
```

---

## 📖 Help

Get help for any command:
```bash
npm run cli -- --help                    # Main help
npm run cli -- balance --help            # Balance command help  
npm run cli -- orders --help             # Orders command help
npm run cli -- orders create --help      # Order creation help
npm run cli -- ticker --help             # Ticker command help
npm run cli -- orderbook --help          # Order book command help
npm run cli -- trades --help             # Trades command help
```

---

## 🚨 Error Handling

The CLI provides clear error messages for:
- Invalid exchange names
- Missing required parameters  
- Invalid symbol formats
- Network connectivity issues
- API authentication errors

All errors are displayed with helpful suggestions for resolution.