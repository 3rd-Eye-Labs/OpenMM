# GET /price/compare

Compare prices for a trading pair across multiple exchanges.

## Request

```
GET /api/v1/price/compare?symbol={symbol}&exchanges={exchanges}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | ✅ | — | Trading pair |
| exchanges | string | ❌ | all | Comma-separated exchange IDs |

## Response

```json
{
  "symbol": "BTC/USDT",
  "prices": [
    {
      "exchange": "mexc",
      "price": 42150.00,
      "bid": 42148.00,
      "ask": 42152.00,
      "spread": 4.00,
      "spreadPercent": 0.0095,
      "timestamp": 1710000000000
    },
    {
      "exchange": "gateio",
      "price": 42145.00,
      "bid": 42143.00,
      "ask": 42147.00,
      "spread": 4.00,
      "spreadPercent": 0.0095,
      "timestamp": 1710000000000
    }
  ],
  "analysis": {
    "lowestAsk": {
      "exchange": "gateio",
      "price": 42147.00
    },
    "highestBid": {
      "exchange": "mexc",
      "price": 42148.00
    },
    "spread": 1.00,
    "spreadPercent": 0.0024,
    "arbitrageOpportunity": true
  },
  "timestamp": 1710000000000
}
```

### Analysis Fields

| Field | Type | Description |
|-------|------|-------------|
| lowestAsk | object | Best exchange to buy |
| highestBid | object | Best exchange to sell |
| spread | number | Cross-exchange spread |
| spreadPercent | number | Spread as percentage |
| arbitrageOpportunity | boolean | True if profitable arb exists |

## Examples

```bash
# Compare across all exchanges
curl "http://localhost:3000/api/v1/price/compare?symbol=BTC/USDT"

# Compare specific exchanges
curl "http://localhost:3000/api/v1/price/compare?symbol=ETH/USDT&exchanges=mexc,kraken"
```

## Arbitrage Detection

When `arbitrageOpportunity` is `true`:
- Buy at `lowestAsk.exchange` at `lowestAsk.price`
- Sell at `highestBid.exchange` at `highestBid.price`
- Gross profit = `spread`

⚠️ Consider trading fees, withdrawal fees, and transfer times before executing.

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Invalid symbol | Symbol format incorrect |
| 500 | Fetch failed | One or more exchanges failed |
