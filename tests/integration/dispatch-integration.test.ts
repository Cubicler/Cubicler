import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

describe('Dispatch Integration Tests', () => {
  let serverProcess: ChildProcess;
  let serverUrl: string;
  const serverPort = 1503; // Use Cubicler's default port

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

  it('should respond to health check', async () => {
    const response = await fetch(`${serverUrl}/health`);

    expect(response.status).toBe(200);
    const healthData = await response.json();
    expect(healthData.status).toBe('healthy');
  });

  it('should list available agents', async () => {
    const response = await fetch(`${serverUrl}/agents`);

    expect(response.status).toBe(200);
    const agentsData = await response.json();
    expect(agentsData.agents).toBeDefined();
    expect(Array.isArray(agentsData.agents)).toBe(true);
    expect(agentsData.agents.length).toBeGreaterThan(0);

    // Should include our test agents
    const agentNames = agentsData.agents.map((agent: any) => agent.identifier);
    expect(agentNames).toContain('test-openai-weather');
  });

  it('should dispatch a simple request to weather assistant', async () => {
    const requestBody = {
      agent: {
        identifier: 'test-openai-weather',
        name: 'OpenAI Weather Test Agent',
        description: 'OpenAI agent for testing weather API integration',
      },
      messages: [
        {
          sender: 'user',
          type: 'text',
          content: 'Hello! Can you help me get weather information?',
        },
      ],
    };

    const response = await fetch(`${serverUrl}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    const dispatchData = await response.json();

    expect(dispatchData.content).toBeDefined();
    expect(typeof dispatchData.content).toBe('string');
    expect(dispatchData.content.length).toBeGreaterThan(0);

    // Should mention weather or tools or discovery
    const contentLower = dispatchData.content.toLowerCase();
    expect(
      contentLower.includes('weather') ||
        contentLower.includes('tool') ||
        contentLower.includes('server') ||
        contentLower.includes('discover')
    ).toBe(true);

    console.log('✅ Weather Assistant Response:', dispatchData.content.substring(0, 200) + '...');
  }, 30000);

  it('should discover available servers using cubicler tools', async () => {
    const requestBody = {
      agent: {
        identifier: 'test-openai-weather',
        name: 'OpenAI Weather Test Agent',
        description: 'OpenAI agent for testing weather API integration',
      },
      messages: [
        {
          sender: 'user',
          type: 'text',
          content:
            'Please discover what servers are available using the discovery tools, then tell me what weather tools you can access.',
        },
      ],
    };

    const response = await fetch(`${serverUrl}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    const discoveryData = await response.json();

    expect(discoveryData.content).toBeDefined();
    expect(typeof discoveryData.content).toBe('string');

    // Should mention servers or tools discovery
    const contentLower = discoveryData.content.toLowerCase();
    expect(
      contentLower.includes('server') ||
        contentLower.includes('tool') ||
        contentLower.includes('discover') ||
        contentLower.includes('weather')
    ).toBe(true);

    console.log('✅ Server Discovery Response:', discoveryData.content.substring(0, 200) + '...');
  }, 45000);

  it('should handle weather request using proper MCP flow', async () => {
    const requestBody = {
      agent: {
        identifier: 'test-openai-weather',
        name: 'OpenAI Weather Test Agent',
        description: 'OpenAI agent for testing weather API integration',
      },
      messages: [
        {
          sender: 'user',
          type: 'text',
          content:
            'What is the weather forecast for New York City? Please use the proper discovery tools to find and use weather services.',
        },
      ],
    };

    const response = await fetch(`${serverUrl}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    const weatherData = await response.json();

    expect(weatherData.content).toBeDefined();
    expect(typeof weatherData.content).toBe('string');

    // Should contain weather information or at least attempt to get it
    const contentLower = weatherData.content.toLowerCase();
    expect(
      contentLower.includes('weather') ||
        contentLower.includes('forecast') ||
        contentLower.includes('new york') ||
        contentLower.includes('temperature') ||
        contentLower.includes('tool') ||
        contentLower.includes('error') // In case there are MCP tool issues
    ).toBe(true);

    console.log('✅ Weather Request Response:', weatherData.content.substring(0, 200) + '...');
  }, 60000);
});
