# POST /orders

Create a new order.

## Request

```
POST /api/v1/orders
Content-Type: application/json
```

### Body

```json
{
  "exchange": "mexc",
  "symbol": "BTC/USDT",
  "side": "buy",
  "type": "limit",
  "amount": 0.1,
  "price": 40000
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| symbol | string | ✅ | Trading pair |
| side | string | ✅ | `buy` or `sell` |
| type | string | ✅ | `limit` or `market` |
| amount | number | ✅ | Order size in base currency |
| price | number | ⚠️ | Required for limit orders |

## Response

```json
{
  "success": true,
  "exchange": "mexc",
  "order": {
    "id": "123456",
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "price": 40000,
    "amount": 0.1,
    "filled": 0,
    "remaining": 0.1,
    "status": "open",
    "timestamp": 1710000000000
  }
}
```

## Examples

### Limit Order

```bash
curl -X POST "http://localhost:3000/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "mexc",
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "amount": 0.1,
    "price": 40000
  }'
```

### Market Order

```bash
curl -X POST "http://localhost:3000/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "mexc",
    "symbol": "BTC/USDT",
    "side": "sell",
    "type": "market",
    "amount": 0.1
  }'
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 400 | Invalid side | Side must be buy or sell |
| 400 | Invalid type | Type must be limit or market |
| 400 | Price required | Limit orders need price |
| 500 | Order failed | Exchange rejected order |
