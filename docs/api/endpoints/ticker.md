# GET /ticker

Get current ticker data for a trading pair.

## Request

```
GET /api/v1/ticker?exchange={exchange}&symbol={symbol}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| symbol | string | ✅ | Trading pair (e.g., BTC/USDT) |

## Response

```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "last": 42150.50,
  "bid": 42148.00,
  "ask": 42152.00,
  "spread": 4.00,
  "spreadPercent": 0.0095,
  "baseVolume": 1234.56,
  "quoteVolume": 52000000.00,
  "timestamp": 1710000000000
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| last | number | Last traded price |
| bid | number | Best bid price |
| ask | number | Best ask price |
| spread | number | Absolute spread (ask - bid) |
| spreadPercent | number | Spread as % of mid price |
| baseVolume | number | 24h volume in base currency |
| quoteVolume | number | 24h volume in quote currency |
| timestamp | number | Data timestamp (ms) |

## Examples

### cURL

```bash
curl "http://localhost:3000/api/v1/ticker?exchange=mexc&symbol=BTC/USDT"
```

### JavaScript

```javascript
const response = await fetch(
  'http://localhost:3000/api/v1/ticker?exchange=mexc&symbol=BTC/USDT'
);
const ticker = await response.json();
console.log(`BTC price: $${ticker.last}`);
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Invalid exchange | Exchange not supported |
| 400 | Missing symbol | Symbol parameter required |
| 500 | Exchange error | Failed to fetch from exchange |
