# Cubicler AI Orchestration Framework

Cubicler is a **modular AI orchestration framework** that connects applications to AI agents and external services through MCP and REST APIs.

## Core Concepts

**Architecture**: Service-oriented with dependency injection using interfaces:

- `MCPCompatible` - Handle MCP protocol requests
- `AgentsProviding` - Manage AI agents and prompt composition  
- `ServersProviding` - Provide server listing and tools discovery
- `ToolsListProviding` - Provide tool definitions
- `DispatchHandling` - Handle message dispatch to agents
- `MCPHandling` - Handle MCP protocol operations
- `HealthService` - System health monitoring
- `WebhooksConfigProviding` - Webhook configuration management

**Configuration**:

- `providers.json` - MCP servers and REST endpoints with transport-specific config objects
- `agents.json` - AI agents with transport-specific config objects and prompt composition
- `webhooks.json` - Webhook definitions for external system triggers

**API Endpoints**:

- `POST /mcp` - MCP protocol endpoint
- `POST /dispatch[/:agentId]` - dispatch messages to agents
- `GET /agents` - lists available agents
- `GET /health` - comprehensive health check with service status
- `GET /endpoints` - lists all available API endpoints
- `GET /sse/agents/:agentId` - SSE agent connection
- `GET /sse/status` - SSE connection status
- `POST /webhook/:identifier/:agentId` - webhook triggers for external systems (event-driven agent activation)

**Internal Functions** (available as tools to agents):

- `cubicler_available_servers` - get server information
- `cubicler_fetch_server_tools` - get tools from specific server

## Development Standards

**Core Principles**:

- Follow SOLID principles
- Break long methods into focused smaller methods
- Throw errors, don't catch and ignore - let them bubble up unless expected
- Prefer simple code over forced reuse - avoid complex abstractions
- Implement exactly what is requested - no unrequested features

**Error Handling**:

- Use emoji prefixes: `✅` success, `⚠️` warning, `❌` error
- Validate inputs early and throw meaningful errors
- Only catch errors you can handle or recover from

**Function Naming**:

- Internal tools: `cubicler_*`
- MCP tools: `{hash}_{snake_case_function}`
- REST tools: `{hash}_{snake_case_endpoint}`

**TypeScript**:

- Strict null checks enabled
- ES modules with `.js` extensions in imports
- Interface segregation over large interfaces
- JSDoc for public methods

**Testing**: Vitest framework, mock dependencies with `vi.fn()`, integration tests in `tests/integration/`

**Environment**:

- `CUBICLER_PROVIDERS_LIST` - Source of providers (file/URL)
- `CUBICLER_AGENTS_LIST` - Source of agents (file/URL)  
- `CUBICLER_WEBHOOKS_LIST` - Source of webhooks (file/URL)
- `CUBICLER_PORT` - Server port (default: 1503)
- `AGENT_CALL_TIMEOUT` - Agent request timeout (default: 90000ms)
- `ENABLE_CORS` - Enable CORS headers (default: false)
- JWT Authentication variables (per endpoint):
  - `JWT_SECRET_MCP`, `JWT_SECRET_DISPATCH`, `JWT_SECRET_SSE`, `JWT_SECRET_WEBHOOK`

## Key Services

- **AgentService** - Agent configuration and prompt composition
- **ProviderService** - MCP servers and REST endpoints management
- **DispatchService** - Message routing and response handling
- **MCPService** - MCP protocol communication
- **InternalToolsService** - Cubicler-specific tools
- **WebhookService** - Webhook processing and agent dispatch
- **HealthService** - System health monitoring
- **SSEAgentService** - Server-Sent Events agent connections

Services use singleton pattern with DI: `export { Class }; export default new Class(deps);`

## Configuration

### providers.json - Enhanced with Config Objects

