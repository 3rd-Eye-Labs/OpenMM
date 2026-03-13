# Strategy

Grid trading strategy management endpoints.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | [/strategy/grid](endpoints/strategy-grid-start.md) | Start grid strategy |
| DELETE | [/strategy/grid](endpoints/strategy-grid-stop.md) | Stop grid strategy |
| GET | [/strategy/grid/status](endpoints/strategy-grid-status.md) | Get strategy status |
| GET | /strategy/grid/list | List active strategies |

## What is Grid Trading?

Grid trading places buy and sell orders at regular price intervals (the "grid"). When price moves up, sell orders execute. When price moves down, buy orders execute. This captures profit from price oscillation.

## Grid Parameters

| Parameter | Description |
|-----------|-------------|
| lowerPrice | Bottom of the grid range |
| upperPrice | Top of the grid range |
| gridLevels | Number of grid lines (more = tighter spacing) |
| orderSize | Size per order in quote currency |

## Example Setup

A grid from $40,000 to $44,000 with 10 levels creates orders every $400:
- Buy orders: $40,000, $40,400, $40,800, ...
- Sell orders: $42,800, $43,200, $43,600, $44,000

See [Grid Strategy Guide](../guides/GRID_STRATEGY.md) for advanced configuration.
