# Running Grid Trading Strategy

This guide explains how to run the Grid Trading Strategy using OpenMM's unified CLI interface.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Set your exchange API credentials
   
   # For MEXC
   export MEXC_API_KEY="your_api_key"
   export MEXC_SECRET_KEY="your_secret_key"
   
   # For Bitget
   export BITGET_API_KEY="your_api_key"
   export BITGET_SECRET="your_secret_key"
   export BITGET_PASSPHRASE="your_passphrase"
   
   # For Kraken
   export KRAKEN_API_KEY="your_api_key"
   export KRAKEN_SECRET="your_secret_key"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npm run build
   ```

## Quick Start

### Basic Grid Strategy

**MEXC Example:**
```bash
# Start grid trading with default settings on MEXC
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT
```

**Bitget Example:**
```bash
# Start grid trading with default settings on Bitget
openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT
```

**Kraken Example:**
```bash
# Start grid trading with default settings on Kraken
openmm trade --strategy grid --exchange kraken --symbol ADA/EUR
```

### Custom Configuration

**MEXC Advanced Grid:**
```bash
# Advanced grid with custom parameters on MEXC
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 5 \
  --spacing 0.02 \
  --size 50 \
  --confidence 0.7 \
  --max-position 0.6 \
  --safety-reserve 0.3
```

**Bitget Advanced Grid:**
```bash
# Advanced grid with custom parameters on Bitget
openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT \
  --levels 3 \
  --spacing 0.015 \
  --size 25 \
  --confidence 0.8 \
  --max-position 0.7 \
  --safety-reserve 0.3
```

**Kraken Advanced Grid:**
```bash
# Advanced grid with custom parameters on Kraken
openmm trade --strategy grid --exchange kraken --symbol ADA/EUR \
  --levels 4 \
  --spacing 0.01 \
  --size 15 \
  --confidence 0.75 \
  --max-position 0.6 \
  --safety-reserve 0.25
```

## Command Options

### Required Parameters
- `--strategy grid` - Specifies grid trading strategy
- `--exchange <exchange>` - Exchange to trade on (supports: `mexc`, `bitget`, `kraken`)
- `--symbol <symbol>` - Trading pair (e.g., INDY/USDT, SNEK/USDT, ADA/EUR, BTC/USD)

### Optional Parameters
- `--levels <number>` - Grid levels each side (default: 5, range: 1-20)
- `--spacing <decimal>` - Price spacing between levels (default: 0.02 = 2%)
- `--size <number>` - Order size in quote currency (default: auto-calculated)
- `--confidence <decimal>` - Minimum price confidence to trade (default: 0.6 = 60%)
- `--deviation <decimal>` - Price deviation % to trigger grid recreation (default: 0.015 = 1.5%)
- `--debounce <ms>` - Delay between grid adjustments (default: 2000ms)
- `--max-position <decimal>` - Maximum position size as % of balance (default: 0.8 = 80%)
- `--safety-reserve <decimal>` - Safety reserve as % of balance (default: 0.2 = 20%)
- `--dry-run` - Simulate trading without placing real orders

## Trading Examples

### Conservative Trading Strategies

**MEXC - Conservative INDY Trading:**
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 3 \
  --spacing 0.01 \
  --confidence 0.8
```

**Bitget - Conservative SNEK Trading:**
```bash
openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT \
  --levels 2 \
  --spacing 0.02 \
  --size 20 \
  --confidence 0.8
```

**Kraken - Conservative ADA Trading:**
```bash
openmm trade --strategy grid --exchange kraken --symbol ADA/EUR \
  --levels 3 \
  --spacing 0.015 \
  --size 10 \
  --confidence 0.8
```

### Active Trading Strategies

**MEXC - Active BTC Trading:**
```bash
openmm trade --strategy grid --exchange mexc --symbol BTC/USDT \
  --levels 7 \
  --spacing 0.005 \
  --size 25
```

**Bitget - Active NIGHT Trading:**
```bash
openmm trade --strategy grid --exchange bitget --symbol NIGHT/USDT \
  --levels 5 \
  --spacing 0.025 \
  --size 30 \
  --max-position 0.6
```

**Kraken - Active ETH Trading:**
```bash
openmm trade --strategy grid --exchange kraken --symbol ETH/USD \
  --levels 6 \
  --spacing 0.008 \
  --size 40 \
  --max-position 0.7
```

### Test Mode (No Real Orders)

