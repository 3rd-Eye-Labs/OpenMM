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

   # For Gate.io
   export GATEIO_API_KEY="your_api_key"
   export GATEIO_SECRET="your_secret_key"

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

**Gate.io Example:**
```bash
# Start grid trading with default settings on Gate.io
openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT
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
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
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
- `--exchange <exchange>` - Exchange to trade on (supports: `mexc`, `bitget`, `gateio`, `kraken`)
- `--symbol <symbol>` - Trading pair (e.g., INDY/USDT, SNEK/USDT, ADA/EUR, BTC/USD)

### Grid Parameters
- `--levels <number>` - Grid levels each side (default: 5, max: 10, total orders = levels x 2)
- `--spacing <decimal>` - Base price spacing between levels (default: 0.02 = 2%)
- `--size <number>` - Base order size in quote currency (default: 50)
- `--confidence <decimal>` - Minimum price confidence to trade (default: 0.6 = 60%)
- `--deviation <decimal>` - Price deviation % to trigger grid recreation (default: 0.015 = 1.5%)
- `--debounce <ms>` - Delay between grid adjustments (default: 2000ms)
- `--max-position <decimal>` - Maximum position size as % of balance (default: 0.8 = 80%)
- `--safety-reserve <decimal>` - Safety reserve as % of balance (default: 0.2 = 20%)
- `--dry-run` - Simulate trading without placing real orders

### Dynamic Grid Parameters

These parameters control how order levels and sizes are distributed across the grid:

- `--spacing-model <model>` - How spacing between levels is calculated (default: `linear`)
  - `linear` - Equal spacing between all levels
  - `geometric` - Spacing increases by a factor per level (wider gaps at outer levels)
  - `custom` - User-defined spacing offsets via grid profile file
- `--spacing-factor <number>` - Geometric spacing multiplier per level (default: 1.3)
- `--size-model <model>` - How order sizes are distributed across levels (default: `flat`)
  - `flat` - Equal size for all levels
  - `pyramidal` - Larger sizes near center price, smaller at outer levels
  - `custom` - User-defined weight multipliers via grid profile file
- `--grid-profile <path>` - Load complete grid configuration from a JSON profile file

## Dynamic Grid Configuration

### Spacing Models

**Linear (default):** Equal spacing between all levels. With `--spacing 0.02` and 5 levels, each level is 2% apart:
```
Level 1: 2% from center
Level 2: 4% from center
Level 3: 6% from center
Level 4: 8% from center
Level 5: 10% from center
```

**Geometric:** Each level's gap is multiplied by the spacing factor. This creates tighter spacing near the center price and wider gaps at the outer levels, which is more realistic for market making:
```bash
openmm trade --strategy grid --exchange kraken --symbol BTC/USD \
  --levels 5 --spacing 0.005 --spacing-model geometric --spacing-factor 1.5
```
With `--spacing 0.005` and `--spacing-factor 1.5`:
```
Level 1: 0.50% from center (gap: 0.50%)
Level 2: 1.25% from center (gap: 0.75%)
Level 3: 2.38% from center (gap: 1.13%)
Level 4: 4.06% from center (gap: 1.69%)
Level 5: 6.59% from center (gap: 2.53%)
```

**Custom:** Define exact spacing offsets per level using a grid profile file (see Grid Profiles section below).

### Size Models

**Flat (default):** All levels get equal order sizes.

**Pyramidal:** Larger orders near the center price where fills are more likely, tapering at outer levels:
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 5 --size 50 --size-model pyramidal
```

**Custom:** Define exact size weight multipliers per level using a grid profile file.

### Grid Profiles

Grid profiles are JSON files that define a complete grid configuration. This is useful for:
- Full per-level control over spacing and sizing
- Sharing and version-controlling configurations
- Quickly switching between strategies

**Basic profile (geometric spacing, pyramidal sizing):**
```json
{
  "name": "balanced-geometric",
  "description": "Geometric spacing with pyramidal sizing for balanced market making",
  "levels": 10,
  "spacingModel": "geometric",
  "baseSpacing": 0.005,
  "spacingFactor": 1.3,
  "sizeModel": "pyramidal",
  "baseSize": 50
}
```

**Custom profile (full per-level control):**
```json
{
  "name": "custom-aggressive",
  "description": "Custom spacing and sizing for aggressive market making",
  "levels": 5,
  "spacingModel": "custom",
  "customSpacings": [0.003, 0.008, 0.015, 0.025, 0.04],
  "sizeModel": "custom",
  "sizeWeights": [2.0, 1.5, 1.0, 0.7, 0.4],
  "baseSpacing": 0.003,
  "baseSize": 50
}
```

**Using a profile:**
```bash
openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT \
  --grid-profile ./profiles/balanced-geometric.json
```

Profile values override corresponding CLI parameters.

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

### Dynamic Grid Strategies

**1. Linear Spacing + Flat Sizing (default behavior):**
```bash
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
  --levels 5 \
  --spacing 0.02 \
  --size 5
```

