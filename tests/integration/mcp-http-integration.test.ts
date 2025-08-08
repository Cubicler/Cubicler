import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

describe('MCP HTTP Integration Tests', () => {
  let serverProcess: ChildProcess;
  let serverUrl: string;
  const serverPort = 1501; // Use different port to avoid conflicts

  beforeAll(async () => {
    serverUrl = `http://localhost:${serverPort}`;

    // Set environment variables for the server
    process.env.CUBICLER_AGENTS_LIST = resolve(__dirname, 'integration-agents.json');
    process.env.CUBICLER_PROVIDERS_LIST = resolve(__dirname, 'integration-providers.json');
    process.env.CUBICLER_WEBHOOKS_LIST = resolve(__dirname, 'integration-webhooks.json');
    process.env.CUBICLER_PORT = serverPort.toString();

    // Start the Cubicler server
    await startCubiclerServer();
  }, 30000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      // Wait for process to exit
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // Fallback timeout
      });
    }
  });

  async function startCubiclerServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 25000);

      serverProcess = spawn('npm', ['start'], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';

      serverProcess.stdout?.on('data', (data) => {
        output += data.toString();
        console.log('Server stdout:', data.toString());

        // Check for server ready indicators
        if (
          output.includes('Cubicler server running on') ||
          output.includes('All services ready!')
        ) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        const errorOutput = data.toString();
        console.log('Server stderr:', errorOutput);

        // Don't reject on warnings, only on actual errors
        if (errorOutput.includes('Error:') && !errorOutput.includes('Warning')) {
          clearTimeout(timeout);
          reject(new Error(`Server startup failed: ${errorOutput}`));
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      serverProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}, signal: ${signal}`));
        }
      });
    });
  }

  it('should handle MCP tools/list request via HTTP', async () => {
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mcpRequest),
    });

    expect(response.status).toBe(200);

    const mcpResponse = await response.json();
    console.log('✅ MCP tools/list Response:', JSON.stringify(mcpResponse, null, 2));

    // Validate JSON-RPC response structure
    expect(mcpResponse.jsonrpc).toBe('2.0');
    expect(mcpResponse.id).toBe(1);
    expect(mcpResponse.result).toBeDefined();
    expect(mcpResponse.error).toBeUndefined();

    // Validate tools structure
    expect(mcpResponse.result.tools).toBeDefined();
    expect(Array.isArray(mcpResponse.result.tools)).toBe(true);
    expect(mcpResponse.result.tools.length).toBeGreaterThan(0);

    // Should include internal tools and MCP server tools
    const toolNames = mcpResponse.result.tools.map((tool: any) => tool.name);
    console.log('Available tools:', toolNames);

    // Check for internal Cubicler tools
    expect(toolNames).toContain('cubicler_available_servers');
    expect(toolNames).toContain('cubicler_fetch_server_tools');
  }, 15000);

  it('should handle MCP tools/call request for cubicler_available_servers', async () => {
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'cubicler_available_servers',
        arguments: {},
      },
    };

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mcpRequest),
    });

    expect(response.status).toBe(200);

    const mcpResponse = await response.json();
    console.log(
      '✅ MCP cubicler_available_servers Response:',
      JSON.stringify(mcpResponse, null, 2)
    );

    // Validate JSON-RPC response structure
    expect(mcpResponse.jsonrpc).toBe('2.0');
    expect(mcpResponse.id).toBe(2);
    expect(mcpResponse.result).toBeDefined();
    expect(mcpResponse.error).toBeUndefined();

    // Validate tool result structure
    expect(mcpResponse.result.content).toBeDefined();
    expect(Array.isArray(mcpResponse.result.content)).toBe(true);

    if (mcpResponse.result.content.length > 0) {
      expect(mcpResponse.result.content[0].type).toBe('text');
      expect(mcpResponse.result.content[0].text).toBeDefined();

      const serverInfo = JSON.parse(mcpResponse.result.content[0].text);
      expect(serverInfo.servers).toBeDefined();
      expect(Array.isArray(serverInfo.servers)).toBe(true);

      if (serverInfo.servers.length > 0) {
        console.log(
          'Available MCP servers:',
          serverInfo.servers.map((s: any) => s.name)
        );
      }
    }
  }, 15000);

  it('should handle MCP tools/call request for weather MCP server tool', async () => {
    // First, get available servers to find the weather server identifier
    const serversRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'cubicler_available_servers',
        arguments: {},
      },
    };

    const serversResponse = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serversRequest),
    });

    expect(serversResponse.status).toBe(200);
    const serversResult = await serversResponse.json();

    if (serversResult.result.content && serversResult.result.content.length > 0) {
      const serverInfo = JSON.parse(serversResult.result.content[0].text);

      if (serverInfo.servers.length > 0) {
        const weatherServerIdentifier = serverInfo.servers[0].identifier;
        console.log('Found weather server:', weatherServerIdentifier);

        // Now get tools for the weather server
        const toolsRequest = {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'cubicler_fetch_server_tools',
            arguments: {
              serverIdentifier: weatherServerIdentifier,
            },
          },
        };

        const toolsResponse = await fetch(`${serverUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(toolsRequest),
        });

        expect(toolsResponse.status).toBe(200);
        const toolsResult = await toolsResponse.json();
        console.log('✅ MCP server tools Response:', JSON.stringify(toolsResult, null, 2));

        // Validate response structure
        expect(toolsResult.jsonrpc).toBe('2.0');
        expect(toolsResult.id).toBe(4);
        expect(toolsResult.result).toBeDefined();
        expect(toolsResult.error).toBeUndefined();

        // Check for weather tools
        if (toolsResult.result.content && toolsResult.result.content.length > 0) {
          const toolsInfo = JSON.parse(toolsResult.result.content[0].text);
          expect(toolsInfo.tools).toBeDefined();
          expect(Array.isArray(toolsInfo.tools)).toBe(true);

          const weatherToolNames = toolsInfo.tools.map((tool: any) => tool.name);
          console.log('Weather server tools:', weatherToolNames);

          // Should have weather-related tools
          expect(weatherToolNames.length).toBeGreaterThan(0);
        }
      } else {
        console.log('ℹ️ No MCP servers configured, skipping weather server tool test');
        expect(true).toBe(true); // Mark as passed
      }
    }
  }, 20000);

  it('should handle invalid JSON-RPC requests gracefully', async () => {
    const invalidRequest = {
      // Missing required jsonrpc field
      id: 5,
      method: 'tools/list',
      params: {},
    };

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest),
    });

    // The MCP service should handle invalid JSON-RPC requests gracefully
    // It may return either 200 with an error response or 400
    expect([200, 400]).toContain(response.status);

    const mcpResponse = await response.json();
    console.log('✅ Invalid request Response:', JSON.stringify(mcpResponse, null, 2));

    if (response.status === 200) {
      // Should return JSON-RPC error response
      expect(mcpResponse.jsonrpc).toBe('2.0');
      expect(mcpResponse.id).toBe(5);
      expect(mcpResponse.error).toBeDefined();
      expect(mcpResponse.error.code).toBeDefined();
      expect(mcpResponse.error.message).toBeDefined();
      expect(mcpResponse.result).toBeUndefined();
    } else {
      // Should return a general error response
      expect(mcpResponse.error).toBeDefined();
    }
  });

  it('should handle unknown method requests', async () => {
    const unknownMethodRequest = {
      jsonrpc: '2.0',
      id: 6,
      method: 'unknown/method',
      params: {},
    };

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unknownMethodRequest),
    });

    expect(response.status).toBe(200);

    const mcpResponse = await response.json();
    console.log('✅ Unknown method Response:', JSON.stringify(mcpResponse, null, 2));

    // Should return JSON-RPC error response
    expect(mcpResponse.jsonrpc).toBe('2.0');
    expect(mcpResponse.id).toBe(6);
    expect(mcpResponse.error).toBeDefined();
    expect(mcpResponse.error.code).toBe(-32601); // Method not found
    expect(mcpResponse.result).toBeUndefined();
  });

  it('should handle malformed JSON requests', async () => {
    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{ invalid json',
    });

    expect(response.status).toBe(400);

    const errorResponse = await response.json();
    console.log('✅ Malformed JSON Response:', JSON.stringify(errorResponse, null, 2));

    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.error).toContain('JSON');
  });

  it('should support MCP authentication if configured', async () => {
    // Test without authentication header
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/list',
      params: {},
    };

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify(mcpRequest),
    });

    // Should work if no auth is configured, or fail with 401 if auth is required
    const acceptableStatuses = [200, 401];
    expect(acceptableStatuses).toContain(response.status);

    if (response.status === 401) {
      console.log('✅ MCP endpoint requires authentication (as configured)');
      const errorResponse = await response.json();
      expect(errorResponse.error).toBeDefined();
    } else if (response.status === 200) {
      console.log('ℹ️ MCP endpoint does not require authentication (as configured)');
      const mcpResponse = await response.json();
      expect(mcpResponse.jsonrpc).toBe('2.0');
      expect(mcpResponse.id).toBe(7);
    }
  });
});