**MEXC Test:**
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT --dry-run
```

**Bitget Test:**
```bash
openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT --dry-run
```

**Kraken Test:**
```bash
openmm trade --strategy grid --exchange kraken --symbol ADA/EUR --dry-run
```

## Risk Management

The Grid Strategy includes built-in risk management:

### Configurable Risk Limits
Users can customize risk management through CLI parameters:
- `--max-position 0.6` - Use max 60% of balance for trading (default: 80%)
- `--safety-reserve 0.3` - Keep 30% as safety reserve (default: 20%)
- `--confidence 0.8` - Require 80% price confidence (default: 60%)

### Automatic Position Sizing
When `--size` is omitted, the system automatically calculates optimal order sizes:
- Uses **max-position %** of available balance for trading
- Keeps **safety-reserve %** untouched as safety buffer
- Distributes orders across grid levels efficiently

### Price Confidence Filtering
- Only executes trades when price confidence ≥ minimum threshold
- Sources price data from Cardano DEX via Iris API
- Prevents trading on unreliable price data

### Dynamic Grid Management
- Recreates grid when orders are filled
- Adjusts to significant price movements
- Cancels and replaces orders as needed

## Monitoring Your Strategy

### Real-time Updates
The strategy provides live feedback:

**MEXC Example:**
```
🚀 Starting Grid Trading Strategy
Exchange: MEXC
Symbol: INDY/USDT
Grid Levels: 5 each side
Grid Spacing: 2.0%
Order Size: $50

✅ Strategy initialized successfully
🔄 Starting grid strategy...
✅ Grid strategy is now running!
Press Ctrl+C to stop the strategy gracefully
```

**Bitget Example:**
```
🚀 Starting Grid Trading Strategy
Exchange: BITGET
Symbol: SNEK/USDT
Grid Levels: 2 each side
Grid Spacing: 2.0%
Order Size: $20

✅ Strategy initialized successfully
🔄 Starting grid strategy...
✅ Grid strategy is now running!
Press Ctrl+C to stop the strategy gracefully
```

**Kraken Example:**
```
🚀 Starting Grid Trading Strategy
Exchange: KRAKEN
Symbol: ADA/EUR
Grid Levels: 3 each side
Grid Spacing: 1.5%
Order Size: €10

✅ Strategy initialized successfully
🔄 Starting grid strategy...
✅ Grid strategy is now running!
Press Ctrl+C to stop the strategy gracefully
```

### Graceful Shutdown
```bash
# Stop the strategy cleanly
Ctrl+C
```
The system will:
1. Cancel all open orders
2. Disconnect from exchange
3. Display final status

## Troubleshooting

### Common Issues

**Invalid credentials (MEXC):**
```
Error: MEXC credentials not found
```
Solution: Verify `MEXC_API_KEY` and `MEXC_SECRET_KEY` environment variables

**Invalid credentials (Bitget):**
```
Error: Bitget credentials validation failed
```
Solution: Verify `BITGET_API_KEY`, `BITGET_SECRET`, and `BITGET_PASSPHRASE` environment variables

**Invalid credentials (Kraken):**
```
Error: Kraken authentication failed
```
Solution: Verify `KRAKEN_API_KEY` and `KRAKEN_SECRET` environment variables

**Minimum order value (Bitget/MEXC):**
```
Error: Bitget order value 0.50 USDT is below minimum 1 USDT
```
Solution: Increase `--size` parameter or reduce number of `--levels` to ensure each order meets 1 USDT minimum

**Minimum order value (Kraken):**
```
Error: Kraken order value 3.50 EUR is below minimum 5 EUR
```
Solution: Increase `--size` parameter or reduce number of `--levels` to ensure each order meets 5 EUR/USD minimum

**Low price confidence:**
```
Error: Price confidence too low: 0.4 < 0.6
```
Solution: Lower `--confidence` threshold or wait for better price data

**Price precision error (Bitget):**
```
Error: param price scale error
```
Solution: This is automatically handled by the system's precision formatting. If you see this error, please report it as it indicates a system issue.

**Insufficient balance:**
```
Error: No balance found for USDT
```
Solution: Ensure sufficient USDT balance in your exchange account

### Exchange-Specific Notes

**Bitget Requirements:**
- Minimum order value: 1 USDT per order
- Price precision: 6 decimal places for SNEK/NIGHT pairs
- Quantity precision: 2 decimal places for SNEK/INDY/NIGHT pairs
- Requires API key, secret, and passphrase for authentication

**MEXC Requirements:**
- Minimum order value: 1 USDT per order  
- Flexible precision handling
- Requires API key and secret for authentication

**Kraken Requirements:**
- Minimum order value: 5 EUR/USD/GBP per order
- Price precision: Maximum 6 decimal places
- Quantity precision: 2 decimal places for ADA, 6-8 for BTC/ETH
- Requires API key and secret for authentication
- Supports major fiat pairs (EUR, USD, GBP) and crypto pairs