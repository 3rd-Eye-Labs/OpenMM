# GET /strategy/grid/status

Get status of grid strategies.

## Request

```
GET /api/v1/strategy/grid/status?id={id}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | ❌ | Strategy ID (returns all if omitted) |

## Response

```json
{
  "strategies": [
    {
      "id": "grid-mexc-BTC-USDT-1710000000000",
      "status": "running",
      "exchange": "mexc",
      "symbol": "BTC/USDT",
      "lowerPrice": 40000,
      "upperPrice": 44000,
      "gridLevels": 10,
      "orderSize": 100,
      "openOrders": 8,
      "filledOrders": 4,
      "profit": 22.50,
      "startedAt": 1710000000000,
      "runningTime": 1800000
    }
  ],
  "count": 1
}
```

### Status Values

| Status | Description |
|--------|-------------|
| idle | Initialized but not started |
| running | Actively trading |
| stopped | Manually stopped |
| error | Error occurred |

## Examples

```bash
# Get all strategies
curl "http://localhost:3000/api/v1/strategy/grid/status"

# Get specific strategy
curl "http://localhost:3000/api/v1/strategy/grid/status?id=grid-mexc-BTC-USDT-xxx"
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 404 | Not found | Strategy ID doesn't exist |
