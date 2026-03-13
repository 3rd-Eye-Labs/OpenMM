# GET /balance

Get account balances for an exchange.

## Request

```
GET /api/v1/balance?exchange={exchange}&asset={asset}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID |
| asset | string | ❌ | Filter by asset (e.g., BTC, USDT) |

## Response

```json
{
  "exchange": "mexc",
  "balances": [
    {
      "asset": "USDT",
      "free": "10000.00",
      "used": "500.00",
      "total": "10500.00"
    },
    {
      "asset": "BTC",
      "free": "0.5",
      "used": "0.1",
      "total": "0.6"
    }
  ],
  "timestamp": 1710000000000
}
```

### Balance Fields

| Field | Type | Description |
|-------|------|-------------|
| asset | string | Asset symbol |
| free | string | Available balance |
| used | string | In orders/locked |
| total | string | free + used |

## Examples

```bash
# All balances (non-zero)
curl "http://localhost:3000/api/v1/balance?exchange=mexc"

# Specific asset
curl "http://localhost:3000/api/v1/balance?exchange=mexc&asset=BTC"
```

## Notes

- Zero balances are filtered out by default
- When filtering by asset, zero balances are included
