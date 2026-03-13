# DELETE /strategy/grid

Stop a running grid strategy.

## Request

```
DELETE /api/v1/strategy/grid
Content-Type: application/json
```

### Body

```json
{
  "id": "grid-mexc-BTC-USDT-1710000000000",
  "cancelOrders": true
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| id | string | ✅ | — | Strategy ID |
| cancelOrders | boolean | ❌ | true | Cancel all open orders |

## Response

```json
{
  "success": true,
  "id": "grid-mexc-BTC-USDT-1710000000000",
  "message": "Strategy stopped and orders cancelled",
  "summary": {
    "runningTime": 3600000,
    "filledOrders": 12,
    "profit": 45.50
  }
}
```

### Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| runningTime | number | Running time in ms |
| filledOrders | number | Total orders filled |
| profit | number | Estimated profit |

## Examples

```bash
curl -X DELETE "http://localhost:3000/api/v1/strategy/grid" \
  -H "Content-Type: application/json" \
  -d '{"id": "grid-mexc-BTC-USDT-1710000000000"}'
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 404 | Not found | Strategy ID doesn't exist |
