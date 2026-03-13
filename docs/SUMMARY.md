# Table of contents

## Getting Started

* [Introduction](README.md)
* [Installation](getting-started/installation.md)
* [Quick Start](getting-started/quick-start.md)

## CLI Reference

* [CLI Overview](CLI.md)
* [Trading Strategies](TRADING_STRATEGIES.md)

## API Reference

* [API Overview](api/overview.md)
* [Authentication](api/authentication.md)
* [Market Data](api/market-data.md)
  * [GET /ticker](api/endpoints/ticker.md)
  * [GET /orderbook](api/endpoints/orderbook.md)
  * [GET /trades](api/endpoints/trades.md)
* [Account](api/account.md)
  * [GET /balance](api/endpoints/balance.md)
* [Orders](api/orders.md)
  * [GET /orders](api/endpoints/orders-list.md)
  * [GET /orders/:id](api/endpoints/orders-get.md)
  * [POST /orders](api/endpoints/orders-create.md)
  * [DELETE /orders/:id](api/endpoints/orders-cancel.md)
  * [DELETE /orders](api/endpoints/orders-cancel-all.md)
* [Strategy](api/strategy.md)
  * [POST /strategy/grid](api/endpoints/strategy-grid-start.md)
  * [DELETE /strategy/grid](api/endpoints/strategy-grid-stop.md)
  * [GET /strategy/grid/status](api/endpoints/strategy-grid-status.md)
* [Cardano DEX](api/cardano.md)
  * [GET /cardano/price/:symbol](api/endpoints/cardano-price.md)
  * [GET /cardano/pools/:symbol](api/endpoints/cardano-pools.md)
* [Price Comparison](api/price-comparison.md)
  * [GET /price/compare](api/endpoints/price-compare.md)

## Guides

* [Cardano Tokens](guides/CARDANO_TOKENS.md)
* [Grid Strategy](guides/GRID_STRATEGY.md)

## Resources

* [Contributing](CONTRIBUTING.md)
* [GitHub](https://github.com/3rd-Eye-Labs/OpenMM)
