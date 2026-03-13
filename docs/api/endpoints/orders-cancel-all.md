# DELETE /orders

Cancel all open orders on an exchange.

## Request

```
DELETE /api/v1/orders?exchange={exchange}&symbol={symbol}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| symbol | string | ❌ | Filter by trading pair |

## Response

```json
{
  "success": true,
  "exchange": "mexc",
  "cancelled": 5,
  "message": "Cancelled 5 orders"
}
```

## Examples

```bash
# Cancel all orders
curl -X DELETE "http://localhost:3000/api/v1/orders?exchange=mexc"

# Cancel orders for specific pair
curl -X DELETE "http://localhost:3000/api/v1/orders?exchange=mexc&symbol=BTC/USDT"
```

## ⚠️ Warning

This operation cancels all matching orders immediately. Use with caution.
