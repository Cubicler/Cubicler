import promptService from './core/prompt-service.js';
import specService from './core/spec-service.js';
import functionService from './core/function-service.js';
import express from 'express';
import type { Request, Response } from 'express';
import type { HealthStatus, FunctionCallParameters } from './utils/types.js';

// Create Express app
const app = express();
app.use(express.json());

// GET /prompt endpoint
app.get('/prompt', async (req: Request, res: Response) => {
  try {
    const prompt = await promptService.getPrompt();
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

// GET /health endpoint - checks if prompt and spec services are working
app.get('/health', async (req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check prompt service
  try {
    await promptService.getPrompt();
    health.services.prompt = { status: 'healthy' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.prompt = { status: 'unhealthy', error: errorMessage };
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

// POST /call/{function_name} endpoint
app.post('/call/:function_name', async (req: Request, res: Response) => {
  const { function_name } = req.params;
  const parameters: FunctionCallParameters = req.body;

  if (!function_name) {
    res.status(400).json({ error: 'Function name is required' });
    return;
  }

  try {
    const result = await functionService.callFunction(function_name, parameters);
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
  functionService,
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