```json
{ 
    "mcpServers": [{
        "identifier": "weather_service",
        "name": "Weather Service",
        "description": "Provides weather information via MCP",
        "transport": "http",
        "config": {
            "url": "http://localhost:4000/mcp",
            "headers": { "Authorization": "Bearer your-api-key" },
            "auth": {
                "type": "jwt",
                "config": {
                    "token": "${MCP_JWT_TOKEN}"
                }
            }
        }
    }],
    "restServers": [{
        "identifier": "legacy_api",
        "name": "Legacy API",
        "description": "Legacy REST API without MCP",
        "transport": "http",
        "config": {
            "url": "http://localhost:5000/api",
            "defaultHeaders": { "Authorization": "Bearer your-api-key" }
        },
        "endPoints": [{
            "name": "get_user_info",
            "description": "Get user information by user ID",
            "path": "/users/{userId}",
            "method": "GET",
            "userId": { "type": "string" },
            "response_transform": [
                {
                    "path": "status",
                    "transform": "map",
                    "map": {"0": "Offline", "1": "Online", "2": "Away"}
                },
                {
                    "path": "last_login",
                    "transform": "date_format",
                    "format": "YYYY-MM-DD HH:mm:ss"
                },
                {
                    "path": "debug_info",
                    "transform": "remove"
                }
            ]
        }]
    }]
}
```

### agents.json - Enhanced with Transport-Specific Config

```json
{ 
    "basePrompt": "You are a helpful AI assistant powered by Cubicler.",
    "defaultPrompt": "You have access to various tools and services.",
    "agents": [{
        "identifier": "gpt_4o_direct",
        "name": "My GPT-4O Direct Agent",
        "transport": "direct",
        "config": {
            "provider": "openai",
            "apiKey": "${OPENAI_API_KEY}",
            "model": "gpt-4o",
            "summarizerModel": "gpt-4o-mini",
            "temperature": 0.7
        },
        "description": "OpenAI GPT-4o with direct integration and summarizer",
        "prompt": "You specialize in complex reasoning and analysis."
    }, {
        "identifier": "secure_agent",
        "name": "JWT Secured Agent",
        "transport": "http",
        "config": {
            "url": "http://localhost:3000/agent",
            "auth": {
                "type": "jwt",
                "config": {
                    "token": "${AGENT_JWT_TOKEN}"
                }
            }
        },
        "description": "HTTP agent with JWT authentication"
    }]
}
```

### webhooks.json - New Configuration File

```json
{
    "webhooks": [{
        "identifier": "github_push",
        "name": "GitHub Push Webhook",
        "description": "Handles GitHub push events",
        "auth": {
            "type": "signature",
            "secret": "${GITHUB_WEBHOOK_SECRET}"
        },
        "allowedAgents": ["gpt_4o_direct", "code_reviewer"],
        "payload_transform": [
            {
                "path": "repository.full_name",
                "transform": "template",
                "template": "Repository: {value}"
            }
        ]
    }]
}
```

## Webhook System

Cubicler's webhook system enables **event-driven AI agent activation** from external systems like GitHub, monitoring tools, calendars, IoT devices, and CI/CD pipelines.

### Architecture Overview

**Endpoint Pattern**: `POST /webhook/:identifier/:agentId`

- `:identifier` - Webhook configuration identifier from webhooks.json
- `:agentId` - Target agent to receive the webhook trigger

**Key Features**:

- **Event-Driven Activation**: Agents respond automatically to external events
- **Payload Transformation**: Clean and normalize webhook data before agent processing  
- **Security**: Multiple authentication methods (signature validation, bearer tokens)
- **Agent Authorization**: Control which agents can receive specific webhooks
- **Flexible Configuration**: No code changes needed for new webhook integrations

### Webhook vs Dispatch Calls

**Dispatch Call (User Conversation)**:

```typescript
interface AgentRequest {
  messages: Message[];           // User conversation messages
  agent: AgentInfo;
  tools: AgentTool[];
  servers: AgentServerInfo[];
}
```

**Webhook Call (Automated Trigger)**:

```typescript  
interface AgentRequest {
  trigger: {                     // Webhook trigger context
    type: 'webhook';
    identifier: string;          // "github_push"
    name: string;               // "GitHub Push Webhook" 
    description: string;        // "Handles GitHub push events..."
    triggeredAt: string;        // ISO timestamp
    payload: any;               // Transformed webhook data
  };
  agent: AgentInfo;
  tools: AgentTool[];
  servers: AgentServerInfo[];
}
```

### Configuration Structure

**Authentication Types**:

