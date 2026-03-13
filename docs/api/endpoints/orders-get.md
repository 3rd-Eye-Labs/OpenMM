# GET /orders/:id

Get details of a specific order.

## Request

```
GET /api/v1/orders/{id}?exchange={exchange}&symbol={symbol}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | ✅ | Order ID (path) |
| exchange | string | ✅ | Exchange ID |
| symbol | string | ✅ | Trading pair |

## Response

```json
{
  "exchange": "mexc",
  "order": {
    "id": "123456",
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "price": 40000,
    "amount": 0.1,
    "filled": 0.05,
    "remaining": 0.05,
    "status": "partially_filled",
    "timestamp": 1710000000000
  }
}
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 404 | Order not found | Order ID doesn't exist |
