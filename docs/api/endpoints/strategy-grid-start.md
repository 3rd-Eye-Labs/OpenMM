# POST /strategy/grid

Start a new grid trading strategy.

## Request

```
POST /api/v1/strategy/grid
Content-Type: application/json
```

### Body

```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "lowerPrice": 40000,
  "upperPrice": 44000,
  "gridLevels": 10,
  "orderSize": 100
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| symbol | string | ✅ | Trading pair |
| lowerPrice | number | ✅ | Lower price bound |
| upperPrice | number | ✅ | Upper price bound |
| gridLevels | number | ✅ | Number of grid levels (2-100) |
| orderSize | number | ✅ | Size per order in quote currency |
| gridSpacing | number | ❌ | Custom spacing (auto-calculated if omitted) |

## Response

```json
{
  "id": "grid-mexc-BTC-USDT-1710000000000",
  "status": "running",
  "message": "Grid strategy started successfully",
  "config": {
    "exchange": "mexc",
    "symbol": "BTC/USDT",
    "lowerPrice": 40000,
    "upperPrice": 44000,
    "gridLevels": 10,
    "orderSize": 100,
    "gridSpacing": 400
  }
}
```

## Examples

```bash
curl -X POST "http://localhost:3000/api/v1/strategy/grid" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "mexc",
    "symbol": "BTC/USDT",
    "lowerPrice": 40000,
    "upperPrice": 44000,
    "gridLevels": 10,
    "orderSize": 100
  }'
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Invalid range | lowerPrice >= upperPrice |
| 400 | Invalid levels | gridLevels < 2 or > 100 |
| 500 | Start failed | Strategy initialization failed |
