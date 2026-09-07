# Cardano DEX

Cardano DEX integration with resilient token pricing and direct ADA pool discovery through Minswap and SundaeSwap.

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
2. Average available ADA/USDT prices from Binance, MEXC, CoinGecko, and Kraken
3. Calculate: TOKEN/USDT = TOKEN/ADA × ADA/USDT

## Data Sources

- Token prices query Minswap and SundaeSwap independently and liquidity-weight the successful responses.
- Pool discovery queries Minswap and SundaeSwap independently and returns normalized direct ADA pools.
