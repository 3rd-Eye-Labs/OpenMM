import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools(server: McpServer): void {
  // Tools will be registered here by subsequent tasks:
  // - Market data tools (get_ticker, get_orderbook, get_trades)
  // - Balance & account tools (get_balance, list_orders)
  // - Cardano price aggregation tools (get_cardano_price, discover_pools)
  // - Order management tools (place_order, cancel_order)
  // - Grid strategy tools (start_grid_strategy, stop_strategy, get_strategy_status)
}
