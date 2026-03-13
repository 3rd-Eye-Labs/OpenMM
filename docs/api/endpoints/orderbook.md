# GET /orderbook

Get the order book (bids and asks) for a trading pair.

## Request

```
GET /api/v1/orderbook?exchange={exchange}&symbol={symbol}&limit={limit}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| exchange | string | ✅ | — | Exchange ID |
| symbol | string | ✅ | — | Trading pair |
| limit | number | ❌ | 10 | Number of levels (1-100) |

## Response

```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "bids": [
    { "price": 42148.00, "amount": 0.5, "total": 0.5 },
    { "price": 42145.00, "amount": 1.2, "total": 1.7 },
    { "price": 42140.00, "amount": 0.8, "total": 2.5 }
  ],
  "asks": [
    { "price": 42152.00, "amount": 0.3, "total": 0.3 },
    { "price": 42155.00, "amount": 0.7, "total": 1.0 },
    { "price": 42160.00, "amount": 1.5, "total": 2.5 }
  ],
  "spread": 4.00,
  "spreadPercent": 0.0095,
  "timestamp": 1710000000000
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| bids | array | Buy orders (price descending) |
| asks | array | Sell orders (price ascending) |
| spread | number | Best ask - best bid |
| spreadPercent | number | Spread as % of mid price |

Each order level contains:
- `price` — Price level
- `amount` — Size at this level
- `total` — Cumulative size

## Examples

```bash
# Get top 20 levels
curl "http://localhost:3000/api/v1/orderbook?exchange=mexc&symbol=BTC/USDT&limit=20"
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Invalid limit | Limit must be 1-100 |
| 500 | Exchange error | Failed to fetch order book |
