# Cardano DEX

Cardano DEX integration via Iris Protocol for token pricing and pool discovery.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | [/cardano/price/:symbol](endpoints/cardano-price.md) | Get token price |
| GET | [/cardano/pools/:symbol](endpoints/cardano-pools.md) | Discover liquidity pools |

## Supported Tokens

| Symbol | Name | Policy ID |
|--------|------|-----------|
| INDY | Indigo | 533bb94a... |
| SNEK | Snek | 279c909f... |
| NIGHT | Night | 0691b2fe... |
| MIN | Minswap | 29d222ce... |

## Price Calculation

Prices are calculated as TOKEN/USDT via ADA bridge:
1. Fetch TOKEN/ADA price from Cardano DEXs
2. Fetch ADA/USDT from CEX (Kraken)
3. Calculate: TOKEN/USDT = TOKEN/ADA × ADA/USDT

## Data Source

All data comes from [Iris Protocol](https://iris.indigoprotocol.io), which aggregates liquidity from:
- Minswap
- SundaeSwap
- WingRiders
- Spectrum
- MuesliSwap
- VyFinance
