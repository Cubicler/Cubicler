# Cubicler AI Orchestration Framework

Cubicler is a **modular AI orchestration framework** that connects applications to AI agents and external services through MCP and REST APIs.

## Core Concepts

**Architecture**: Service-oriented with dependency injection using interfaces:

- `MCPCompatible` - Handle MCP protocol requests
- `AgentsProviding` - Manage AI agents and prompt composition  
- `ServersProviding` - Provide server listing and tools discovery
- `ToolsListProviding` - Provide tool definitions

**Configuration**:

- `providers.json` - MCP servers and REST endpoints
- `agents.json` - AI agents with prompt composition (basePrompt + defaultPrompt/agentPrompt)

**API Endpoints**:

- `POST /mcp` - MCP protocol endpoint
- `POST /dispatch[/:agentId]` - dispatch messages to agents
- `GET /agents` - lists available agents
- `GET /health` - health check

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
- `CUBICLER_PORT` - Server port (default: 1503)

## Key Services

- **AgentService** - Agent configuration and prompt composition
- **ProviderService** - MCP servers and REST endpoints management
- **DispatchService** - Message routing and response handling
- **MCPService** - MCP protocol communication
- **InternalToolsService** - Cubicler-specific tools

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
        "url": "http://localhost:4000/mcp",
        "headers": { "Authorization": "Bearer your-api-key" }
    }],
    "restServers": [{
        "identifier": "legacy_api",
        "name": "Legacy API",
        "description": "Legacy REST API without MCP",
        "url": "http://localhost:5000/api",
        "defaultHeaders": { "Authorization": "Bearer your-api-key" },
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
            }
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
        "identifier": "gpt_4o",
        "name": "My GPT-4O Agent",
        "transport": "http",
        "url": "http://localhost:3000/agent",
        "description": "Advanced GPT-4O agent for complex tasks",
        "prompt": "You specialize in complex reasoning and analysis."
    }, {
        "identifier": "local_llama",
        "name": "Local LLaMA Agent",
        "transport": "stdio",
        "url": "/usr/local/bin/llama-agent --model llama2",
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
        - Current project details (name, description, status, etc.)
        - Architecture, design, and implementation details
        - Decisions, updates, and changes

4. Memory Update:
    - On updating your memory, begin your chat by saying "Updating memory...".
   - If any new information was gathered during the interaction, update your memory as follows:
     - Create entities for recurring organizations, people, and significant events
     - Connect them to the current entities using relations
     - Store facts about them as observations