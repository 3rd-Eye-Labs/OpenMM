# GET /cardano/pools/:symbol

Discover liquidity pools for a Cardano token.

## Request

```
GET /api/v1/cardano/pools/{symbol}?minLiquidity={minLiquidity}&limit={limit}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | ✅ | — | Token symbol |
| minLiquidity | number | ❌ | 0 | Minimum TVL in ADA |
| limit | number | ❌ | 10 | Max pools (1-50) |

## Response

```json
{
  "symbol": "INDY",
  "pools": [
    {
      "dex": "Minswap",
      "identifier": "pool-abc123",
      "tvl": 500000,
      "price": 1.85,
      "reserveA": 270000,
      "reserveB": 500000,
      "tokenA": "INDY",
      "tokenB": "ADA"
    },
    {
      "dex": "SundaeSwap",
      "identifier": "pool-def456",
      "tvl": 250000,
      "price": 1.84,
      "reserveA": 136000,
      "reserveB": 250000,
      "tokenA": "INDY",
      "tokenB": "ADA"
    }
  ],
  "count": 2,
  "timestamp": "2026-03-14T00:00:00.000Z"
}
```

### Pool Fields

| Field | Type | Description |
|-------|------|-------------|
| dex | string | DEX name |
| identifier | string | Pool identifier |
| tvl | number | Total value locked (ADA) |
| price | number | Token price in ADA |
| reserveA | number | Reserve of token A |
| reserveB | number | Reserve of token B |
| tokenA | string | First token symbol |
| tokenB | string | Second token symbol |

## Examples

```bash
# Get top 5 INDY pools
curl "http://localhost:3000/api/v1/cardano/pools/INDY?limit=5"

# Filter by TVL
curl "http://localhost:3000/api/v1/cardano/pools/SNEK?minLiquidity=100000"
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Unsupported token | Token not in supported list |
| 500 | Discovery failed | Iris API error |
