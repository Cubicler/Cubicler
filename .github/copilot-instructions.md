# ⚙️ Cubicler Instructions

You're assisting in improving **Cubicler**, a modular AI orchestration framework designed to run AI agents connected to MCP (Model Context Protocol) servers and REST APIs.

You're here to help improve and expand Cubicler — a proper desk for AI Agents: it gets prompts, connects to MCP servers and REST endpoints, provides Cubicler-specific internal functions, and orchestrates communication between agents and services — all defined externally in JSON configuration. Your job is to help refine, optimize, and expand this system cleanly and modularly.

---

## 🧱 System Overview

Cubicler acts as the **orchestrator/middleware** between frontend services, AI agents, MCP servers, and REST APIs.
We use the term **CubicAgent** to refer to AI agents that integrate with Cubicler.
While the term **CubicProvider** refers to external services (MCP servers or REST endpoints) that provide functions/tools.

**Current Implementation (2.0):**
- Uses `providers.json` that defines MCP servers and REST endpoints
- Uses `agents.json` that defines available agents with enhanced configuration
- Supports base prompts, default prompts, and agent-specific prompts
- Exposes REST API endpoints for dispatching to agents and MCP communication
- Provides Cubicler internal functions as tools for agents

**API Endpoints:**
- `POST /mcp` - MCP protocol endpoint
- `POST /dispatch[/:agentId]` - dispatch messages to agents
- `GET /agents` - lists available agents
- `GET /health` - health check for all services

**Cubicler Internal Functions (available as tools to agents):**
- `cubicler.available_servers` - get information about available servers
- `cubicler.fetch_server_tools` - get tools from specific MCP server

---

## 📦 Configuration

Environment variables:

```env
# Required - Source of providers list (local file or remote URL) 
CUBICLER_PROVIDERS_LIST=https://your-cloud.com/providers.json

# Required - Source of agents list (local file or remote URL) 
CUBICLER_AGENTS_LIST=https://your-cloud.com/agents.json

# Optional - Server port (default: 1503)
CUBICLER_PORT=1503
```

---

## 📑 JSON Providers Configuration Format

```json
{ 
    "mcpServers": [{
        "identifier": "weather_service", // lowercase, no spaces, only - or _
        "name": "Weather Service",
        "description": "Provides weather information via MCP",
        "transport": "http", // http, sse, websocket, stdio (start with http)
        "url": "http://localhost:4000/mcp",
        "headers": { 
            "Authorization": "Bearer your-api-key"
        }
    }],
    "restServers": [{
        "identifier": "legacy_api", // lowercase, no spaces, only - or _
        "name": "Legacy API",
        "description": "Legacy REST API without MCP",
        "url": "http://localhost:5000/api",
        "defaultHeaders": { 
            "Authorization": "Bearer your-api-key"
        },
        "endPoints": [{
            "name": "get_user_info", // lowercase, no spaces, only - or _
            "description": "Get user information by user ID",
            "path": "/users/{userId}", // path should be relative to the server URL
            "method": "GET",
            "headers": { 
                "X-Custom-Header": "value"
            },
            "userId": { 
                // OpenAI function schema format - path variables and query parameters
                // Path variables like {userId} will be extracted and replaced in the path
                "type": "string" // will replace {userId} in the path
            },
            "query": {
                // OpenAI function schema format - path variables and query parameters
                // Path variables like {userId} will be extracted and replaced in the path
                // Remaining parameters will be used as query parameters
                "type": "object",
                "properties": {
                    "include_profile": {"type": "boolean"} // will be added as query parameter
                }
            },
            "payload": { 
                // OpenAI function schema format - used as JSON body
                "type": "object", 
                "properties": {
                    "filters": {"type": "array", "items": {"type": "string"}}
                }
            }
        }]
    }]
}
```

---

## 📑 JSON Agents Configuration Format

```json
{ 
    "basePrompt": "You are a helpful AI assistant powered by Cubicler.", // optional base prompt
    "defaultPrompt": "You have access to various tools and services.", // optional default prompt
    "agents": [{
        "identifier": "gpt_4o", // lowercase, no spaces, only - or _
        "name": "My GPT-4O Agent",
        "transport": "http", // http, stdio (start with http)
        "url": "http://localhost:3000/agent",
        "description": "Advanced GPT-4O agent for complex tasks",
        "prompt": "You specialize in complex reasoning and analysis." // optional agent-specific prompt
    }, {
        "identifier": "claude_3_5",
        "name": "My Claude 3.5 Sonnet",
        "transport": "http",
        "url": "http://localhost:3001/agent",
        "description": "Claude 3.5 Sonnet for creative and analytical tasks"
        // Uses basePrompt + defaultPrompt since no specific prompt provided
    }]
}
```

---

## 📑 Parameter Handling & Function Naming

### REST Server Parameter Processing
- **Path Variables**: Parameters matching `{variableName}` in the path are extracted and used for path replacement
- **Query Parameters**: Remaining parameters from the `parameters` schema become query parameters
- **Query Parameter Conversion**:
  - Objects: JSON stringified
  - Arrays of primitives (string, number, boolean): Comma-separated values
  - Arrays of objects: JSON stringified

### Function Naming Convention
- **MCP Servers**: `{server_identifier}.{function_name}` (e.g., `weather_service.get_current_weather`)
- **REST Servers**: `{server_identifier}.{endpoint_name}` (e.g., `legacy_api.get_user_info`)

### Transport Support
- **Current Phase**: HTTP transport only for both MCP servers and agents
- **Future Phases**: SSE, WebSocket, and stdio transports will be added later

