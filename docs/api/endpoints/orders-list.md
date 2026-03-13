# GET /orders

List open orders on an exchange.

## Request

```
GET /api/v1/orders?exchange={exchange}&symbol={symbol}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| symbol | string | ❌ | Filter by trading pair |

## Response

```json
{
  "exchange": "mexc",
  "orders": [
    {
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
  ],
  "count": 1
}
```

## Examples

```bash
# All open orders
curl "http://localhost:3000/api/v1/orders?exchange=mexc"

# Filter by symbol
curl "http://localhost:3000/api/v1/orders?exchange=mexc&symbol=BTC/USDT"
```
