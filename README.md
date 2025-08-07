# Cubicler

![Cubicler Logo](cubicler_logo_inline.jpeg)

> *A modular AI orchestration framework that connects applications to AI agents and external services*

[![npm version](https://badge.fury.io/js/cubicler.svg)](https://badge.fury.io/js/cubicler)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://github.com/cubicler/Cubicler/workflows/Tests/badge.svg)](https://github.com/cubicler/Cubicler/actions)

**Cubicler: Where AI agents go to work** 🏢

## 🎯 What is Cubicler?

Cubicler is a **smart AI orchestration hub** that connects your applications to AI agents and external services. Think of it as a universal translator and router for AI interactions.

### The Problem It Solves

- **Multiple AI models**: GPT, Claude, local models - all with different APIs
- **Scattered tools**: Weather APIs, databases, and services that AI agents need access to
- **Complex integration**: Each AI model needs different setup and communication patterns
- **No standardization**: Every service speaks a different protocol

### The Cubicler Solution

```text
Your App → Cubicler → AI Agent → External Services
    ↑                     ↓
    └─── Response ←───────┘
```

**Simple workflow:**

1. Your app sends a message to Cubicler
2. Cubicler routes it to the right AI agent
3. AI agent discovers and uses available tools/services
4. Response flows back to your app

### Core Benefits

- 🔌 **Universal AI Integration**: Switch between AI models without code changes
- 🛠️ **Rich Tool Ecosystem**: AI agents can use APIs, databases, and external services
- 📱 **Rich Message Support**: Text, images, URLs with comprehensive metadata
- ⚡ **Multiple Transports**: HTTP, SSE streaming, stdio processes, and direct models
- 🔐 **Enterprise Security**: JWT authentication and secure communications
- 📊 **Easy Configuration**: JSON-based setup with environment variable support

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
  cubicler/cubicler:2.3.0
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

# Optional - Path to Cubicler server configuration file
CUBICLER_CONFIG=./cubicler.json
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

Cubicler uses two main configuration files to connect AI agents and external services.

### Quick Configuration Overview

**Environment Variables:**

```env
# Required: Where to find your configurations
CUBICLER_AGENTS_LIST=https://your-server.com/agents.json
CUBICLER_PROVIDERS_LIST=https://your-server.com/providers.json

# Optional: Server settings
CUBICLER_PORT=1503
CUBICLER_CONFIG=./cubicler.json
```

**Simple Agent Configuration (`agents.json`):**

```json
{
  "basePrompt": "You are a helpful AI assistant.",
  "agents": [
    {
      "identifier": "gpt-4o-direct",
      "name": "GPT-4o Direct Agent",
      "transport": "direct",
      "config": {
        "provider": "openai",
        "apiKey": "${OPENAI_API_KEY}",
        "model": "gpt-4o",
        "summarizerModel": "gpt-4o-mini"
      },
      "description": "OpenAI GPT-4o with AI summarization for complex tool responses"
    },
    {
      "identifier": "my-http-agent",
      "name": "Custom HTTP Agent", 
      "transport": "http",
      "config": {
        "url": "http://localhost:3000/agent",
        "auth": {
          "type": "jwt",
          "config": {
            "token": "${AGENT_JWT_TOKEN}"
          }
        }
      }
    }
  ]
}
```

**Simple Provider Configuration (`providers.json`):**

```json
{
  "mcpServers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service",
      "transport": "http",
      "config": {
        "url": "{{env.WEATHER_API_URL}}/mcp",
        "headers": {
          "Authorization": "Bearer {{env.WEATHER_API_KEY}}"
        }
      }
    }
  ],
  "restServers": [
    {
      "identifier": "user_api",
      "name": "User Management API",
      "transport": "http",
      "config": {
        "url": "https://api.example.com"
      },
      "endPoints": [
        {
          "name": "get_user_status",
          "path": "/users/{userId}/status",
          "method": "GET",
          "response_transform": [
            {
              "path": "status",
              "transform": "map",
              "map": { "0": "Offline", "1": "Online", "2": "Away" }
            },
            {
              "path": "last_login",
              "transform": "date_format",
              "format": "YYYY-MM-DD HH:mm:ss"
            },
            {
              "path": "internal_data",
              "transform": "remove"
            }
          ]
        }
      ]
    }
  ]
}
```

### 🔄 Response Transformations

Cubicler can automatically clean and transform API responses before sending them to AI agents. This makes legacy APIs much easier for AI agents to understand and work with.

**Supported Transformations:**

| Type | Purpose | Example |
|------|---------|---------|
| `map` | Transform values using key-value mapping | `{"0": "Offline", "1": "Online"}` |
| `date_format` | Format dates with custom patterns | `"YYYY-MM-DD HH:mm:ss"` |
| `template` | Apply string templates | `"User: {value}"` |
| `regex_replace` | Replace text using regex | `{"pattern": "\\s+", "replacement": " "}` |
| `remove` | Remove sensitive/unnecessary fields | Removes debug info, internal IDs |

**Advanced Path Syntax:**

```json
{
  "response_transform": [
    {
      "path": "users[].status",
      "transform": "map",
      "map": { "1": "Active", "0": "Inactive" }
    },
    {
      "path": "_root[].metadata.internal",
      "transform": "remove"
    },
    {
      "path": "timestamps.created",
      "transform": "date_format", 
      "format": "YYYY-MM-DD"
    }
  ]
}
```

**Before transformation:**

```json
{
  "users": [
    {"id": 1, "status": "1", "metadata": {"internal": "secret"}},
    {"id": 2, "status": "0", "metadata": {"internal": "secret"}}
  ],
  "timestamps": {"created": "2023-12-25T10:30:45.000Z"}
}
```

**After transformation:**

```json
{
  "users": [
    {"id": 1, "status": "Active"},
    {"id": 2, "status": "Inactive"}
  ],
  "timestamps": {"created": "2023-12-25"}
}
```

### 🔐 JWT Authentication for Providers

Secure your MCP servers and REST APIs with JWT authentication:

**Static JWT Token:**

```json
{
  "mcpServers": [
    {
      "identifier": "secure_mcp",
      "name": "Secure MCP Server", 
      "transport": "http",
      "config": {
        "url": "https://secure-api.example.com/mcp",
        "auth": {
          "type": "jwt",
          "config": {
            "token": "${MCP_JWT_TOKEN}"
          }
        }
      }
    }
  ],
  "restServers": [
    {
      "identifier": "secure_api",
      "name": "Secure REST API",
      "transport": "http",
      "config": {
        "url": "https://secure-api.example.com/api",
        "auth": {
          "type": "jwt",
          "config": {
            "tokenUrl": "https://auth.example.com/oauth/token",
            "clientId": "${OAUTH_CLIENT_ID}",
            "clientSecret": "${OAUTH_CLIENT_SECRET}",
            "audience": "api-audience",
            "refreshThreshold": 10
          }
        }
      },
      "endPoints": [
        {
          "name": "get_secure_data",
          "path": "/secure/data/{id}",
          "method": "GET"
        }
      ]
    }
  ]
}
```

**JWT Features:**

- 🔐 **Static tokens** - Simple API key-style authentication
- 🔄 **OAuth2 client credentials flow** - Enterprise-grade authentication
- ⏰ **Automatic token refresh** - Configurable refresh thresholds
- 💾 **Token caching** - Improved performance and reduced API calls
- 🌍 **Environment variable support** - Keep secrets secure

### 🤖 AI Agent Summarization

Direct agents (OpenAI integration) support intelligent task delegation to specialized summarizer agents:

```json
{
  "identifier": "smart-agent",
  "transport": "direct",
  "config": {
    "provider": "openai",
    "model": "gpt-4o",
    "summarizerModel": "gpt-4o-mini",
    "sessionMaxTokens": 8192
  }
}
```

**How it works:**

- The main GPT agent can delegate specific tasks to the `summarizerModel` with focused prompts
- The summarizer calls tools independently with smaller token overhead and specialized instructions
- Example: Main agent says *"summarize error log that might be related to memory issues"*
- The `gpt-4o-mini` summarizer then calls the error log tool and provides a focused summary
- More efficient than the main agent processing large datasets with its full context
- Enables specialized task processing while keeping the main conversation lightweight

> **💡 Environment Variables**: Use `{{env.VARIABLE_NAME}}` syntax to substitute environment variables securely.

**For detailed configuration options, see the integration guides:**

- **🤖 [Agent Integration Guide](AGENT_INTEGRATION.md)** - Complete agent setup (Direct, HTTP, SSE, Stdio)
- **� [Provider Integration Guide](PROVIDER_INTEGRATION.md)** - MCP servers and REST API integration
- **� JWT Authentication** - Detailed security configuration examples

---

## 🔐 Security & Authentication

Cubicler supports comprehensive JWT authentication for securing both incoming requests and outgoing agent communications.

**Quick JWT Setup:**

```env
# Environment variables
JWT_SECRET=your-jwt-secret
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
```

**Server Configuration (`cubicler.json`):**

```json
{
  "server": {
    "auth": {
      "jwt": {
        "secret": "${JWT_SECRET}",
        "issuer": "cubicler-instance",
        "required": true
      }
    }
  }
}
```

**Agent Authentication (in `agents.json`):**

```json
{
  "config": {
    "auth": {
      "type": "jwt",
      "config": {
        "token": "${JWT_TOKEN}"
      }
    }
  }
}
```

> **For complete security configuration**, see the [Authentication Guide](docs/AUTH_INTEGRATION.md) and integration guides.

---

## 📡 Using Cubicler

### Main API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /dispatch` | Send messages to any available agent |
| `POST /dispatch/:agentId` | Send messages to a specific agent |
| `GET /agents` | List all available agents |
| `GET /health` | Check system health |

### Quick Example

**Send a text message:**

```json
POST /dispatch
{
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John"},
      "type": "text",
      "content": "What's the weather like in Jakarta?"
    }
  ]
}
```

**Get response:**

```json
{
  "sender": {"id": "gpt_4o", "name": "GPT-4O Agent"},
  "type": "text",
  "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
  "metadata": {"usedToken": 150, "usedTools": 2}
}
```

### 📱 Rich Message Support

Cubicler supports rich messaging with text, images, URLs, and comprehensive metadata:

#### Message Types

| Type | Purpose | Content Field | Metadata |
|------|---------|---------------|----------|
| `text` | Text messages and responses | String content | Optional |
| `image` | Base64 encoded images | Base64 image data | Required (format, fileName, etc.) |
| `url` | Image/file URLs | URL string | Required (format, fileExtension, etc.) |
| `null` | Empty or system messages | null | Optional |

#### Image Messages

**Send an image (Base64):**

```json
POST /dispatch
{
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John"},
      "type": "image",
      "content": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAY...",
      "metadata": {
        "format": "base64",
        "fileName": "vacation-photo.jpg",
        "fileExtension": "jpg",
        "fileSize": 2048576
      }
    }
  ]
}
```

**Send an image (URL):**

```json
POST /dispatch
{
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John"},
      "type": "url",
      "content": "https://example.com/images/vacation-photo.jpg",
      "metadata": {
        "format": "url",
        "fileName": "vacation-photo.jpg",
        "fileExtension": "jpg"
      }
    }
  ]
}
```

**AI Agent Image Response:**

```json
{
  "sender": {"id": "gpt_4o_vision", "name": "GPT-4O Vision Agent"},
  "type": "image",
  "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB...",
  "contentMetadata": {
    "format": "base64",
    "fileName": "generated-diagram.png",
    "fileExtension": "png",
    "fileSize": 1024768
  },
  "metadata": {"usedToken": 2500, "usedTools": 1}
}
```

#### Message Metadata Fields

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `format` | `"base64" \| "url"` | How content is encoded/referenced | ✅ |
| `fileName` | `string` | Original filename | Optional |
| `fileExtension` | `string` | File extension (jpg, png, pdf, etc.) | Optional |
| `fileSize` | `number` | File size in bytes | Optional |

#### Multi-Message Conversations

```json
POST /dispatch
{
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John"},
      "type": "text",
      "content": "Can you analyze this image?"
    },
    {
      "sender": {"id": "user_123", "name": "John"},
      "type": "image",
      "content": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
      "metadata": {
        "format": "base64",
        "fileName": "chart.jpg",
        "fileExtension": "jpg"
      }
    }
  ]
}
```

> **💡 Vision-Enabled Agents**: Use GPT-4 Vision or other vision-capable agents to analyze images, extract text from documents, describe visual content, and generate image-based insights.

> **For complete API documentation and examples**, see [Client Integration Guide](CLIENT_INTEGRATION.md).

---

## 📚 Integration Guides

Choose your integration path:

### 🚀 Application Developers

Connect your apps, bots, and interfaces to Cubicler:

- **[Client Integration Guide](docs/CLIENT_INTEGRATION.md)** - Build chat apps, Telegram bots, web interfaces

### 🤖 AI Engineers  

Build and deploy AI agents:

- **[Agent Integration Overview](docs/AGENT_INTEGRATION.md)** - Start here for agent integration
- **[HTTP Agents](docs/HTTP_AGENT_INTEGRATION.md)** - Web-based agents (most common)
- **[Stdio Agents](docs/STDIO_AGENT_INTEGRATION.md)** - Command-line and local agents  
- **[SSE Agents](docs/SSE_AGENT_INTEGRATION.md)** - Real-time streaming agents

### 🔧 Service Providers

Connect your APIs and services:

- **[Provider Integration Overview](docs/PROVIDER_INTEGRATION.md)** - Start here for service integration
- **HTTP MCP Providers** - RESTful MCP services (see overview)
- **SSE MCP Providers** - Streaming MCP services (see overview)
- **Stdio MCP Providers** - Command-line MCP services (see overview)

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

Raw API response: `{"temp": "22", "condition": "01", "debug_trace": "..."}`

After transformation: `{"temperature": "22°C", "condition": "Sunny"}`

> **💡 Response Transformations**: Cubicler automatically cleans API responses using configured transformations. In this example, the weather service maps condition codes ("01" → "Sunny") and formats temperatures, while removing debug information that would confuse the AI agent.

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
- ⚡ **Direct AI Integration**: Built-in OpenAI GPT support without separate agent services
- 🤖 **AI Agent Summarization**: GPT can delegate focused tasks to specialized summarizer agents
- � **Rich Message Support**: Text, images, URLs with metadata for multimedia conversations
- �🔐 **REST API Integration**: Use any HTTP API as an AI tool
- 🧩 **Response Transformations**: Clean and transform API responses automatically
- 🛡️ **Comprehensive JWT Authentication**: Secure agents, MCP servers, and REST APIs
- 🔐 **OAuth2 & Static Tokens**: Enterprise authentication with automatic refresh
- 🛠️ **Built-in Discovery Tools**: AI agents can explore available services
- 🧩 **Modular Architecture**: Clean, maintainable service separation
- 📘 **TypeScript**: Full type safety and excellent developer experience
- 🔄 **Hot Configuration**: Update settings without restarting
- 🚀 **Multiple Transport Types**: Direct, HTTP, SSE, and Stdio for both agents and MCP servers

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

- **Advanced Vision AI**: Enhanced image analysis and generation capabilities
- **Multi-transport Support**: WebSocket support for real-time communication
- **Enhanced MCP Features**: Advanced protocol capabilities  
- **Multi-agent Workflows**: Coordinated AI agent interactions
- **Advanced Orchestration**: Complex routing and processing

---

**Cubicler: Where AI agents go to work** 🏢
