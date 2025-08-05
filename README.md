# Cubicler

![Cubicler Logo](cubicler_logo_inline.jpeg)

> *A modular AI orchestration framework that connects applications to AI agents and external services*

[![npm version](https://badge.fury.io/js/cubicler.svg)](https://badge.fury.io/js/cubicler)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://github.com/hai**Cubicler: Where AI agents go to work** 🏢/workflows/Tests/badge.svg)](https://github.com/cubicler/Cubicler/actions)

## 🎯 What is Cubicler?

Cubicler is like a **smart switchboard operator** for AI. It sits between your applications and AI agents, helping them work together with external services.

### Simple Example

```text
Your App: "What's the weather in Jakarta?"
     ↓ 
Cubicler: Routes to the right AI agent
     ↓ 
AI Agent: Discovers available weather services
     ↓ 
AI Agent: Calls weather API through Cubicler
     ↓ 
Your App: Gets back "It's 28°C and partly cloudy!"
```

### What Cubicler Does

- 🔌 **Connects** your apps to AI agents (GPT, Claude, custom models)
- �️ **Provides tools** so AI agents can use external APIs and services
- � **Translates** between different API formats automatically
- ⚡ **Routes** messages to the right AI agent for each task

### Why Use Cubicler?

- ✅ **One setup, multiple AIs**: Switch between AI models without changing your code
- ✅ **Tool access**: AI agents can use weather APIs, databases, and more
- ✅ **Simple integration**: Just send HTTP requests, get responses back
- ✅ **Live updates**: Change configurations without restarting

---

## 🏗️ How It Works

Cubicler connects four types of components:

![Cubicler Architecture](cubicler_arch.jpg)

1. **Your app** sends a request to Cubicler
2. **Cubicler** routes it to the appropriate AI agent
3. **AI agent** can discover and use external services through Cubicler
4. **Response** flows back to your app with the result

---

## � Getting Started

### Quick Start with Docker

```bash
# Pull and run from Docker Hub
docker run -p 1503:1503 
  -e CUBICLER_AGENTS_LIST=https://your-cloud.com/agents.json 
  -e CUBICLER_PROVIDERS_LIST=https://your-cloud.com/providers.json 
  cubicler/cubicler:2.2.0
```

### Installation from Source

```bash
git clone https://github.com/cubicler/Cubicler.git
cd Cubicler
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Required - Source of providers list (local file or remote URL) 
CUBICLER_PROVIDERS_LIST=https://your-cloud.com/providers.json

# Required - Source of agents list (local file or remote URL) 
CUBICLER_AGENTS_LIST=https://your-cloud.com/agents.json

# Optional - Server port (default: 1503)
CUBICLER_PORT=1503
```

### Start the Server

```bash
# Development mode (with watch)
npm run dev

# Build and run production
npm run build
npm start
```

Visit: `http://localhost:1503`

---

## ⚙️ Configuration

Cubicler needs two configuration files: one for AI agents and one for external services.

### Environment Variables

```env
# Required: Where to find your agents configuration
CUBICLER_AGENTS_LIST=https://your-server.com/agents.json

# Required: Where to find your services configuration  
CUBICLER_PROVIDERS_LIST=https://your-server.com/providers.json

# Optional: Server port (default: 1503)
CUBICLER_PORT=1503
```

### Agents Configuration (`agents.json`)

This tells Cubicler which AI agents are available. You can use `{{env.VARIABLE_NAME}}` to substitute environment variables:

```json
{
  "basePrompt": "You are a helpful AI assistant.",
  "defaultPrompt": "You have access to various tools and services.",
  "agents": [
    {
      "identifier": "gpt_4o",
      "name": "GPT-4O Agent", 
      "transport": "http",
      "url": "{{env.GPT_AGENT_URL}}",
      "description": "Advanced reasoning and analysis",
      "prompt": "You specialize in complex problem solving."
    },
    {
      "identifier": "claude_3_5",
      "name": "Claude 3.5 Agent",
      "transport": "http", 
      "url": "{{env.CLAUDE_AGENT_URL}}",
      "description": "Creative and analytical tasks"
    },
    {
      "identifier": "local_llama",
      "name": "Local LLaMA Agent",
      "transport": "stdio",
      "url": "/usr/local/bin/llama-agent --model llama2 --temperature 0.7",
      "description": "Local LLaMA model running as a command-line process"
    }
  ]
}
```

#### 📝 Prompt Configuration Options

**Cubicler supports three flexible ways to define prompts:**

1. **📄 Inline Text** (most common):

   ```json
   {
     "basePrompt": "You are a helpful AI assistant with access to tools.",
     "prompt": "You specialize in data analysis and provide detailed insights."
   }
   ```

2. **📁 Local Files**:

   ```json
   {
     "basePrompt": "./prompts/base-system.md",
     "prompt": "../shared/specialist-prompt.txt"
   }
   ```

3. **🌐 Remote URLs**:

   ```json
   {
     "basePrompt": "https://your-server.com/prompts/base.md",
     "prompt": "https://raw.githubusercontent.com/your-org/prompts/main/agent.md"
   }
   ```

**✨ Smart Detection**: Cubicler automatically detects the prompt type:

- URLs starting with `http://` or `https://` are loaded remotely
- Paths containing `/`, `\`, `~`, or file extensions are treated as files
- Everything else is treated as inline text content
- **Graceful Fallback**: If file/URL loading fails, content is used as inline text

> **💡 Environment Variables**: Use `{{env.VARIABLE_NAME}}` syntax in any string value to substitute environment variables. Perfect for keeping sensitive URLs and tokens secure!

#### 🚀 Transport Types

Cubicler supports different ways to communicate with AI agents:

**HTTP Transport** (`"transport": "http"`):

- Standard REST API communication
- Agent runs as a web server
- `url` field contains the HTTP endpoint (e.g., `http://localhost:3000/agent`)

**Stdio Transport** (`"transport": "stdio"`):

- Local process-based communication via stdin/stdout
- Perfect for command-line AI agents or local model runners
- `url` field contains the command to execute (e.g., `/usr/local/bin/agent --model llama2`)
- Supports command arguments and environment variables
- Process timeout configurable via `AGENT_CALL_TIMEOUT` (default: 90000ms)

**Communication Flow for Stdio Agents**:

1. Cubicler spawns the process using the command in `url`
2. Sends `AgentRequest` as JSON to the process's stdin
3. Process responds with `AgentResponse` as JSON via stdout
4. Process exits or continues running (agent's choice)

### Providers Configuration (`providers.json`)

This tells Cubicler which external services AI agents can use. You can use `{{env.VARIABLE_NAME}}` to substitute environment variables:

```json
{
  "mcpServers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service",
      "description": "Get weather information",
      "transport": "http",
      "url": "{{env.WEATHER_API_URL}}",
      "headers": {
        "Authorization": "Bearer {{env.WEATHER_API_KEY}}"
      }
    }
  ],
  "restServers": [
    {
      "identifier": "user_api", 
      "name": "User API",
      "description": "Manage user information",
      "url": "{{env.USER_API_BASE_URL}}",
      "defaultHeaders": {
        "Authorization": "Bearer {{env.USER_API_TOKEN}}"
      },
      "endPoints": [
        {
          "name": "get_user",
          "description": "Get user by ID with optional profile data",
          "path": "/users/{userId}",
          "method": "GET",
          "userId": {"type": "string"},
          "query": {
            "type": "object",
            "properties": {
              "include_profile": {"type": "boolean"},
              "fields": {"type": "string", "description": "Comma-separated field names"}
            }
          }
        },
        {
          "name": "create_user",
          "description": "Create a new user",
          "path": "/users",
          "method": "POST",
          "payload": {
            "type": "object",
            "properties": {
              "name": {"type": "string", "description": "Full name"},
              "email": {"type": "string", "description": "Email address"},
              "role": {"type": "string", "enum": ["admin", "user"]}
            },
            "required": ["name", "email"]
          }
        },
        {
          "name": "update_user",
          "description": "Update user information",
          "path": "/users/{userId}",
          "method": "PATCH",
          "headers": {
            "X-Update-Source": "cubicler"
          },
          "userId": {"type": "string"},
          "payload": {
            "type": "object",
            "properties": {
              "name": {"type": "string"},
              "email": {"type": "string"}
            }
          }
        }
      ]
    }
  ]
}
```

> **💡 Environment Variables**: Use `{{env.VARIABLE_NAME}}` syntax in any string value to substitute environment variables. For example, `{{env.API_KEY}}` will be replaced with the value of the `API_KEY` environment variable.

#### 📋 REST Endpoint Configuration Explained

**REST servers** allow you to integrate existing APIs with Cubicler. Here's how each parameter works:

##### **Path Parameters** (`{variableName}`)

Parameters in curly braces are extracted from the path and replaced with actual values:

```json
{
  "path": "/users/{userId}/posts/{postId}",
  "userId": {"type": "string"},
  "postId": {"type": "string"}
}
```

**Result**: `/users/123/posts/456` when called with `userId: "123"` and `postId: "456"`

##### **Query Parameters** (`query` object)

Remaining parameters become URL query parameters:

```json
{
  "path": "/users",
  "query": {
    "type": "object",
    "properties": {
      "role": {"type": "string"},
      "limit": {"type": "number"},
      "tags": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

**Result**: `/users?role=admin&limit=10&tags=vip,premium`

**Query Parameter Conversion**:

- **Strings/Numbers/Booleans**: Direct values (`role=admin`)
- **Arrays of primitives**: Comma-separated (`tags=vip,premium`)  
- **Objects/Complex arrays**: JSON stringified (`filter={"active":true}`)

##### **Request Body** (`payload` object)

Used as JSON request body for POST/PUT/PATCH requests:

```json
{
  "method": "POST",
  "payload": {
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "email": {"type": "string"},
      "metadata": {"type": "object"}
    },
    "required": ["name", "email"]
  }
}
```

**Result**: JSON body `{"name": "John", "email": "john@example.com", "metadata": {...}}`

##### **Headers** (endpoint-specific)

Override or add to `defaultHeaders` for specific endpoints:

```json
{
  "defaultHeaders": {
    "Authorization": "Bearer {{env.API_TOKEN}}"
  },
  "endPoints": [
    {
      "headers": {
        "X-Custom-Header": "special-value",
        "Content-Type": "application/json"
      }
    }
  ]
}
```

##### **Complete Example**

```json
{
  "name": "get_user_posts",
  "description": "Get posts for a user with filtering",
  "path": "/users/{userId}/posts",
  "method": "GET",
  "headers": {
    "X-Source": "cubicler"
  },
  "userId": {"type": "string"},
  "query": {
    "type": "object", 
    "properties": {
      "status": {"type": "string", "enum": ["published", "draft"]},
      "limit": {"type": "number", "minimum": 1, "maximum": 100},
      "tags": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

**AI Agent Call**: `get_user_posts({"userId": "123", "status": "published", "limit": 10, "tags": ["tech", "ai"]})`

**HTTP Request**: `GET /users/123/posts?status=published&limit=10&tags=tech,ai`

### Environment Variable Substitution

**🔄 New Feature!** Cubicler now supports environment variable substitution in both configuration files using the `{{env.VARIABLE_NAME}}` syntax.

#### Using Environment Variables in Configuration

Set your environment variables:

```bash
export API_TOKEN="sk-1234567890abcdef"
export WEATHER_URL="https://api.weather.com" 
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
```

Then use them in your configuration files:

**agents.json with environment variables:**

```json
{
  "basePrompt": "You are a helpful AI assistant.",
  "agents": [
    {
      "identifier": "gpt_4o",
      "name": "GPT-4O Agent", 
      "transport": "http",
      "url": "{{env.GPT_AGENT_URL}}",
      "description": "Advanced reasoning with API key {{env.API_TOKEN}}"
    }
  ]
}
```

**providers.json with environment variables:**

```json
{
  "mcpServers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service",
      "transport": "http",
      "url": "{{env.WEATHER_URL}}/mcp",
      "headers": {
        "Authorization": "Bearer {{env.API_TOKEN}}",
        "X-Database": "{{env.DATABASE_URL}}"
      }
    }
  ],
  "restServers": [
    {
      "identifier": "user_api",
      "name": "User API", 
      "url": "{{env.API_BASE_URL}}/api",
      "defaultHeaders": {
        "Authorization": "Bearer {{env.REST_API_TOKEN}}"
      },
      "endPoints": [
        {
          "name": "get_user",
          "description": "Get user by ID from {{env.USER_SERVICE_NAME}}",
          "path": "/users/{userId}",
          "method": "GET"
        }
      ]
    }
  ]
}
```

#### Benefits of Environment Variable Substitution

- 🔒 **Security**: Keep sensitive API keys out of configuration files
- 🌍 **Flexibility**: Use different values for development, staging, and production
- 📦 **Docker-friendly**: Perfect for containerized deployments
- 🔄 **Dynamic**: Change configurations without editing files

#### How It Works

1. Cubicler loads your configuration files
2. Scans for `{{env.VARIABLE_NAME}}` patterns
3. Replaces them with actual environment variable values
4. If an environment variable is not set, the placeholder remains unchanged

---

## 🔐 JWT Authentication

Cubicler supports bidirectional JWT authentication to secure both incoming requests to Cubicler and outgoing requests to agents.

### Server Authentication (Protecting Cubicler Endpoints)

Configure JWT authentication for `/dispatch` and `/mcp` endpoints using a server configuration file:

**Environment Variable:**
```env
# Optional: Path to server configuration file
CUBICLER_SERVER_CONFIG=./server-config.yaml
```

**Server Configuration (`server-config.yaml`):**
```yaml
server:
  port: 1503
  host: "0.0.0.0"
  
  # Global JWT authentication (applies to all endpoints)
  auth:
    jwt:
      secret: "${JWT_SECRET}"
      issuer: "my-auth-server"
      audience: "cubicler-api"
      algorithms: ["HS256", "RS256"]
      
  # Per-endpoint JWT authentication (overrides global)
  endpoints:
    dispatch:
      auth:
        jwt:
          secret: "${DISPATCH_JWT_SECRET}"
          audience: "dispatch-api"
    mcp:
      auth:
        jwt:
          secret: "${MCP_JWT_SECRET}"
          audience: "mcp-api"
```

**Environment Variables:**
```env
# JWT secrets for verification
JWT_SECRET=your-global-jwt-secret
DISPATCH_JWT_SECRET=your-dispatch-specific-secret
MCP_JWT_SECRET=your-mcp-specific-secret
```

### Agent Authentication (Securing Outbound Requests)

Configure JWT authentication for HTTP agents in your `agents.json`:

**Static JWT Token:**
```json
{
  "agents": [
    {
      "identifier": "secure-agent",
      "name": "Secure Agent",
      "transport": "http",
      "config": {
        "url": "https://api.example.com/agent",
        "auth": {
          "type": "jwt",
          "config": {
            "token": "${JWT_TOKEN}"
          }
        }
      }
    }
  ]
}
```

**OAuth2 Client Credentials Flow:**
```json
{
  "agents": [
    {
      "identifier": "oauth-agent", 
      "name": "OAuth Agent",
      "transport": "http",
      "config": {
        "url": "https://api.example.com/agent",
        "auth": {
          "type": "jwt",
          "config": {
            "tokenUrl": "https://auth.example.com/token",
            "clientId": "${CLIENT_ID}",
            "clientSecret": "${CLIENT_SECRET}",
            "audience": "agent-api",
            "refreshThreshold": 5
          }
        }
      }
    }
  ]
}
```

**Environment Variables:**
```env
# Static JWT token
JWT_TOKEN=your-jwt-token-here

# OAuth2 credentials
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
```

### JWT Authentication Flow

1. **Client to Cubicler**: Clients include JWT token in `Authorization: Bearer <token>` header
2. **Cubicler Verification**: Validates token signature, expiry, issuer, and audience
3. **Cubicler to Agent**: Includes JWT token in outbound requests to agents
4. **Token Management**: Automatic token caching and refresh for OAuth2 flows

### Security Features

- ✅ **Bidirectional Security**: Both inbound and outbound requests are secured
- ✅ **Flexible Configuration**: Per-endpoint or global authentication settings
- ✅ **Multiple Algorithms**: Support for HS256, RS256, and other standard algorithms
- ✅ **Token Refresh**: Automatic OAuth2 token refresh with configurable thresholds
- ✅ **Environment Variables**: Secure credential management
- ✅ **Comprehensive Validation**: Issuer, audience, expiry, and signature verification

---

## 📡 Using Cubicler

### Main API Endpoints

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `POST /dispatch` | Send messages to any available agent | Most common usage |
| `POST /dispatch/:agentId` | Send messages to a specific agent | When you need a particular AI model |
| `GET /agents` | List all available agents | See what AI agents are connected |
| `GET /health` | Check system health | Monitor if everything is working |

### Sending Messages

**Basic Request:**

```json
POST /dispatch

{
  "messages": [
    {
      "sender": {
        "id": "user_123",
        "name": "John Doe"
      },
      "type": "text",
      "content": "What's the weather like in Jakarta?"
    }
  ]
}
```

**Response:**

```json
{
  "sender": {
    "id": "gpt_4o", 
    "name": "GPT-4O Agent"
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

### Built-in Tools for AI Agents

AI agents automatically get access to these Cubicler tools:

#### `cubicler_available_servers`

- **Purpose**: Lists all connected external services
- **Parameters**: None
- **Returns**: List of available APIs and their capabilities

#### `cubicler_fetch_server_tools`

- **Purpose**: Gets detailed information about a specific service
- **Parameters**: `serverIdentifier` (string)
- **Returns**: All available functions from that service

---

---

## 📚 Integration Guides

Detailed guides for different types of developers:

### For Application Developers

- **[Client Integration Guide](CLIENT_INTEGRATION.md)** - Build chat apps, Telegram bots, web interfaces

### For AI Engineers

- **[Agent Integration Guide](AGENT_INTEGRATION.md)** - Create AI agents that work with Cubicler

### For Backend Developers

- **[Provider Integration Guide](PROVIDER_INTEGRATION.md)** - Connect your APIs and services

---

## 🎯 Real-World Example

Here's what happens when someone asks for weather through a Telegram bot:

### 1. User Request

```json
POST /dispatch
{
  "messages": [
    {
      "sender": {"id": "telegram_user_123"},
      "content": "What's the weather in Paris?"
    }
  ]
}
```

### 2. AI Agent Discovery

The AI agent uses built-in tools to discover available services:

- Calls `cubicler_available_servers` → finds weather service
- Calls `cubicler_fetch_server_tools` → gets weather functions

### 3. Service Call

AI agent calls: `1r2dj4_get_current_weather({"city": "Paris"})`

> **💡 Function Naming**: The function name `1r2dj4_get_current_weather` follows Cubicler's hash-based naming convention. The `1r2dj4` part is a 6-character hash derived from the server identifier and URL (`weather_service:http://localhost:4000/mcp`). This ensures function names are:
>
> - **Collision-resistant**: No conflicts between services
> - **Config-order independent**: Same server always gets same hash
> - **Deterministic**: Predictable and stable across deployments

### 4. Final Response

```json
{
  "content": "The weather in Paris is currently 22°C and sunny!",
  "metadata": {"usedTools": 2}
}
```

---

## 🧪 Features

- 🔌 **MCP Protocol Support**: Connect to standardized AI services
- 🎯 **Flexible Agent Configuration**: Multiple AI models, custom prompts  
- 🔐 **REST API Integration**: Use any HTTP API as an AI tool
- 🛠️ **Built-in Discovery Tools**: AI agents can explore available services
- 🧩 **Modular Architecture**: Clean, maintainable service separation
- 📘 **TypeScript**: Full type safety and excellent developer experience
- 🔄 **Hot Configuration**: Update settings without restarting

---

## 🧪 Development & Testing

```bash
# Run tests
npm test

# Development mode with auto-reload
npm run dev

# Build for production
npm run build
npm start
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if needed
5. Submit a pull request

---

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

---

## 🎯 What's Next?

Cubicler is designed for future expansion:

- **Multi-transport Support**: WebSocket, Server-Sent Events
- **Enhanced MCP Features**: Advanced protocol capabilities  
- **Multi-agent Workflows**: Coordinated AI agent interactions
- **Advanced Orchestration**: Complex routing and processing

---

**Cubicler: Where AI agents go to work** 🏢