---

## 📑 Message Format

### Dispatch Request (`POST /dispatch[/:agentId]`)

```json
{ 
    "messages": [{
        "sender": { 
            "id": "user_123",
            "name": "John Doe" // optional
        },
        "timestamp": "2025-07-28T17:45:00+07:00", // ISO 8601, optional
        "type": "text", // text (image/video support planned)
        "content": "What's the weather like in Jakarta?"
    }]
}
```

### Dispatch Response

```json
{ 
    "sender": { 
        "id": "gpt_4o",
        "name": "GPT-4O"
    },
    "timestamp": "2025-07-28T17:45:30+07:00",
    "type": "text",
    "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
    "metadata": { 
        "usedToken": 150,
        "usedTools": 2
    }
}
```

What being dispatched to the agent:

```json
{ 
  "agent": { 
    "identifier": "gpt_4o", // lowercase, no spaces, only - or _
    "name": "My GPT-4O Agent",
    "description": "Advanced GPT-4O agent for complex tasks",
    "prompt": "You specialize in complex reasoning and analysis." // the complete prompt
  },
  "tools": [
    {
      "name": "cubicler.available_servers",
      "description": "Get information for available servers managed by Cubicler",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    },
    // ... all available cubicler internal tools
  ],
  "servers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service", 
      "description": "Provides weather information via MCP"
    },
    {
      "identifier": "legacy_api",
      "name": "Legacy API",
      "description": "Legacy REST API without MCP"
    }
    // ... all available servers
  ],
  "messages": [{
    "sender": { 
        "id": "user_123",
        "name": "John Doe" // optional
    },
    "timestamp": "2025-07-28T17:45:00+07:00", // ISO 8601, optional
    "type": "text", // text (image/video support planned)
    "content": "What's the weather like in Jakarta?"
  }]
}
```

and what agent need to return:

```json
{
    "timestamp": "2025-07-28T17:45:30+07:00",
    "type": "text",
    "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
    "metadata": { 
        "usedToken": 150,
        "usedTools": 2
    }
}
```

---

## 📑 Cubicler Internal Functions

### `cubicler.available_servers`

Get information about available servers managed by Cubicler.

**Schema:**
```json
{ 
    "name": "cubicler.available_servers",
    "description": "Get information for available servers managed by Cubicler",
    "parameters": {
        "type": "object",
        "properties": {}
    }
}
```

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

### `cubicler.fetch_server_tools`

Get tools from a specific MCP server managed by Cubicler.

**Schema:**
```json
{ 
    "name": "cubicler.fetch_server_tools",
    "description": "Get tools from one particular server managed by Cubicler",
    "parameters": {
        "type": "object",
        "properties": {
            "serverIdentifier": {
                "type": "string",
                "description": "Identifier of the server to fetch tools from"
            }
        },
        "required": ["serverIdentifier"]
    }
}
```

**Response:**
```json
{ 
    "functions": [{
        "name": "weather_service.get_current_weather",
        "description": "Get current weather for a location",
        "parameters": { 
            // OpenAI function schema format
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "country": {"type": "string"}
            }
        }
    }]
}
```

---

## High-Level Architecture Flow

1. **Agent Configuration**: Agents are loaded from `agents.json` with support for:
   - Base prompts (shared across all agents)
   - Default prompts (fallback for agents without specific prompts)
   - Agent-specific prompts
   - Transport configuration (HTTP/stdio)

2. **Provider Management**: Providers are loaded from `providers.json` supporting:
   - **MCP Servers**: Native MCP protocol communication
   - **REST Servers**: Traditional REST endpoints with OpenAI schema conversion

3. **Message Dispatch** (`POST /dispatch[/:agentId]`):
   - Enhanced message format with sender metadata and timestamps
   - Agent selection (specific agent or default)
   - Prompt composition (basePrompt + defaultPrompt/agentPrompt)

4. **MCP Communication** (`POST /mcp`):
   - Direct MCP protocol endpoint
   - Handles MCP specification requests/responses

5. **Internal Functions**: Cubicler provides built-in functions:
   - Server discovery and tool introspection
   - Namespaced as `cubicler.*` functions

---

## Service Architecture

The system should maintain modular service separation:

- **Agent Service**: Handles agent configuration, selection, and communication
- **Provider Service**: Manages MCP servers and REST endpoints  
- **MCP Service**: Handles MCP protocol communication
- **Dispatch Service**: Orchestrates message routing and response handling
- **Internal Function Service**: Provides Cubicler-specific tools

Each service should be transport-agnostic and reusable across different communication methods.


---

## ✅ Your Role

When I ask you for code, your job is to:
 • Help refine and optimize the TypeScript system modularly following the 2.0 architecture
 • Implement MCP server support and enhanced REST server handling
 • Ensure the system remains clean, hot-swappable, and modular with separate service layers
 • Maintain TypeScript type safety and best practices
 • Build transport-agnostic services that can be reused across different communication methods
 • Avoid overengineering (no LangChain, etc.)
 • Assume this system may grow into a multi-agent runtime in the future
 • When in doubt, Ask

## ✅ DO NOT

 • Do not suggest centralized monolith logic
 • Do not embed prompt logic directly into routing - keep services separate
 • Do not use frameworks that tie code to specific transport behavior
 • Do not sacrifice type safety for convenience
 • Do not make the system too rigid - ensure extensibility for future features

You're here to help implement Cubicler — a proper TypeScript desk for AI Agents with MCP support.