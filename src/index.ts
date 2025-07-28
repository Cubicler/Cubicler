import express, { Request, Response } from 'express';
import type {
  MCPRequest, 
  HealthStatus 
} from './model/types.js';
import { DispatchRequest } from './model/dispatch.js';

// Import all services
import agentService from './core/agent-service.js';
import providerService from './core/provider-service.js';
import dispatchService from './core/dispatch-service.js';
import mcpService from './core/mcp-service.js';
import internalToolsService from './core/internal-tools-service.js';

// Create Express app
const app = express();

// Regular JSON parser
app.use(express.json({ 
  strict: true,
  limit: '10mb'
}));

// Add CORS headers only if enabled via environment variable
if (process.env.ENABLE_CORS === 'true') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  });
}

// ===== Health Check Endpoint =====
app.get('/health', async (req: Request, res: Response) => {
  console.log(`🏥 [Server] Health check requested`);
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check agents service
  try {
    const agentsInfo = await agentService.getAllAgents();
    health.services.agents = {
      status: 'healthy',
      count: agentsInfo.length,
      agents: agentsInfo.map(a => a.identifier)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.agents = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  // Check providers service
  try {
    const servers = await providerService.getAvailableServers();
    health.services.providers = {
      status: 'healthy',
      count: servers.total,
      servers: servers.servers.map(s => s.identifier)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    health.services.providers = { status: 'unhealthy', error: errorMessage };
    health.status = 'unhealthy';
  }

  // MCP service status (basic check)
  health.services.mcp = { status: 'healthy' };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  console.log(`${health.status === 'healthy' ? '✅' : '❌'} [Server] Health check: ${health.status}`);
  
  res.status(statusCode).json(health);
});

// ===== Agents Endpoint =====
app.get('/agents', async (req: Request, res: Response) => {
  console.log(`🤖 [Server] GET /agents - Fetching available agents`);
  
  try {
    const agents = await agentService.getAllAgents();
    console.log(`✅ [Server] GET /agents - Success (${agents.length} agents)`);
    res.json({ 
      total: agents.length,
      agents 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] GET /agents - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// ===== Dispatch Endpoints =====

// POST /dispatch - dispatch to default agent
app.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const request: DispatchRequest = req.body;
    
    // Handle case where body is undefined (JSON parsing failed)
    if (!request) {
      console.log(`⚠️ [Server] Invalid JSON in request body`);
      res.status(400).json({ error: 'Invalid JSON in request body' });
      return;
    }
    
    console.log(`📨 [Server] POST /dispatch - Default agent dispatch with ${request.messages?.length || 0} messages`);

    // Validate request
    if (!request.messages) {
      console.log(`⚠️ [Server] POST /dispatch - Missing messages array`);
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      console.log(`⚠️ [Server] POST /dispatch - Empty messages array`);
      res.status(400).json({ error: 'Messages array must not be empty' });
      return;
    }

    // Validate message format
    for (let i = 0; i < request.messages.length; i++) {
      const message = request.messages[i];
      if (!message || !message.sender || !message.type || !message.content) {
        console.log(`⚠️ [Server] POST /dispatch - Invalid message format at index ${i}`);
        res.status(400).json({ error: `Invalid message format: missing required fields (sender, type, content) at index ${i}` });
        return;
      }
    }

    const result = await dispatchService.dispatch(undefined, request);
    console.log(`✅ [Server] POST /dispatch - Success`);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] POST /dispatch - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// POST /dispatch/:agentId - dispatch to specific agent
app.post('/dispatch/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const request: DispatchRequest = req.body;

  console.log(`📨 [Server] POST /dispatch/${agentId} - Specific agent dispatch with ${request.messages?.length || 0} messages`);

  if (!agentId) {
    console.log(`⚠️ [Server] POST /dispatch/:agentId - Missing agent ID`);
    res.status(400).json({ error: 'Agent ID is required' });
    return;
  }

  // Validate request
  if (!request.messages) {
    console.log(`⚠️ [Server] POST /dispatch/${agentId} - Missing messages array`);
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    console.log(`⚠️ [Server] POST /dispatch/${agentId} - Empty messages array`);
    res.status(400).json({ error: 'Messages array must not be empty' });
    return;
  }

  // Validate message format
  for (let i = 0; i < request.messages.length; i++) {
    const message = request.messages[i];
    if (!message || !message.sender || !message.type || !message.content) {
      console.log(`⚠️ [Server] POST /dispatch/${agentId} - Invalid message format at index ${i}`);
      res.status(400).json({ error: `Invalid message format: missing required fields (sender, type, content) at index ${i}` });
      return;
    }
  }

  try {
    const result = await dispatchService.dispatch(agentId, request);
    console.log(`✅ [Server] POST /dispatch/${agentId} - Success`);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] POST /dispatch/${agentId} - Error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// ===== MCP Endpoint =====
app.post('/mcp', async (req: Request, res: Response) => {
  const mcpRequest: MCPRequest = req.body;
  
  console.log(`📡 [Server] POST /mcp - MCP request: ${mcpRequest.method}`);

  if (!mcpRequest.jsonrpc || mcpRequest.jsonrpc !== '2.0') {
    res.status(400).json({ 
      jsonrpc: '2.0', 
      id: mcpRequest.id || null, 
      error: { code: -32600, message: 'Invalid Request: Missing or invalid jsonrpc version' } 
    });
    return;
  }

  try {
    const result = await mcpService.handleMCPRequest(mcpRequest);
    console.log(`✅ [Server] POST /mcp - Success`);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Server] POST /mcp - Error: ${errorMessage}`);
    res.status(500).json({ 
      jsonrpc: '2.0', 
      id: mcpRequest.id || null, 
      error: { code: -32603, message: `Internal error: ${errorMessage}` } 
    });
  }
});

// Global error handler for JSON parsing and other errors
app.use((err: any, req: Request, res: Response, next: any) => {
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err && err.message.includes('JSON')) {
    console.log(`⚠️ [Server] Invalid JSON in request body`);
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }
  
  // Handle other errors
  console.error(`❌ [Server] Unexpected error:`, err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler for unknown endpoints
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export the app for testing
export { app };

// Start the server only if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = process.env.CUBICLER_PORT || 1503;
  
  console.log(`🚀 [Server] Starting Cubicler server...`);
  console.log(`📋 [Server] Environment configuration:`);
  console.log(`   - Port: ${port}`);
  console.log(`   - CORS enabled: ${process.env.ENABLE_CORS === 'true' ? 'Yes' : 'No'}`);
  console.log(`   - Providers list: ${process.env.CUBICLER_PROVIDERS_LIST || 'Not configured'}`);
  console.log(`   - Agents list: ${process.env.CUBICLER_AGENTS_LIST || 'Not configured'}`);
  
  app.listen(port, async () => {
    console.log(`✅ [Server] Cubicler server is running on port ${port}`);
    console.log(`🔗 [Server] Available endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   GET  /agents`);
    console.log(`   POST /dispatch`);
    console.log(`   POST /dispatch/:agentId`);
    console.log(`   POST /mcp`);
    
    // Perform initial health check and tool initialization
    console.log(`\n🏥 [Server] Performing initial health check...`);
    
    try {
      const agentsInfo = await agentService.getAllAgents();
      console.log(`✅ [Server] Agent service: Healthy (${agentsInfo.length} agents)`);
    } catch (error) {
      console.log(`❌ [Server] Agent service: Unhealthy - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    let providersCount = 0;
    try {
      const servers = await providerService.getAvailableServers();
      providersCount = servers.total;
      console.log(`✅ [Server] Provider service: Healthy (${servers.total} servers)`);
    } catch (error) {
      console.log(`❌ [Server] Provider service: Unhealthy - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Initialize MCP service during startup
    try {
      await mcpService.initialize();
      console.log(`✅ [Server] MCP service: Initialized successfully with ${providersCount} providers`);
    } catch (error) {
      console.log(`❌ [Server] MCP service: Failed to initialize - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log(`✅ [Server] Internal functions: Ready (${(await internalToolsService.toolsList()).length} tools)`);
    
    console.log(`🎉 [Server] Cubicler is ready to handle requests!`);
  });
}
