# GET /cardano/price/:symbol

Get aggregated price for a Cardano token.

## Request

```
GET /api/v1/cardano/price/{symbol}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | ✅ | Token symbol (INDY, SNEK, NIGHT, MIN) |

## Response

```json
{
  "symbol": "INDY/USDT",
  "price": 0.52,
  "confidence": 0.95,
  "sources": [
    {
      "id": "minswap-pool-1",
      "name": "Minswap INDY/ADA",
      "exchange": "cardano"
    },
    {
      "id": "sundae-pool-1",
      "name": "SundaeSwap INDY/ADA",
      "exchange": "cardano"
    }
  ],
  "timestamp": "2026-03-14T00:00:00.000Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | Trading pair (TOKEN/USDT) |
| price | number | Price in USDT |
| confidence | number | Confidence score (0-1) |
| sources | array | Price sources used |
| timestamp | string | ISO 8601 timestamp |

## Examples

```bash
# Get INDY price
curl "http://localhost:3000/api/v1/cardano/price/INDY"

# Case insensitive
curl "http://localhost:3000/api/v1/cardano/price/snek"
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Unsupported token | Token not in supported list |
| 500 | Price fetch failed | Iris API error |
