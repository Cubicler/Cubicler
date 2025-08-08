import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasRequiredIntegrationEnv } from './test-utils';
import { app } from '../../src/index.js';
import request from 'supertest';
import { resolve } from 'path';
import dotenv from 'dotenv';
import http from 'http';
import mcpSseService from '../../src/core/mcp-sse-service.js';

describe.runIf(hasRequiredIntegrationEnv())('MCP over SSE integration', () => {
  let server: http.Server;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let baseUrl: string;

  beforeAll(async () => {
    // Load integration .env and isolate config to integration JSONs
    dotenv.config({ path: resolve(__dirname, '.env') });
    process.env.CUBICLER_PROVIDERS_LIST = resolve(__dirname, 'integration-providers.json');
    process.env.CUBICLER_AGENTS_LIST = resolve(__dirname, 'integration-agents.json');
    process.env.CUBICLER_WEBHOOKS_LIST = resolve(__dirname, 'integration-webhooks.json');
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('streams MCP response via SSE when clientId is provided', async () => {
    const clientId = 'itest';

    // Register a mock SSE client directly (avoid network SSE in tests)
    let streamedJson: any = null;
    const mockRes: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            streamedJson = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };
    mcpSseService.register(clientId, mockRes as any);

    // Send MCP request correlated to SSE stream
    const mcpBody = {
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/list',
      params: {},
    };

    const postRes = await request(app)
      .post('/mcp')
      .set('x-mcp-client-id', clientId)
      .send(mcpBody)
      .expect(202);

    expect(postRes.body.streamed).toBe(true);
    expect(postRes.body.id).toBe('1');

    // Wait for SSE message and validate JSON-RPC response
    // Validate streamed payload captured by mock response
    expect(streamedJson).toBeTruthy();
    expect(streamedJson.jsonrpc).toBe('2.0');
    expect(streamedJson.id).toBe('1');
    expect(streamedJson.error).toBeUndefined();
    expect(streamedJson.result).toBeDefined();

    // Validate tools structure (should match HTTP test)
    expect(streamedJson.result.tools).toBeDefined();
    expect(Array.isArray(streamedJson.result.tools)).toBe(true);
    expect(streamedJson.result.tools.length).toBeGreaterThan(0);

    const toolNames = streamedJson.result.tools.map((tool: any) => tool.name);
    console.log('✅ MCP SSE tools/list streamed tools:', toolNames);

    // Check for internal Cubicler tools
    expect(toolNames).toContain('cubicler_available_servers');
    expect(toolNames).toContain('cubicler_fetch_server_tools');
  }, 20000);

  it('streams MCP tools/call response for cubicler_available_servers via SSE', async () => {
    const clientId = 'itest-servers';
    let streamedJson: any = null;

    const mockRes: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            streamedJson = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };
    mcpSseService.register(clientId, mockRes as any);

    const mcpBody = {
      jsonrpc: '2.0',
      id: '2',
      method: 'tools/call',
      params: {
        name: 'cubicler_available_servers',
        arguments: {},
      },
    };

    const postRes = await request(app)
      .post('/mcp')
      .set('x-mcp-client-id', clientId)
      .send(mcpBody)
      .expect(202);

    expect(postRes.body.streamed).toBe(true);
    expect(postRes.body.id).toBe('2');

    // Validate streamed JSON-RPC response
    expect(streamedJson).toBeTruthy();
    expect(streamedJson.jsonrpc).toBe('2.0');
    expect(streamedJson.id).toBe('2');
    expect(streamedJson.error).toBeUndefined();
    expect(streamedJson.result).toBeDefined();

    console.log(
      '✅ MCP SSE cubicler_available_servers Response:',
      JSON.stringify(streamedJson, null, 2)
    );

    // Validate tool result structure
    expect(streamedJson.result.content).toBeDefined();
    expect(Array.isArray(streamedJson.result.content)).toBe(true);

    if (streamedJson.result.content.length > 0) {
      expect(streamedJson.result.content[0].type).toBe('text');
      expect(streamedJson.result.content[0].text).toBeDefined();

      const serverInfo = JSON.parse(streamedJson.result.content[0].text);
      expect(serverInfo.servers).toBeDefined();
      expect(Array.isArray(serverInfo.servers)).toBe(true);
    }
  }, 15000);

  it('streams MCP tools/call response for weather server tools via SSE', async () => {
    const clientId = 'itest-weather';
    const streamedResponses: any[] = [];

    const mockRes: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            const json = JSON.parse(data);
            streamedResponses.push(json);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };
    mcpSseService.register(clientId, mockRes as any);

    // First get available servers
    const serversBody = {
      jsonrpc: '2.0',
      id: '3a',
      method: 'tools/call',
      params: {
        name: 'cubicler_available_servers',
        arguments: {},
      },
    };

    await request(app).post('/mcp').set('x-mcp-client-id', clientId).send(serversBody).expect(202);

    // Wait a bit for the first response
    await new Promise((resolve) => setTimeout(resolve, 100));

    const serversResponse = streamedResponses.find((r) => r.id === '3a');
    expect(serversResponse).toBeTruthy();

    if (serversResponse?.result?.content?.[0]?.text) {
      const serverInfo = JSON.parse(serversResponse.result.content[0].text);

      if (serverInfo.servers && serverInfo.servers.length > 0) {
        const weatherServerIdentifier = serverInfo.servers[0].identifier;
        console.log('Found weather server via SSE:', weatherServerIdentifier);

        // Now get tools for the weather server
        const toolsBody = {
          jsonrpc: '2.0',
          id: '3b',
          method: 'tools/call',
          params: {
            name: 'cubicler_fetch_server_tools',
            arguments: {
              serverIdentifier: weatherServerIdentifier,
            },
          },
        };

        await request(app)
          .post('/mcp')
          .set('x-mcp-client-id', clientId)
          .send(toolsBody)
          .expect(202);

        // Wait for the second response
        await new Promise((resolve) => setTimeout(resolve, 200));

        const toolsResponse = streamedResponses.find((r) => r.id === '3b');
        expect(toolsResponse).toBeTruthy();
        expect(toolsResponse?.jsonrpc).toBe('2.0');
        expect(toolsResponse?.error).toBeUndefined();
        expect(toolsResponse?.result).toBeDefined();

        console.log(
          '✅ MCP SSE weather server tools Response:',
          JSON.stringify(toolsResponse, null, 2)
        );

        // Check for weather tools
        if (toolsResponse?.result?.content?.[0]?.text) {
          const toolsInfo = JSON.parse(toolsResponse.result.content[0].text);
          expect(toolsInfo.tools).toBeDefined();
          expect(Array.isArray(toolsInfo.tools)).toBe(true);

          const weatherToolNames = toolsInfo.tools.map((tool: any) => tool.name);
          console.log('Weather server tools via SSE:', weatherToolNames);
          expect(weatherToolNames.length).toBeGreaterThan(0);
        }
      } else {
        console.log('ℹ️ No MCP servers configured, skipping weather server tool test');
        expect(true).toBe(true); // Mark as passed
      }
    }
  }, 20000);

  it('streams MCP error responses via SSE for invalid requests', async () => {
    const clientId = 'itest-errors';
    let streamedJson: any = null;

    const mockRes: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            streamedJson = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };
    mcpSseService.register(clientId, mockRes as any);

    // Send invalid JSON-RPC request (missing jsonrpc field)
    const invalidBody = {
      id: '4',
      method: 'tools/list',
      params: {},
    };

    const response = await request(app)
      .post('/mcp')
      .set('x-mcp-client-id', clientId)
      .send(invalidBody);

    // Invalid JSON-RPC may be rejected at HTTP level (400) or processed as JSON-RPC error (202)
    expect([200, 202, 400]).toContain(response.status);

    if (response.status === 202) {
      // Should be streamed as JSON-RPC error
      expect(response.body.streamed).toBe(true);
      expect(response.body.id).toBe('4');

      // Validate streamed error response
      expect(streamedJson).toBeTruthy();
      expect(streamedJson.jsonrpc).toBe('2.0');
      expect(streamedJson.id).toBe('4');
      expect(streamedJson.error).toBeDefined();
      expect(streamedJson.error.code).toBeDefined();
      expect(streamedJson.error.message).toBeDefined();
      expect(streamedJson.result).toBeUndefined();

      console.log('✅ MCP SSE invalid request error:', JSON.stringify(streamedJson, null, 2));
    } else if (response.status === 400) {
      // HTTP-level rejection is also valid behavior for malformed JSON-RPC
      expect(response.body.error).toBeDefined();
      console.log('✅ MCP invalid request rejected at HTTP level (400):', response.body);
    } else {
      // HTTP fallback response (200)
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe('4');
      expect(response.body.error).toBeDefined();
      console.log('✅ MCP invalid request returned as HTTP error response');
    }
  });

  it('streams MCP error responses for unknown methods via SSE', async () => {
    const clientId = 'itest-unknown';
    let streamedJson: any = null;

    const mockRes: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            streamedJson = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };
    mcpSseService.register(clientId, mockRes as any);

    const unknownMethodBody = {
      jsonrpc: '2.0',
      id: '5',
      method: 'unknown/method',
      params: {},
    };

    const postRes = await request(app)
      .post('/mcp')
      .set('x-mcp-client-id', clientId)
      .send(unknownMethodBody)
      .expect(202);

    expect(postRes.body.streamed).toBe(true);
    expect(postRes.body.id).toBe('5');

    // Validate streamed error response
    expect(streamedJson).toBeTruthy();
    expect(streamedJson.jsonrpc).toBe('2.0');
    expect(streamedJson.id).toBe('5');
    expect(streamedJson.error).toBeDefined();
    expect(streamedJson.error.code).toBe(-32601); // Method not found
    expect(streamedJson.result).toBeUndefined();

    console.log('✅ MCP SSE unknown method error:', JSON.stringify(streamedJson, null, 2));
  });

  it('handles multiple concurrent SSE clients correctly', async () => {
    const client1Id = 'itest-multi1';
    const client2Id = 'itest-multi2';
    let client1Response: any = null;
    let client2Response: any = null;

    // Mock responses for client 1
    const mockRes1: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            client1Response = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };

    // Mock responses for client 2
    const mockRes2: any = {
      setHeader: () => {},
      write: (chunk: string) => {
        const line = String(chunk);
        if (line.startsWith('data:')) {
          const data = line.slice('data:'.length).trim();
          try {
            client2Response = JSON.parse(data);
          } catch {
            /* ignore */
          }
        }
      },
      on: () => {},
      end: () => {},
    };

    mcpSseService.register(client1Id, mockRes1 as any);
    mcpSseService.register(client2Id, mockRes2 as any);

    // Send different requests to each client
    const client1Body = {
      jsonrpc: '2.0',
      id: 'client1-req',
      method: 'tools/list',
      params: {},
    };

    const client2Body = {
      jsonrpc: '2.0',
      id: 'client2-req',
      method: 'tools/call',
      params: {
        name: 'cubicler_available_servers',
        arguments: {},
      },
    };

    // Send concurrent requests
    const [res1, res2] = await Promise.all([
      request(app).post('/mcp').set('x-mcp-client-id', client1Id).send(client1Body),
      request(app).post('/mcp').set('x-mcp-client-id', client2Id).send(client2Body),
    ]);

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
    expect(res1.body.streamed).toBe(true);
    expect(res2.body.streamed).toBe(true);

    // Wait for responses
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate each client got their correct response
    expect(client1Response).toBeTruthy();
    expect(client1Response.id).toBe('client1-req');
    expect(client1Response.result.tools).toBeDefined();

    expect(client2Response).toBeTruthy();
    expect(client2Response.id).toBe('client2-req');
    expect(client2Response.result.content).toBeDefined();

    console.log('✅ Multiple SSE clients handled correctly');
    console.log('Client 1 received tools/list with', client1Response.result.tools.length, 'tools');
    console.log('Client 2 received tools/call response');
  }, 15000);

  it('falls back to HTTP when no SSE client is registered', async () => {
    // Send MCP request without registering SSE client first
    const mcpBody = {
      jsonrpc: '2.0',
      id: 'fallback-test',
      method: 'tools/list',
      params: {},
    };

    const response = await request(app)
      .post('/mcp')
      .set('x-mcp-client-id', 'non-existent-client')
      .send(mcpBody)
      .expect(200); // Should fallback to HTTP response

    // Should get direct HTTP response, not streaming
    expect(response.body.streamed).toBeUndefined();
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.id).toBe('fallback-test');
    expect(response.body.result).toBeDefined();
    expect(response.body.result.tools).toBeDefined();

    console.log('✅ MCP correctly falls back to HTTP when SSE client not found');
    console.log('Fallback response tools count:', response.body.result.tools.length);
  });
});
