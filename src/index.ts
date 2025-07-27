import express, { Request, Response } from 'express';

import promptService from './core/prompt-service.js';
import agentService from './core/agent-service.js';
import providerService from './core/provider-service.js';
import executionService from './core/execution-service.js';
import callService from './core/call-service.js';
import type { CallRequest, FunctionCallParameters, HealthStatus } from './model/types.js';

// Create Express app
const app = express();
app.use(express.json());

// GET /prompt/:agentName endpoint
app.get('/prompt/:agentName', async (req: Request, res: Response) => {
  const { agentName } = req.params;

  if (!agentName) {
    console.log(`⚠️ [Server] GET /prompt - Missing agent name`);
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }

  console.log(`📝 [Server] GET /prompt/${agentName} - Fetching prompt`);

  try {
    const prompt = await promptService.getPrompt(agentName);
    console.log(`✅ [Server] GET /prompt/${agentName} - Success (${prompt.length} chars)`);
    res.json({ prompt });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] GET /prompt/${agentName} - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// GET /agents endpoint
app.get('/agents', async (req: Request, res: Response) => {
  console.log(`🤖 [Server] GET /agents - Fetching available agents`);
  
  try {
    const availableAgents = await agentService.getAvailableAgents();
    console.log(`✅ [Server] GET /agents - Success (${availableAgents.length} agents)`);
    res.json({ availableAgents });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] GET /agents - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// GET /health endpoint - checks if prompt, agents, and providers services are working
app.get('/health', async (req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check prompt service (bypass cache for fresh check)
  try {
    await promptService.fetchPrompts();
    health.services.prompt = { status: 'healthy' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.prompt = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  // Check agents service (bypass cache for fresh check)
  try {
    const availableAgents = await agentService.fetchAvailableAgents();
    if (!availableAgents || availableAgents.length === 0) {
      throw new Error('No agents available');
    }
    health.services.agents = {
      status: 'healthy',
      count: availableAgents.length,
      agents: availableAgents,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.agents = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  // Check providers service (bypass cache for fresh check)
  try {
    const availableProviders = await providerService.fetchProviders();
    if (!availableProviders || availableProviders.length === 0) {
      throw new Error('No providers available');
    }
    health.services.providers = {
      status: 'healthy',
      count: availableProviders.length,
      providers: availableProviders.map((p) => p.name),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.providers = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// POST /call endpoint - calls default agent
app.post('/call', async (req: Request, res: Response) => {
  const request: CallRequest = req.body;

  console.log(`📞 [Server] POST /call - Default agent call with ${request.messages?.length || 0} messages`);

  if (!request.messages || !Array.isArray(request.messages)) {
    console.log(`⚠️ [Server] POST /call - Invalid request: messages array required`);
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  try {
    const result = await callService.callAgent(undefined, request);
    console.log(`✅ [Server] POST /call - Success`);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] POST /call - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// POST /call/:agent endpoint - calls specific agent
app.post('/call/:agent', async (req: Request, res: Response) => {
  const { agent } = req.params;
  const request: CallRequest = req.body;

  console.log(`📞 [Server] POST /call/${agent} - Specific agent call with ${request.messages?.length || 0} messages`);

  if (!agent) {
    console.log(`⚠️ [Server] POST /call/:agent - Missing agent parameter`);
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }

  if (!request.messages || !Array.isArray(request.messages)) {
    console.log(`⚠️ [Server] POST /call/${agent} - Invalid request: messages array required`);
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  try {
    const result = await callService.callAgent(agent, request);
    console.log(`✅ [Server] POST /call/${agent} - Success`);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] POST /call/${agent} - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// POST /execute/{functionName} endpoint - executes provider functions
app.post('/execute/:functionName', async (req: Request, res: Response) => {
  const { functionName } = req.params;
  const parameters: FunctionCallParameters = req.body;

  if (!functionName) {
    res.status(400).json({ error: 'Function name is required' });
    return;
  }

  try {
    const result = await executionService.executeFunction(functionName, parameters);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /provider/{providerName}/spec endpoint
app.get('/provider/:providerName/spec', async (req: Request, res: Response) => {
  const { providerName } = req.params;

  if (!providerName) {
    res.status(400).json({ error: 'Provider name is required' });
    return;
  }

  try {
    const result = await providerService.getProviderSpec(providerName);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Export the app for testing
export { app };

// Export services for external use
export default {
  promptService,
  providerService,
  executionService,
  agentService,
  callService,
  app,
};

// Start the server only if this file is run directly
// Check if this module was imported or run directly
const isMainModule =
  process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));
if (isMainModule) {
  const port = process.env.CUBICLER_PORT || 1503;
  console.log(`🚀 [Server] Starting Cubicler server...`);
  console.log(`📋 [Server] Environment configuration:`);
  console.log(`   - Port: ${port}`);
  console.log(`   - Prompts source: ${process.env.CUBICLER_PROMPTS_SOURCE || 'Not configured'}`);
  console.log(`   - Agents list: ${process.env.CUBICLER_AGENTS_LIST || 'Not configured'}`);
  console.log(`   - Providers list: ${process.env.CUBICLER_PROVIDERS_LIST || 'Not configured'}`);
  
  app.listen(port, async () => {
    console.log(`✅ [Server] Cubicler server is running on port ${port}`);
    console.log(`🔗 [Server] Available endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   GET  /agents`);
    console.log(`   GET  /prompt/:agentName`);
    console.log(`   POST /call`);
    console.log(`   POST /call/:agent`);
    console.log(`   POST /execute/:functionName`);
    console.log(`   GET  /provider/:providerName/spec`);
    
    // Perform initial health check
    console.log(`\n🏥 [Server] Performing initial health check...`);
    try {
      await promptService.fetchPrompts();
      console.log(`✅ [Server] Prompt service: Healthy`);
    } catch (error) {
      console.log(`❌ [Server] Prompt service: Unhealthy - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    try {
      await agentService.getAvailableAgents();
      console.log(`✅ [Server] Agent service: Healthy`);
    } catch (error) {
      console.log(`❌ [Server] Agent service: Unhealthy - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    try {
      await providerService.getProviders();
      console.log(`✅ [Server] Provider service: Healthy`);
    } catch (error) {
      console.log(`❌ [Server] Provider service: Unhealthy - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log(`🎉 [Server] Cubicler is ready to handle requests!`);
  });
}
