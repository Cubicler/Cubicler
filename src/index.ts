import express, { NextFunction, Request, Response } from 'express';
import { type AuthenticatedRequest, withJWT } from './middleware/jwt-middleware.js';

// ===== SERVICES DIRECTORY =====
// All business logic services
import healthService from './core/health-service.js';
import dispatchService from './core/dispatch-service.js';
import mcpService from './core/mcp-service.js';
import agentService from './core/agent-service.js';
import sseAgentService from './core/sse-agent-service.js';
import webhookService from './core/webhook-service.js';
import serverConfigService from './core/server-config-service.js';

// Pure utility functions
import {
  validateAgentId,
  validateDispatchRequest,
  validateMCPRequest,
  validateWebhookParams,
  validateWebhookRequest,
} from './utils/validation-utils.js';
import {
  handleDispatchError,
  handleMCPError,
  handleSSEError,
  handleServiceError,
  handleWebhookError,
} from './utils/error-handling-utils.js';
import {
  formatAgentsListSuccess,
  formatDispatchSuccess,
  formatEndpointsSuccess,
  formatHealthSuccess,
  formatMCPSuccess,
  formatSSESuccess,
  formatWebhookSuccess,
} from './utils/response-formatting-utils.js';

// Middleware functions

// Create Express app
const app = express();

// Configure Express middleware
app.use(express.json({ strict: true, limit: '10mb' }));

// CORS configuration
if (process.env.ENABLE_CORS === 'true') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });
}

// ===== ROUTES =====

// Health - HealthService
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getHealthStatus();
    formatHealthSuccess(health, res);
  } catch (error) {
    handleServiceError(error, _req, res, () => {});
  }
});

// Endpoints discovery - Static response
app.get('/endpoints', (_req: Request, res: Response) => {
  const endpoints = [
    { method: 'GET', path: '/health', service: 'HealthService' },
    { method: 'GET', path: '/agents', service: 'AgentService' },
    { method: 'GET', path: '/endpoints', service: 'Static' },
    { method: 'POST', path: '/dispatch', service: 'DispatchService' },
    { method: 'POST', path: '/dispatch/:agentId', service: 'DispatchService' },
    { method: 'POST', path: '/mcp', service: 'MCPService' },
    { method: 'GET', path: '/sse/:agentId', service: 'SSEAgentService' },
    { method: 'POST', path: '/sse/:agentId/response', service: 'SSEAgentService' },
    { method: 'GET', path: '/sse/status', service: 'SSEAgentService' },
    {
      method: 'POST',
      path: '/webhook/:identifier/:agentId',
      service: 'WebhookService (complete flow)',
    },
  ];
  formatEndpointsSuccess(endpoints, res);
});

// Agents list - AgentService
app.get('/agents', async (_req: Request, res: Response) => {
  try {
    const agents = await agentService.getAllAgents();
    formatAgentsListSuccess(agents, res);
  } catch (error) {
    handleServiceError(error, _req, res, () => {});
  }
});

// Dispatch to default agent - DispatchService
app.post(
  '/dispatch',
  validateDispatchRequest,
  await withJWT('dispatch', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await dispatchService.dispatch(undefined, req.body);
      formatDispatchSuccess(result, res);
    } catch (error) {
      handleDispatchError(error, req, res, () => {});
    }
  })
);

// Dispatch to specific agent - DispatchService
app.post(
  '/dispatch/:agentId',
  validateAgentId,
  validateDispatchRequest,
  await withJWT('dispatch', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const result = await dispatchService.dispatch(agentId, req.body);
      formatDispatchSuccess(result, res);
    } catch (error) {
      handleDispatchError(error, req, res, () => {});
    }
  })
);

// MCP protocol - MCPService
app.post(
  '/mcp',
  validateMCPRequest,
  await withJWT('mcp', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await mcpService.handleMCPRequest(req.body);
      formatMCPSuccess(result, res);
    } catch (error) {
      handleMCPError(error, req.body.id || null, req, res, () => {});
    }
  })
);

// SSE connection - SSEAgentService
app.get(
  '/sse/:agentId',
  validateAgentId,
  await withJWT('sse', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;

      // Check if agent exists (could be moved to SSEAgentService)
      const agents = await agentService.getAllAgents();
      const agentExists = agents.some((agent) => agent.identifier === agentId);
      if (!agentExists) {
        res.status(404).json({ error: `Agent ${agentId} not found` });
        return;
      }

      const connected = sseAgentService.handleAgentConnection(agentId!, res); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- Safe: agentId is validated by validateAgentId middleware
      if (!connected) {
        throw new Error('Failed to establish SSE connection');
      }
    } catch (error) {
      handleSSEError(error, req, res, () => {});
    }
  })
);

// SSE response handling - SSEAgentService
app.post(
  '/sse/:agentId/response',
  validateAgentId,
  await withJWT('sse', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const { requestId, response } = req.body;

      const handled = sseAgentService.handleAgentResponse(agentId!, requestId, response); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- Safe: agentId is validated by validateAgentId middleware
      if (!handled) {
        res.status(404).json({ error: `No active session for agent ${agentId}` });
        return;
      }

      formatSSESuccess({ success: true }, res);
    } catch (error) {
      handleSSEError(error, req, res, () => {});
    }
  })
);

// SSE status - SSEAgentService
app.get(
  '/sse/status',
  await withJWT('sse', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const connectedAgents = sseAgentService.getConnectedAgentIds();
      const result = { status: 'ok', connectedAgents, totalConnected: connectedAgents.length };
      formatSSESuccess(result, res);
    } catch (error) {
      handleSSEError(error, _req, res, () => {});
    }
  })
);

// Webhook processing - WebhookService (now handles complete flow)
app.post(
  '/webhook/:identifier/:agentId',
  validateWebhookParams,
  validateWebhookRequest,
  await withJWT('webhook', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier, agentId } = req.params;

      // WebhookService now handles the complete webhook-to-agent flow
      const webhookRequest = {
        identifier: identifier!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- Safe: identifier is validated by validateWebhookParams middleware
        agentId: agentId!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- Safe: agentId is validated by validateWebhookParams middleware
        payload: req.body,
        headers: req.headers as Record<string, string>,
        signature: req.headers['x-signature-256'] as string,
      };

      const response = await webhookService.processAndDispatchWebhook(webhookRequest);
      formatWebhookSuccess(response, res);
    } catch (error) {
      handleWebhookError(error, req, res, () => {});
    }
  })
);

// Global error handlers
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err && err.message.includes('JSON')) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }
  console.error(`❌ [Server] Unexpected error:`, err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for testing and library usage
export { app, startServer };

// Server startup
const isMainModule = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
if (isMainModule) {
  startServer();
}

async function startServer() {
  console.log(`🚀 [Server] Starting Cubicler server...`);

  const serverConfig = await serverConfigService.loadConfig();
  const port = serverConfig.port || 1503;
  const host = serverConfig.host || '0.0.0.0';

  app.listen(port, host, async () => {
    console.log(`✅ [Server] Cubicler server running on ${host}:${port}`);
    console.log(
      `🔗 [Server] Services: HealthService, DispatchService, MCPService, AgentService, SSEAgentService, WebhookService`
    );

    await mcpService.initialize();
    console.log(`🎉 [Server] All services ready!`);
  });
}
