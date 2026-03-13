# Quick Start

## CLI Usage

### Check Balance

```bash
openmm balance --exchange mexc
openmm balance --exchange mexc --asset USDT
```

### Get Market Data

```bash
openmm ticker --exchange mexc --symbol BTC/USDT
openmm orderbook --exchange mexc --symbol BTC/USDT --limit 5
openmm trades --exchange mexc --symbol BTC/USDT --limit 10
```

### Place Orders

```bash
# Limit buy order
openmm order place --exchange mexc --symbol BTC/USDT --side buy --type limit --amount 0.001 --price 40000

# Market sell order
openmm order place --exchange mexc --symbol BTC/USDT --side sell --type market --amount 0.001

# List open orders
openmm order list --exchange mexc

# Cancel order
openmm order cancel --exchange mexc --orderId abc123
```

### Cardano DEX

```bash
# Get token price
openmm cardano price INDY

# Discover pools
openmm cardano pools SNEK --limit 5
```

## API Server

Start the REST API server:

```bash
openmm serve --port 3000
```

Access endpoints:
- API: `http://localhost:3000/api/v1/`
- Swagger UI: `http://localhost:3000/docs`

### Example API Calls

```bash
# Get ticker
curl "http://localhost:3000/api/v1/ticker?exchange=mexc&symbol=BTC/USDT"

# Get balance
curl "http://localhost:3000/api/v1/balance?exchange=mexc"

# Place order
curl -X POST "http://localhost:3000/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "mexc",
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "amount": 0.001,
    "price": 40000
  }'
```

## Grid Strategy

Start a grid trading strategy:

```bash
openmm grid start \
  --exchange mexc \
  --symbol BTC/USDT \
  --lower 38000 \
  --upper 42000 \
  --levels 10 \
  --size 50
```

Monitor and stop:

```bash
openmm grid status
openmm grid stop --id grid-xxx
```

See [Grid Strategy Guide](../guides/GRID_STRATEGY.md) for advanced configuration.
