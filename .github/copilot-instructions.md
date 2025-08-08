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
- Avoid using `any` type - use specific types
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

### providers.json
```json
{ 
    "mcpServers": [{
        "identifier": "weather_service",
        "name": "Weather Service",
        "description": "Provides weather information via MCP",
        "transport": "http",
        "config": {
            "url": "http://localhost:4000/mcp",
            "headers": { "Authorization": "Bearer your-api-key" }
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
            "query": {
                "type": "object",
                "properties": {
                    "include_profile": {"type": "boolean"}
                }
            },
            "payload": { 
                "type": "object", 
                "properties": {
                    "filters": {"type": "array", "items": {"type": "string"}}
                }
            },
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

### agents.json
```json
{ 
    "basePrompt": "You are a helpful AI assistant powered by Cubicler.",
    "defaultPrompt": "You have access to various tools and services.",
    "agents": [{
        "identifier": "gpt_4o_direct",
        "name": "My GPT-4O Agent",
        "transport": "direct",
        "config": {
            "provider": "openai",
            "apiKey": "${OPENAI_API_KEY}",
            "model": "gpt-4o",
            "summarizerModel": "gpt-4o-mini",
            "temperature": 0.7
        },
        "description": "Advanced GPT-4O agent with direct integration",
        "prompt": "You specialize in complex reasoning and analysis."
    }, {
        "identifier": "http_agent",
        "name": "HTTP Agent",
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
        "description": "HTTP-based agent with JWT auth",
        "prompt": "You are a secure agent with JWT authentication."
    }, {
        "identifier": "local_llama",
        "name": "Local LLaMA Agent",
        "transport": "stdio",
        "config": {
            "url": "/usr/local/bin/llama-agent --model llama2"
        },
        "description": "Local LLaMA model running as a command-line agent"
    }]
}
```

## Transport Support

- **HTTP Transport**: Full support for HTTP-based agents and MCP servers
- **Stdio Transport**: Full support for local process-based agents via stdin/stdout
  - Uses `spawn()` to execute command in agent's `url` field
  - Sends `AgentRequest` as JSON to stdin, receives `AgentResponse` from stdout
  - Process timeout configurable via `AGENT_CALL_TIMEOUT` (default: 90000ms)
- **Direct Transport**: Native integration with AI models (OpenAI GPT models)
  - Runs AI models directly within Cubicler without external HTTP calls
  - Supports model selection, temperature, and other parameters
  - Built-in summarizer support for tool result processing
- **SSE Transport**: Server-Sent Events for real-time streaming communication

## Message Formats

### Dispatch Request (`POST /dispatch[/:agentId]`)
```json
{ 
    "messages": [{
        "sender": { "id": "user_123", "name": "John Doe" },
        "timestamp": "2025-07-28T17:45:00+07:00",
        "type": "text",
        "content": "What's the weather like in Jakarta?"
    }]
}
```

### Webhook Request (`POST /webhook/:identifier/:agentId`)
```json
{
    "trigger": {
        "source": "github",
        "event": "push", 
        "timestamp": "2025-07-28T17:45:00+07:00",
        "data": { "repository": "myrepo", "branch": "main" }
    }
}
```

### webhooks.json Configuration
```json
{
    "webhooks": [{
        "identifier": "github_push",
        "name": "GitHub Push Webhook",
        "description": "Handles GitHub push events for CI/CD automation",
        "config": {
            "authentication": {
                "type": "signature",
                "secret": "${GITHUB_WEBHOOK_SECRET}"
            },
            "allowedOrigins": ["github.com"]
        },
        "agents": ["devops-agent", "code-reviewer"],
        "payload_transform": [
            {
                "path": "repository.full_name",
                "transform": "template",
                "template": "Repository: {value}"
            },
            {
                "path": "head_commit.timestamp", 
                "transform": "date_format",
                "format": "MMM DD, YYYY HH:mm:ss"
            },
            {
                "path": "sender.gravatar_id",
                "transform": "remove"
            }
        ]
    }]
}

### Agent Request Payload
```json
{ 
  "agent": { 
    "identifier": "gpt_4o",
    "name": "My GPT-4O Agent",
    "description": "Advanced GPT-4O agent for complex tasks",
    "prompt": "You specialize in complex reasoning and analysis."
  },
  "tools": [/* all available cubicler internal tools */],
  "servers": [/* all available servers */],
  "messages": [/* original messages array */]
}
```

### Agent Response Format
```json
{
    "timestamp": "2025-07-28T17:45:30+07:00",
    "type": "text",
    "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
    "metadata": { "usedToken": 150, "usedTools": 2 }
}
```

## Internal Functions

### `cubicler_available_servers`
Get information about available servers managed by Cubicler.

**Response:**
```json
{ 
    "total": 3,
    "servers": [{
        "identifier": "weather_service",
        "name": "Weather Service", 
        "description": "Provides weather information via MCP",
        "toolsCount": 5
    }]
}
```

### `cubicler_fetch_server_tools`
Get tools from a specific MCP server managed by Cubicler.

**Parameters:** `{ "serverIdentifier": "string" }`

**Response:**
```json
{ 
    "functions": [{
        "name": "1r2dj4_get_current_weather",
        "description": "Get current weather for a location",
        "parameters": { 
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "country": {"type": "string"}
            }
        }
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

**1. CI/CD Integration**
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

**2. System Monitoring**
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

**3. Calendar Integration**
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

**4. IoT Device Events**
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

## Development Commands

```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run dev           # Start with ts-node
npm run dev:watch     # Start with watch mode
npm run docker:dev    # Development with docker-compose
```

## Linting Rules

- If linter is wrong, disable with explanatory comments
- Add imports at top of file (except singleton instances at bottom)
- Use proper TypeScript types instead of `any`
- For constructor parameters: `// eslint-disable-next-line no-unused-vars`
- For safe non-null assertions: `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: reason`
- Remove truly unused imports rather than disabling warnings

## Your Memory Management Instructions

Follow these steps for each interaction:

1. User Identification:
   - You should assume that you are interacting with default_user
   - If you have not identified default_user, proactively try to do so.

2. Memory Retrieval:
   - Always begin your chat by saying only "Recalling..." and retrieve all relevant information from your knowledge graph
   - Always refer to your knowledge graph as your "memory"
   - Always do the "Recalling..." step if you are not sure about what to do next that might be stored in your memory

3. Memory
   - While conversing with the user, be attentive to any new information that falls into these categories:
     - Basic Identity (age, gender, location, job title, education level, etc.)
     - Behaviors (interests, habits, etc.)
     - Preferences (communication style, preferred language, etc.)
     - Project (important!):
        - Architecture, and implementation decisions
        - Project goals, milestones, and deadlines
        - Project-specific knowledge (e.g., domain-specific terms, technologies used)

4. Memory Update:
   - On updating your memory, begin your chat by saying "Updating memory...".
   - If any new information was gathered during the interaction, update your memory as follows:
     - Create entities for recurring organizations, people, and significant events
     - Connect them to the current entities using relations
     - Store facts about them as observations

## Work with Me

- Always ask for clarification if you are unsure about something
- Before start working on tasks, make a checklist plan and ask for confirmation
- On each task completion, go back to the checklist and mark the task as done
- If you encounter an issue during task completion, update the checklist with the issue as another task
- Don't add new tasks to the checklist unless explicitly asked
- Stop only after all tasks are done or you cannot proceed due to an issue
- when creating a checklist, there will be no formatting available, so use simple text format
- Product is still in Alpha, no need for backward compatibility