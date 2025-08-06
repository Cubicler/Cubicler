# 🤖 Agent Integration Overview

> *Your complete guide to building AI agents that work with Cubicler*

This guide provides an overview of integrating AI agents with Cubicler. Whether you're building web services, command-line tools, or streaming agents, this document will help you understand the concepts and point you to the right implementation guide.

---

## 🎯 What is a Cubicler Agent?

A **Cubicler Agent** is an AI service that handles user messages and can use tools and external services through Cubicler. Think of it as the "brain" that processes requests and provides intelligent responses.

### Core Responsibilities

1. **Receive requests** from Cubicler containing user messages and available tools
2. **Process messages** using your AI model (GPT, Claude, local models, etc.)  
3. **Use available tools** by calling back to Cubicler's service discovery system
4. **Return structured responses** back to the user through Cubicler

### What Makes an Agent "Cubicler-Compatible"

- **Understands the AgentRequest format** - receives structured data about available tools and servers
- **Can call external services** via Cubicler's MCP endpoint
- **Returns standardized AgentResponse** format
- **Supports tool discovery** using Cubicler's built-in functions

---

## 🏗️ How Agent Integration Works

```text
┌─────────────────┐   1. User Request      ┌──────────────────┐
│   Your App      │───────────────────────►│   Cubicler       │
│                 │                        │ (Orchestrator)   │
└─────────────────┘                        └──────────────────┘
        ▲                                            │
        │                                            │ 2. Route to Agent
        │ 6. Final Response                          ▼
        │                                  ┌──────────────────┐
        │                                  │ Your AI Agent    │
        │                                  │ (HTTP/SSE/Stdio) │
        │                                  └──────────────────┘
        │                                            │
        │                                            │ 3. Discover Tools
        │                                            ▼
        │                                  ┌──────────────────┐
        │                                  │   Cubicler       │
        │ 5. Agent Response                │ (Tool Discovery) │
        │                                  └──────────────────┘
        │                                            │
        │                                            │ 4. Use External Services
        │                                            ▼
        │                                  ┌──────────────────┐
        └────────────────────────────────  │ MCP Servers /    │
                                           │ REST APIs        │
                                           └──────────────────┘
```

### Integration Steps

1. **User sends message** to your application
2. **Application forwards to Cubicler** via `/dispatch` endpoint  
3. **Cubicler routes to your agent** using configured transport (HTTP/SSE/Stdio)
4. **Agent processes request** and can discover/use available tools and services
5. **Agent returns response** to Cubicler with the result
6. **Cubicler sends response** back to your application

---

## 🚀 Choose Your Transport Type

Cubicler supports multiple ways for agents to communicate, each optimized for different use cases:

### HTTP Transport (Most Common)

**Best for:** Web services, cloud deployments, containerized agents

- ✅ **Simple request/response** pattern using standard HTTP
- ✅ **Works anywhere** - local, cloud, containers
- ✅ **Easy to debug** with standard HTTP tools
- ✅ **Supports authentication** and custom headers

**👉 [HTTP Agent Integration Guide](HTTP_AGENT_INTEGRATION.md)**

### Stdio Transport (Local & Efficient)

**Best for:** Command-line tools, local models, scripts

- ✅ **Lightweight** - no web server needed
- ✅ **Perfect for local AI models** like LLaMA, Ollama
- ✅ **Simple stdin/stdout** communication
- ✅ **Process-based isolation**

**👉 [Stdio Agent Integration Guide](STDIO_AGENT_INTEGRATION.md)**

### SSE Transport (Real-time Streaming)

**Best for:** Long-running agents, real-time responses

- ✅ **Persistent connections** for better performance
- ✅ **Real-time streaming** responses  
- ✅ **Server-sent events** for live updates
- ✅ **Ideal for chat interfaces**

**👉 [SSE Agent Integration Guide](SSE_AGENT_INTEGRATION.md)**

### Direct Transport (Built-in)

**Best for:** Simple deployments without separate agent services

- ✅ **No external agent needed** - runs directly in Cubicler
- ✅ **Built-in OpenAI GPT support** (GPT-4o, GPT-4 Turbo, etc.)
- ✅ **Minimal configuration** required
- ✅ **Perfect for getting started**

---

## 🔐 Security & Authentication

Cubicler supports comprehensive JWT authentication to secure both incoming and outgoing requests.

### When JWT is Enabled

