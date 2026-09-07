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
  "confidence": 0.9,
  "sources": [
    {
      "id": "minswap",
      "name": "Minswap",
      "exchange": "cardano"
    },
    {
      "id": "sundaeswap",
      "name": "SundaeSwap",
      "exchange": "cardano"
    },
    {
      "id": "cex-ada",
      "name": "CEX ADA/USDT",
      "exchange": "multi-cex-3"
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
| 500 | Price fetch failed | Both Cardano DEX providers or all ADA/USD sources are unavailable |

The price service queries Minswap and SundaeSwap independently. If one DEX is
temporarily unavailable, the other can still provide the TOKEN/ADA leg. Pool
discovery is a separate endpoint and retains its legacy Iris integration.