**2. Geometric Spacing + Flat Sizing:**
```bash
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
  --levels 10 \
  --spacing 0.003 \
  --spacing-model geometric \
  --spacing-factor 1.3 \
  --size 5
```

**3. Geometric Spacing + Pyramidal Sizing:**
```bash
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
  --levels 10 \
  --spacing 0.005 \
  --spacing-model geometric \
  --spacing-factor 1.5 \
  --size-model pyramidal \
  --size 5
```

**4. Linear Spacing + Pyramidal Sizing:**
```bash
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
  --levels 8 \
  --spacing 0.01 \
  --size-model pyramidal \
  --size 5
```

**5. Geometric with Aggressive Factor (wider outer levels):**
```bash
openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR \
  --levels 10 \
  --spacing 0.002 \
  --spacing-model geometric \
  --spacing-factor 2.0 \
  --size-model pyramidal \
  --size 5
```

**6. Profile-Based Grid (custom JSON config):**
```bash
openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT \
  --grid-profile ./profiles/aggressive.json
```

**7. Multi-Exchange Dynamic Grid:**
```bash
# MEXC - Geometric + Pyramidal
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 10 \
  --spacing 0.005 \
  --spacing-model geometric \
  --spacing-factor 1.3 \
  --size-model pyramidal \
  --size 5

# Bitget - Linear + Pyramidal
openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT \
  --levels 7 \
  --spacing 0.01 \
  --size-model pyramidal \
  --size 5

# Gate.io - Geometric + Pyramidal
openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT \
  --levels 8 \
  --spacing 0.004 \
  --spacing-model geometric \
  --spacing-factor 1.4 \
  --size-model pyramidal \
  --size 5
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

**Gate.io Test:**
```bash
openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT --dry-run
```

**Kraken Test:**
```bash
openmm trade --strategy grid --exchange kraken --symbol ADA/EUR --dry-run
```

**Dynamic Grid Test:**
```bash
openmm trade --strategy grid --exchange mexc --symbol INDY/USDT \
  --levels 10 --spacing-model geometric --dry-run
```

## Risk Management

The Grid Strategy includes built-in risk management:

### Configurable Risk Limits
Users can customize risk management through CLI parameters:
- `--max-position 0.6` - Use max 60% of balance for trading (default: 80%)
- `--safety-reserve 0.3` - Keep 30% as safety reserve (default: 20%)
- `--confidence 0.8` - Require 80% price confidence (default: 60%)

### Automatic Position Sizing
When using flat sizing, the system distributes the base order size equally across all levels. With pyramidal sizing, larger allocations are placed near the center price where fills are more likely, with smaller orders at the edges.

Total allocation is automatically capped at 80% of available balance regardless of the size model used.

### Price Confidence Filtering
- Only executes trades when price confidence >= minimum threshold
- Sources price data from Cardano DEX via Iris API
- Prevents trading on unreliable price data

### Dynamic Grid Management
- Recreates grid when orders are filled
- Adjusts to significant price movements (configurable via `--deviation`)
- Cancels and replaces orders as needed
- Debounce mechanism prevents rapid-fire grid recreation

## Monitoring Your Strategy

### Real-time Updates
The strategy provides live feedback:

```
🚀 Starting Trading Strategy
Strategy: GRID
Exchange: KRAKEN
Symbol: BTC/USD
Grid Levels: 10 per side (20 total)
Grid Spacing: 0.3%
Spacing Model: geometric
Spacing Factor: 1.3
Size Model: pyramidal
Order Size: $50
Max Position: 80%
Safety Reserve: 20%

⚙️  Creating strategy...
✅ Strategy initialized successfully
🔄 Starting strategy...
📊 Grid Configuration:
  Levels: 10 per side (20 total orders)
  Spacing Model: geometric
  Base Spacing: 0.30%
  Spacing Factor: 1.3
  Size Model: pyramidal
  Base Size: $50
✅ Strategy is now running!
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

**Invalid credentials (Gate.io):**
```
Error: Gate.io credentials not found
```
Solution: Verify `GATEIO_API_KEY` and `GATEIO_SECRET` environment variables

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

**Invalid grid profile:**
```
Error: Grid profile file not found: ./profiles/my-config.json
```
Solution: Verify the profile file path exists and contains valid JSON

**Invalid spacing/size model:**
```
Error: Invalid spacing model: abc. Must be: linear, geometric, or custom
```
Solution: Use one of the supported models: `linear`, `geometric`, or `custom` for spacing; `flat`, `pyramidal`, or `custom` for sizing

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

**Gate.io Requirements:**
- Minimum order value: 1 USDT per order
- Requires API key and secret for authentication

**Kraken Requirements:**
- Minimum order value: 5 EUR/USD/GBP per order
- Price precision: Maximum 6 decimal places
- Quantity precision: 2 decimal places for ADA, 6-8 for BTC/ETH
- Requires API key and secret for authentication
- Supports major fiat pairs (EUR, USD, GBP) and crypto pairs
