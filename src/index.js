// Entry point for the Cubicle framework

// Import core services
import promptService from './core/promptService.js';
import specService from './core/specService.js';
import functionService from './core/functionService.js';
import express from 'express';

// Create Express app
const app = express();
app.use(express.json());

// GET /prompt endpoint
app.get('/prompt', async (req, res) => {
  try {
    const prompt = await promptService.getPrompt();
    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /spec endpoint
app.get('/spec', async (req, res) => {
  try {
    const functions = await specService.getFunctions();
    res.json(functions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health endpoint - checks if prompt and spec services are working
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check prompt service
  try {
    await promptService.getPrompt();
    health.services.prompt = { status: 'healthy' };
  } catch (error) {
    health.services.prompt = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }

  // Check spec service
  try {
    await specService.getFunctions();
    health.services.spec = { status: 'healthy' };
  } catch (error) {
    health.services.spec = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// POST /call/{function_name} endpoint
app.post('/call/:function_name', async (req, res) => {
  const { function_name } = req.params;
  const parameters = req.body;

  try {
    const result = await functionService.callFunction(function_name, parameters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  const port = process.env.PORT || 1503;
  app.listen(port, () => {
    console.log(`Cubicle server is running on port ${port}`);
  });
}
