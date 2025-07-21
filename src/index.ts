import express, { Request, Response } from 'express';
import specService from './core/spec-service.js';
import promptService from './core/prompt-service.js';
import agentService from './core/agent-service.js';
import providerService from './core/provider-service.js';
import executionService from './core/execution-service.js';
import callService from './core/call-service.js';
import type { 
  FunctionCallParameters, 
  HealthStatus,
  CallRequest
} from './model/types.js';

// Create Express app
const app = express();
app.use(express.json());

// GET /prompt/:agentName endpoint
app.get('/prompt/:agentName', async (req: Request, res: Response) => {
  const { agentName } = req.params;

  if (!agentName) {
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }

  try {
    const prompt = await promptService.getPrompt(agentName);
    res.json({ prompt });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /spec endpoint
app.get('/spec', async (req: Request, res: Response) => {
  try {
    const functions = await specService.getFunctions();
    res.json(functions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /agents endpoint
app.get('/agents', async (req: Request, res: Response) => {
  try {
    const availableAgents = await agentService.getAvailableAgents();
    res.json({ availableAgents });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /health endpoint - checks if prompt, agents, and providers services are working
app.get('/health', async (req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
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
      agents: availableAgents
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
      providers: availableProviders.map(p => p.name)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.providers = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  // Check spec service
  try {
    await specService.getFunctions();
    health.services.spec = { status: 'healthy' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.spec = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// POST /call endpoint - calls default agent
app.post('/call', async (req: Request, res: Response) => {
  const request: CallRequest = req.body;

  if (!request.messages || !Array.isArray(request.messages)) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  try {
    const result = await callService.callAgent(undefined, request);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// POST /call/:agent endpoint - calls specific agent
app.post('/call/:agent', async (req: Request, res: Response) => {
  const { agent } = req.params;
  const request: CallRequest = req.body;

  if (!agent) {
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }

  if (!request.messages || !Array.isArray(request.messages)) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  try {
    const result = await callService.callAgent(agent, request);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
  specService,
  providerService,
  executionService,
  agentService,
  callService,
  app,
};

// Start the server only if this file is run directly
// Check if this module was imported or run directly
const isMainModule = process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));
if (isMainModule) {
  const port = process.env.CUBICLER_PORT || 1503;
  app.listen(port, () => {
    console.log(`Cubicler server is running on port ${port}`);
  });
}
