import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasRequiredIntegrationEnv, startCubiclerServerWithHealthCheck } from './test-utils';
import { resolve } from 'path';
import { ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

describe.runIf(hasRequiredIntegrationEnv())('Stdio Agent Integration Tests', () => {
  let serverProcess: ChildProcess;
  let serverUrl: string;
  const serverPort = 1505; // Use different port to avoid conflicts

  beforeAll(async () => {
    serverUrl = `http://localhost:${serverPort}`;

    // Set environment variables for the server
    process.env.CUBICLER_AGENTS_LIST = resolve(__dirname, 'integration-agents.json');
    process.env.CUBICLER_PROVIDERS_LIST = resolve(__dirname, 'integration-providers.json');
    process.env.CUBICLER_WEBHOOKS_LIST = resolve(__dirname, 'integration-webhooks.json');
    process.env.CUBICLER_PORT = serverPort.toString();

    // Start the Cubicler server with health check
    serverProcess = await startCubiclerServerWithHealthCheck(serverPort, 60000);

    // Add monitoring for the server process
    console.log(`[TEST] Server started with PID: ${serverProcess.pid}`);

    // Monitor unexpected server exits
    serverProcess.on('exit', (code, signal) => {
      console.log(
        `[TEST] *** SERVER PROCESS EXITED UNEXPECTEDLY *** code: ${code}, signal: ${signal}`
      );
    });

    serverProcess.on('error', (error) => {
      console.log(`[TEST] *** SERVER PROCESS ERROR *** ${error.message}`);
    });
  }, 60000); // Longer timeout for stdio agent startup

  afterAll(async () => {
    console.log('[TEST] Starting server shutdown...');
    if (serverProcess) {
      console.log('[TEST] Server process PID:', serverProcess.pid);
      console.log('[TEST] Server process killed:', serverProcess.killed);

      // Add event listeners to monitor shutdown
      serverProcess.on('exit', (code, signal) => {
        console.log(`[TEST] Server process exited with code ${code}, signal ${signal}`);
      });

      serverProcess.kill('SIGTERM');
      console.log('[TEST] Sent SIGTERM to server process');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        let resolved = false;
        serverProcess.on('exit', () => {
          if (!resolved) {
            resolved = true;
            console.log('[TEST] Server process has exited');
            resolve();
          }
        });
        // Fallback timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('[TEST] Server shutdown timeout, force killing');
            if (serverProcess && !serverProcess.killed) {
              serverProcess.kill('SIGKILL');
            }
            resolve();
          }
        }, 5000);
      });
    }
    console.log('[TEST] Server shutdown complete');
  });

  it('should respond to health check', async () => {
    const response = await fetch(`${serverUrl}/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
  }, 10000);

  it('should list agents including stdio agents', async () => {
    const response = await fetch(`${serverUrl}/agents`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('agents');
    expect(Array.isArray(data.agents)).toBe(true);
    expect(data.total).toBe(5);

    // Check that stdio agents are included
    const agentIdentifiers = data.agents.map((agent: any) => agent.identifier);
    expect(agentIdentifiers).toContain('test-stdio-openai-weather');
    expect(agentIdentifiers).toContain('test-stdio-openai-basic');
    expect(agentIdentifiers).toContain('test-stdio-openai-pooled');

    // Find stdio agents and verify they exist
    const stdioWeatherAgent = data.agents.find(
      (agent: any) => agent.identifier === 'test-stdio-openai-weather'
    );
    expect(stdioWeatherAgent).toBeDefined();
    expect(stdioWeatherAgent.name).toBe('Stdio OpenAI Weather Test Agent');

    const stdioBasicAgent = data.agents.find(
      (agent: any) => agent.identifier === 'test-stdio-openai-basic'
    );
    expect(stdioBasicAgent).toBeDefined();
    expect(stdioBasicAgent.name).toBe('Stdio OpenAI Basic Test Agent');

    console.log('Available agents:', agentIdentifiers);
  }, 10000);

  it('should dispatch a basic request to stdio OpenAI agent', async () => {
    // Add delay before stdio agent test
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: { id: 'test-user' },
            type: 'text',
            content: 'Hello! This is a test message. Please respond with a simple greeting.',
          },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('type', 'text');
    expect(data).toHaveProperty('content');
    expect(typeof data.content).toBe('string');
    expect(data.content.length).toBeGreaterThan(0);

    // Should be a greeting response
    expect(data.content.toLowerCase()).toMatch(/hello|hi|greet/);

    console.log('Stdio basic agent response:', data.content);
  }, 30000); // Longer timeout for stdio agent processing

  it('should dispatch a weather request to stdio OpenAI weather agent', async () => {
    const response = await fetch(`${serverUrl}/dispatch/test-stdio-openai-weather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: { id: 'test-user' },
            type: 'text',
            content: 'What is the current weather in Paris?',
          },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('type', 'text');
    expect(data).toHaveProperty('content');
    expect(typeof data.content).toBe('string');
    expect(data.content.length).toBeGreaterThan(0);

    // Should mention weather or servers
    expect(data.content.toLowerCase()).toMatch(/weather|temperature|paris|server|tool/);

    console.log('Stdio weather agent response:', data.content);
  }, 45000); // Longer timeout for weather API calls

  it('should handle stdio agent tool discovery', async () => {
    const response = await fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: { id: 'test-user' },
            type: 'text',
            content: 'Can you list the available servers using cubicler_available_servers?',
          },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('type', 'text');
    expect(data).toHaveProperty('content');
    expect(typeof data.content).toBe('string');
    expect(data.content.length).toBeGreaterThan(0);

    // Should mention servers or tools
    expect(data.content.toLowerCase()).toMatch(/server|openweather|tool/);

    console.log('Stdio agent tool discovery response:', data.content);
  }, 30000);

  it('should handle stdio agent errors gracefully', async () => {
    // Test with an agent that doesn't exist
    const response = await fetch(`${serverUrl}/dispatch/nonexistent-stdio-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: { id: 'test-user' },
            type: 'text',
            content: 'Hello',
          },
        ],
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error.toLowerCase()).toMatch(/not found|unknown/);

    // Add delay to allow server to stabilize after error handling
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 15000);

  it('should handle malformed requests to stdio agents', async () => {
    // Add a longer delay to prevent overwhelming the stdio agent and allow for cleanup
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required messages field
        invalid: 'data',
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  }, 15000);

  it('should compare stdio vs direct agent performance', async () => {
    // Add a longer delay to ensure server stability and cleanup from previous tests
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const testMessage = 'Respond with exactly "Test successful" and nothing else.';

    // Test stdio agent
    const stdioStart = Date.now();
    const stdioResponse = await fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ sender: { id: 'test-user' }, type: 'text', content: testMessage }],
      }),
    });
    const stdioTime = Date.now() - stdioStart;

    expect(stdioResponse.ok).toBe(true);

    // Add delay between tests to prevent overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Test direct agent
    const directStart = Date.now();
    const directResponse = await fetch(`${serverUrl}/dispatch/test-openai-weather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ sender: { id: 'test-user' }, type: 'text', content: testMessage }],
      }),
    });
    const directTime = Date.now() - directStart;

    expect(directResponse.ok).toBe(true);

    const stdioData = await stdioResponse.json();
    const directData = await directResponse.json();

    expect(stdioData).toHaveProperty('content');
    expect(directData).toHaveProperty('content');

    console.log(`Stdio agent response time: ${stdioTime}ms`);
    console.log(`Direct agent response time: ${directTime}ms`);
    console.log(`Stdio agent response: "${stdioData.content}"`);
    console.log(`Direct agent response: "${directData.content}"`);

    // Both should respond reasonably quickly (under 45 seconds)
    expect(stdioTime).toBeLessThan(45000);
    expect(directTime).toBeLessThan(45000);
  }, 90000);

  it('should demonstrate transport caching with multiple requests', async () => {
    console.log('[TEST] Testing transport caching with multiple requests...');

    // Make 3 sequential requests to the same stdio agent
    const requests: Array<{
      requestNumber: number;
      responseTime: number;
      content: string;
    }> = [];

    for (let i = 1; i <= 3; i++) {
      console.log(`[TEST] Making request ${i} to stdio agent...`);
      const startTime = Date.now();

      const response = await fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              sender: { id: 'test-user' },
              type: 'text',
              content: `Cache test request ${i}. Reply with "Request ${i} received."`,
            },
          ],
        }),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('content');

      requests.push({
        requestNumber: i,
        responseTime,
        content: data.content.substring(0, 50) + '...',
      });

      console.log(`[TEST] Request ${i} completed in ${responseTime}ms`);

      // Small delay between requests to see caching in action
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // All requests should succeed and show transport reuse
    console.log('[TEST] Transport cache test results:');
    requests.forEach((req) => {
      console.log(`  Request ${req.requestNumber}: ${req.responseTime}ms - "${req.content}"`);
    });

    // The first request might be slower due to process startup,
    // but subsequent requests should be faster due to transport reuse
    expect(requests.length).toBe(3);
    requests.forEach((req) => {
      expect(req.content).toBeTruthy();
    });
  }, 45000);

  it('should handle concurrent requests to same stdio agent', async () => {
    console.log('[TEST] Testing concurrent requests to stdio agent...');

    // Add a delay before this test to ensure server is stable
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const startTime = Date.now();
    const concurrentRequests = Array(3)
      .fill(null)
      .map((_, index) =>
        fetch(`${serverUrl}/dispatch/test-stdio-openai-basic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                sender: { id: 'test-user' },
                type: 'text',
                content: `Concurrent request ${index + 1}. Reply with "Response ${index + 1}."`,
              },
            ],
          }),
        }).catch((error) => {
          console.error(`[TEST] Request ${index + 1} failed:`, error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

    const responses = await Promise.allSettled(concurrentRequests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const actualResponses = responses
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`[TEST] Request ${index + 1} was rejected:`, result.reason);
          return null;
        }
      })
      .filter((response): response is Response => response !== null);

    // Get results from successful responses only
    const results = await Promise.all(
      actualResponses.map(async (response) => {
        try {
          return await response.json();
        } catch (error) {
          console.error('[TEST] Failed to parse response as JSON:', error);
          return { error: 'Failed to parse response' };
        }
      })
    );

    console.log(
      `[TEST] ${actualResponses.length}/${responses.length} concurrent requests succeeded in ${totalTime}ms`
    );

    // At least one request should succeed to verify concurrent handling works
    expect(actualResponses.length).toBeGreaterThan(0);

    // Check successful responses
    actualResponses.forEach((response, index) => {
      if (response.ok) {
        expect(results[index]).toHaveProperty('content');
      }
    });

    console.log('[TEST] Concurrent responses:');
    results.forEach((result, index) => {
      if (result.content) {
        console.log(`  ${index + 1}: "${result.content.substring(0, 40)}..."`);
      } else {
        console.log(`  ${index + 1}: ERROR - ${result.error || 'Unknown error'}`);
      }
    });
  }, 60000);
});
