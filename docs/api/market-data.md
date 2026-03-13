# Market Data

Real-time market data endpoints for supported exchanges.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | [/ticker](endpoints/ticker.md) | Get ticker for trading pair |
| GET | [/orderbook](endpoints/orderbook.md) | Get order book (bids/asks) |
| GET | [/trades](endpoints/trades.md) | Get recent trades |

## Common Parameters

All market data endpoints require:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exchange | string | ✅ | Exchange ID: `mexc`, `gateio`, `bitget`, `kraken` |
| symbol | string | ✅ | Trading pair in `BASE/QUOTE` format |

## Example

```bash
curl "http://localhost:3000/api/v1/ticker?exchange=mexc&symbol=BTC/USDT"
```

## Trading Pairs

Use standard format: `BASE/QUOTE`

Examples:
- `BTC/USDT`
- `ETH/USDT`
- `ADA/EUR` (Kraken)
- `INDY/ADA` (Cardano via Iris)