- **Signature**: Validate webhook signatures (GitHub, GitLab style)
- **Bearer**: Validate bearer tokens
- **None**: Open webhooks for internal systems

**Payload Transformations**:

- **`map`**: Transform values using key-value mapping
- **`template`**: Format values using `{value}` placeholders  
- **`date_format`**: Format dates using moment.js patterns
- **`regex_replace`**: Replace text using regular expressions
- **`remove`**: Remove sensitive or unnecessary fields

### Common Use Cases

#### 1. CI/CD Integration

```json
{
    "identifier": "github_push",
    "description": "GitHub push events for automated code review",
    "agents": ["code-reviewer", "devops-agent"],
    "config": {
        "authentication": {
            "type": "signature",
            "secret": "${GITHUB_WEBHOOK_SECRET}"
        }
    }
}
```

#### 2. System Monitoring

```json
{
    "identifier": "monitoring_alerts", 
    "description": "Infrastructure monitoring alerts for intelligent triage",
    "agents": ["alert-agent"],
    "config": {
        "authentication": {
            "type": "bearer",
            "token": "${MONITORING_TOKEN}"
        }
    }
}
```

#### 3. Calendar Integration

```json
{
    "identifier": "calendar_events",
    "description": "Calendar reminders for proactive meeting assistance", 
    "agents": ["scheduler-agent"],
    "payload_transform": [
        {
            "path": "event.start_time",
            "transform": "date_format", 
            "format": "YYYY-MM-DD HH:mm:ss"
        }
    ]
}
```

#### 4. IoT Device Events

```json
{
    "identifier": "iot_sensors",
    "description": "IoT sensor readings for smart environment control",
    "agents": ["iot-controller"],
    "payload_transform": [
        {
            "path": "readings[].status",
            "transform": "map",
            "map": {"0": "Normal", "1": "Warning", "2": "Critical"}
        }
    ]
}
```

### Agent Implementation Pattern

Agents can differentiate between user conversations and webhook triggers:

```typescript
function handleRequest(request: AgentRequest) {
  if (request.messages) {
    // Handle user conversation 
    return processUserMessages(request.messages);
  } 
  else if (request.trigger) {
    // Handle webhook trigger
    const { identifier, payload, triggeredAt } = request.trigger;
    
    switch (identifier) {
      case 'github_push':
        return handleCodePush(payload);
      case 'monitoring_alerts':
        return analyzeAlert(payload);
      case 'calendar_events': 
        return prepareMeeting(payload);
      default:
        return handleGenericWebhook(payload);
    }
  }
}
```

### Security Considerations

- **Agent Authorization**: Only listed agents can receive webhook calls
- **Signature Validation**: Verify webhook authenticity using secrets
- **Origin Restrictions**: Optional allowedOrigins configuration
- **JWT Authentication**: Per-endpoint JWT protection via `JWT_SECRET_WEBHOOK`
- **Payload Sanitization**: Remove sensitive data via transformation rules

## New Features

### 🔐 JWT Authentication

- Endpoint-specific JWT protection for MCP, dispatch, SSE, and webhook endpoints
- Support for static tokens and OAuth2 client credentials flow
- Automatic token refresh with configurable thresholds

### 🔄 Response Transformations

Transform API responses before sending to AI agents:

- `map` - Transform values using key-value mapping
- `date_format` - Format dates using specified patterns
- `template` - Apply templates with {value} placeholders
- `regex_replace` - Replace text using regular expressions
- `remove` - Remove fields from responses

### 🌐 Webhook Integration

- External systems can trigger AI agents via `POST /webhook/:identifier/:agentId`
- Configurable authentication (signature validation, bearer tokens)
- Payload transformation using same engine as REST endpoints
- Agent authorization controls which agents can receive webhook calls

### 🎯 Direct Transport

- Native integration with OpenAI models without external HTTP calls
- Built-in AI summarizer support for tool result processing
- Model selection and parameter configuration

### 📊 Rich Message Support

- Text, image, URL, and null message types with comprehensive metadata
- Image analysis capabilities with base64 and URL references
- Metadata fields for enhanced context and processing

### 🏥 Health Monitoring

- Comprehensive health checks with service-level status reporting
- Multi-service monitoring for agents, providers, and system components
