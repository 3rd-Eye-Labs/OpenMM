# GET /trades

Get recent trades for a trading pair.

## Request

```
GET /api/v1/trades?exchange={exchange}&symbol={symbol}&limit={limit}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| exchange | string | ✅ | — | Exchange ID |
| symbol | string | ✅ | — | Trading pair |
| limit | number | ❌ | 50 | Number of trades (1-500) |

## Response

```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "trades": [
    {
      "id": "123456",
      "price": 42150.50,
      "amount": 0.15,
      "side": "buy",
      "timestamp": 1710000000000
    }
  ],
  "summary": {
    "count": 50,
    "buyCount": 28,
    "sellCount": 22,
    "buyVolume": 12.5,
    "sellVolume": 9.8,
    "avgPrice": 42148.25,
    "vwap": 42147.80
  },
  "timestamp": 1710000000000
}
```

### Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| count | number | Total trades |
| buyCount | number | Buy trades count |
| sellCount | number | Sell trades count |
| buyVolume | number | Total buy volume |
| sellVolume | number | Total sell volume |
| avgPrice | number | Simple average price |
| vwap | number | Volume-weighted average price |

## Examples

```bash
curl "http://localhost:3000/api/v1/trades?exchange=mexc&symbol=BTC/USDT&limit=100"
```
