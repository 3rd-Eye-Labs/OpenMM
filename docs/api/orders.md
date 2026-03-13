# Orders

Order management endpoints for listing, creating, and canceling orders.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | [/orders](endpoints/orders-list.md) | List open orders |
| GET | [/orders/:id](endpoints/orders-get.md) | Get order by ID |
| POST | [/orders](endpoints/orders-create.md) | Create new order |
| DELETE | [/orders/:id](endpoints/orders-cancel.md) | Cancel order |
| DELETE | [/orders](endpoints/orders-cancel-all.md) | Cancel all orders |

## Order Types

| Type | Description |
|------|-------------|
| limit | Order at specific price |
| market | Order at current market price |

## Order Sides

| Side | Description |
|------|-------------|
| buy | Buy/long order |
| sell | Sell/short order |

## Order Status

| Status | Description |
|--------|-------------|
| open | Order is active |
| filled | Order fully executed |
| partially_filled | Order partially executed |
| canceled | Order was canceled |
