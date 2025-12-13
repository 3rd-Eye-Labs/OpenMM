# Running Grid Trading Strategy

This guide explains how to run the Grid Trading Strategy using OpenMM's unified CLI interface.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Set your exchange API credentials
   export MEXC_API_KEY="your_api_key"
   export MEXC_SECRET_KEY="your_secret_key"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npm run build
   ```

## Quick Start

### Basic Grid Strategy
```bash
# Start grid trading with default settings
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT
```

### Custom Configuration
```bash
# Advanced grid with custom parameters
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 5 \
  --spacing 0.02 \
  --size 50 \
  --confidence 0.7
```

## Command Options

### Required Parameters
- `--strategy grid` - Specifies grid trading strategy
- `--exchange mexc` - Exchange to trade on (currently supports MEXC)
- `--symbol <symbol>` - Trading pair (e.g., INDY/USDT, BTC/USDT)

### Optional Parameters
- `--levels <number>` - Grid levels each side (default: 5, range: 1-20)
- `--spacing <decimal>` - Price spacing between levels (default: 0.02 = 2%)
- `--size <number>` - Order size in quote currency (default: auto-calculated)
- `--confidence <decimal>` - Minimum price confidence to trade (default: 0.6 = 60%)
- `--deviation <decimal>` - Price deviation % to trigger grid recreation (default: 0.015 = 1.5%)
- `--debounce <ms>` - Delay between grid adjustments (default: 2000ms)
- `--dry-run` - Simulate trading without placing real orders

## Trading Examples

### Conservative INDY Trading
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 3 \
  --spacing 0.01 \
  --confidence 0.8
```

### Active BTC Trading
```bash
openmm trade --strategy grid --exchange mexc --symbol BTC/USDT \
  --levels 7 \
  --spacing 0.005 \
  --size 25
```

### Test Mode (No Real Orders)
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT --dry-run
```

## Alternative Commands

### Legacy Grid Command
```bash
# Equivalent to trade command but grid-specific
openmm grid --exchange mexc --symbol INDY/USDT --levels 5
```

## Risk Management

The Grid Strategy includes built-in risk management:

### Automatic Position Sizing
When `--size` is omitted, the system automatically calculates optimal order sizes:
- Uses **80% of available balance** for trading
- Keeps **20% as safety reserve**
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

**Invalid credentials:**
```
Error: MEXC credentials not found
```
Solution: Verify `MEXC_API_KEY` and `MEXC_SECRET_KEY` environment variables

**Low price confidence:**
```
Error: Price confidence too low: 0.4 < 0.6
```
Solution: Lower `--confidence` threshold or wait for better price data

**Insufficient balance:**
```
Error: No balance found for USDT
```
Solution: Ensure sufficient USDT balance in your exchange account