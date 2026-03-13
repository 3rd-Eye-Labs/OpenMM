# DELETE /orders/:id

Cancel a specific order.

## Request

```
DELETE /api/v1/orders/{id}?exchange={exchange}&symbol={symbol}
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
  "success": true,
  "exchange": "mexc",
  "orderId": "123456",
  "message": "Order cancelled successfully"
}
```

## Examples

```bash
curl -X DELETE "http://localhost:3000/api/v1/orders/123456?exchange=mexc&symbol=BTC/USDT"
```

## Errors

| Code | Error | Description |
|------|-------|-------------|
| 404 | Order not found | Order doesn't exist |
| 500 | Cancel failed | Exchange rejected cancellation |