- **Incoming**: Your agent receives JWT tokens in `Authorization` header from Cubicler
- **Outgoing**: Your agent includes JWT tokens when calling back to Cubicler's `/mcp` endpoint
- **Verification**: Agents should verify JWT tokens to ensure requests are from authorized Cubicler instances

### Implementation

Each transport-specific guide includes JWT authentication examples:

- **HTTP agents**: Standard JWT middleware with Express/Flask
- **SSE agents**: JWT validation on connection and response endpoints  
- **Stdio agents**: JWT tokens passed via environment variables

**👉 See the transport-specific guides for detailed JWT implementation examples**

---

## 📋 Core Message Formats

All Cubicler agents use standardized message formats regardless of transport type.

### AgentRequest (What Your Agent Receives)

```json
{
  "agent": {
    "identifier": "my_agent",
    "name": "My AI Agent", 
    "description": "Agent description",
    "prompt": "System prompt for the agent"
  },
  "tools": [
    {
      "name": "cubicler_available_servers",
      "description": "Discover available services",
      "parameters": {...}
    }
  ],
  "servers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service",
      "description": "Weather information provider"
    }
  ],
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John Doe"},
      "timestamp": "2025-08-06T10:30:00Z",
      "type": "text",
      "content": "What's the weather in Paris?"
    }
  ]
}
```

### AgentResponse (What Your Agent Returns)

```json
{
  "timestamp": "2025-08-06T10:30:15Z",
  "type": "text", 
  "content": "The weather in Paris is sunny, 25°C.",
  "metadata": {
    "usedToken": 150,
    "usedTools": 2
  }
}
```

---

## 🛠️ Built-in Tools for Agents

All agents automatically get access to Cubicler's built-in discovery tools:

### `cubicler_available_servers`

**Purpose:** Lists all connected external services  
**Parameters:** None  
**Returns:** Information about available APIs and their capabilities

### `cubicler_fetch_server_tools`

**Purpose:** Gets detailed tool information from a specific service  
**Parameters:** `serverIdentifier` (string)  
**Returns:** All available functions from that service with their schemas

### Using External Services

Your agent calls external services via Cubicler's `/mcp` endpoint:

```json
{
  "jsonrpc": "2.0",
  "id": 1, 
  "method": "tools/call",
  "params": {
    "name": "hash_function_name",
    "arguments": {"city": "Paris"}
  }
}
```

**👉 Each transport guide shows specific implementation examples for calling tools**

---

## 🚀 Quick Start Guide

Ready to build your first agent? Here's your roadmap:

### 1. Choose Your Transport

Pick the transport that fits your deployment:

- **Starting out?** → [HTTP Agent Guide](HTTP_AGENT_INTEGRATION.md) (easiest to debug)
- **Local model?** → [Stdio Agent Guide](STDIO_AGENT_INTEGRATION.md) (most efficient)  
- **Real-time needs?** → [SSE Agent Guide](SSE_AGENT_INTEGRATION.md) (streaming responses)
- **Simple setup?** → Use Direct transport (built-in, no coding needed)

### 2. Implement Your Agent

Each transport guide provides:

- ✅ **Complete implementation examples** in multiple languages
- ✅ **Step-by-step setup instructions**
- ✅ **Testing and debugging tips**
- ✅ **JWT authentication examples**
- ✅ **Best practices and common issues**

### 3. Configure in agents.json

Add your agent to the configuration:

```json
{
  "agents": [{
    "identifier": "my_agent",
    "name": "My AI Agent", 
    "transport": "http", 
    "url": "http://localhost:3000/agent",
    "description": "My custom AI agent",
    "prompt": "You are a helpful assistant."
  }]
}
```

### 4. Test Your Agent

```bash
curl -X POST http://localhost:1503/dispatch/my_agent \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"sender": {"id": "test"}, "type": "text", "content": "Hello!"}]}'
```

---

## 🎯 Next Steps

**👉 Ready to implement?** Choose your transport and dive into the detailed guide:

- **[HTTP Agent Integration](HTTP_AGENT_INTEGRATION.md)** - Web-based agents (most common)
- **[Stdio Agent Integration](STDIO_AGENT_INTEGRATION.md)** - Command-line agents
- **[SSE Agent Integration](SSE_AGENT_INTEGRATION.md)** - Real-time streaming agents

**🔧 Need services for your agent?** Check out [Provider Integration Overview](PROVIDER_INTEGRATION.md)

---

Made with ❤️ for AI engineers building with Cubicler.
