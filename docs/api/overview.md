# API Overview

OpenMM provides a REST API built with Fastify, featuring automatic OpenAPI documentation.

## Base URL

```
http://localhost:3000/api/v1
```

## Starting the Server

```bash
openmm serve --port 3000
```

Options:
- `--port` — Port number (default: 3000)
- `--host` — Host address (default: 0.0.0.0)

## Interactive Documentation

Swagger UI is available at:
```
http://localhost:3000/docs
```

## Response Format

All responses are JSON with consistent structure:

### Success Response
```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "data": { ... },
  "timestamp": 1710000000000
}
```

### Error Response
```json
{
  "error": "Error message here"
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request — Invalid parameters |
| 404 | Not Found — Resource doesn't exist |
| 500 | Server Error — Internal error |

## Endpoints Summary

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ticker | Get ticker for trading pair |
| GET | /orderbook | Get order book |
| GET | /trades | Get recent trades |

### Account
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /balance | Get account balances |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /orders | List open orders |
| GET | /orders/:id | Get order by ID |
| POST | /orders | Create new order |
| DELETE | /orders/:id | Cancel order |
| DELETE | /orders | Cancel all orders |

### Strategy
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /strategy/grid | Start grid strategy |
| DELETE | /strategy/grid | Stop grid strategy |
| GET | /strategy/grid/status | Get strategy status |
| GET | /strategy/grid/list | List active strategies |

### Cardano DEX
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /cardano/price/:symbol | Get token price |
| GET | /cardano/pools/:symbol | Discover liquidity pools |

### Price Comparison
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /price/compare | Compare prices across exchanges |

## Supported Exchanges

| ID | Name | Status |
|----|------|--------|
| mexc | MEXC | ✅ Full support |
| gateio | Gate.io | ✅ Full support |
| bitget | Bitget | ✅ Full support |
| kraken | Kraken | ✅ Full support |
