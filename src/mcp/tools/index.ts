import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMarketDataTools } from './market-data';

export function registerTools(server: McpServer): void {
  registerMarketDataTools(server);
}
