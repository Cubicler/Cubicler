import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasRequiredIntegrationEnv } from './test-utils';
import { resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
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

    // Start the Cubicler server
    await startCubiclerServer();
  }, 60000); // Longer timeout for stdio agent startup

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
      }, 50000); // Longer timeout for stdio agents

      serverProcess = spawn('npm', ['start'], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      serverProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write('Server stdout: ' + chunk);

        // Look for server ready message
        if (chunk.includes('All services ready!')) {
          clearTimeout(timeout);
          setTimeout(resolve, 3000); // Wait a bit longer for full startup
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        process.stderr.write('Server stderr: ' + chunk);
      });

      serverProcess.on('exit', (code, signal) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(
            new Error(
              `Server exited with code ${code}, signal ${signal}. Output: ${output}, Error: ${errorOutput}`
            )
          );
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Failed to start server: ${error.message}. Output: ${output}, Error: ${errorOutput}`
          )
        );
      });
    });
  }

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
    expect(data.total).toBe(4);

    // Check that stdio agents are included
    const agentIdentifiers = data.agents.map((agent: any) => agent.identifier);
    expect(agentIdentifiers).toContain('test-stdio-openai-weather');
    expect(agentIdentifiers).toContain('test-stdio-openai-basic');

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
  }, 10000);

  it('should handle malformed requests to stdio agents', async () => {
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
  }, 10000);

  it('should compare stdio vs direct agent performance', async () => {
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

    expect(stdioResponse.ok).toBe(true);
    expect(directResponse.ok).toBe(true);

    const stdioData = await stdioResponse.json();
    const directData = await directResponse.json();

    expect(stdioData).toHaveProperty('content');
    expect(directData).toHaveProperty('content');

    console.log(`Stdio agent response time: ${stdioTime}ms`);
    console.log(`Direct agent response time: ${directTime}ms`);
    console.log(`Stdio agent response: "${stdioData.content}"`);
    console.log(`Direct agent response: "${directData.content}"`);

    // Both should respond reasonably quickly (under 30 seconds)
    expect(stdioTime).toBeLessThan(30000);
    expect(directTime).toBeLessThan(30000);
  }, 60000);
});
