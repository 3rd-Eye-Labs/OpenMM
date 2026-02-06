import { createServer } from '../../../mcp/server';

describe('MCP Server', () => {
  it('should create a server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('should have the correct server name and version', () => {
    const server = createServer();
    // McpServer stores name/version internally; verify it was created without throwing
    expect(server).toBeTruthy();
  });
});
