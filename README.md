# 🏢 Cubicler

> *A modular AI orchestration framework where AI agents go to work*

[![npm version](https://badge.fury.io/js/cubicler.svg)](https://badge.fury.io/js/cubicler)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://github.com/hainayanda/Cubicler/workflows/Tests/badge.svg)](https://github.com/hainayanda/Cubicler/actions)

Cubicler is a lightweight, modular AI orchestration framework that connects AI agents to real-world services via a clean REST API. Think of it as providing a **desk or cubicle where AI agents can go to work** — complete with tools, specifications, and function call capabilities.

## 🎯 What Does It Do? (In 30 Seconds)

```text
Frontend (Telegram): "User wants weather for Paris"
Cubicler: "Got it, asking AI agent..." → calls Agent
Agent: "I need weather data" → calls back to Cubicler
Cubicler: "Sure!" → calls Weather Provider API → returns data to Agent
Agent: "The weather in Paris is sunny, 25°C" → returns to Cubicler
Cubicler: → returns response to Frontend
Frontend: Shows user "The weather in Paris is sunny, 25°C"
```

**The magic:** Change the YAML config file, and suddenly your AI agents have new powers. No code changes, no restarts!

---

## 💡 What Problem Does Cubicler Solve?

Modern AI systems need to connect multiple components: frontend apps, AI agents, and external services. But most frameworks tightly couple these components, making updates and scaling challenging. Cubicler addresses this by:

- **Orchestrating 4 key components:** Frontend Services ↔ Cubicler ↔ AI Agents ↔ External Providers
- Decoupling configuration from code using hot-swappable YAML/Markdown files
- Enabling seamless integration between chat apps (Telegram, Slack) and AI agents
- Providing a secure, modular middleware for AI-to-API orchestration
- Allowing real-time updates without redeployment

---

## 🛠️ What Does Cubicler Do?

**Simple:** It's the orchestrator that connects your frontend, AI agents, and external APIs.

**The 4-Component Architecture:**

1. 🖥️ **Frontend Services** (Telegram, Slack, Chat Apps, Web Apps)
2. 🏢 **Cubicler** (The Orchestrator - this project)
3. 🤖 **AI Agents** (GPT, Claude, Gemini, etc.)
4. 🔌 **External Providers** (REST APIs, databases, services)

**What Cubicler handles:**

- 🔄 **Loads configs** from YAML/Markdown files (local or remote)
- 🚀 **Routes requests** between frontends, agents, and providers
- 🔧 **Handles the messy stuff:** parameter validation, type conversion, API routing
- 🔥 **Hot-swappable:** Update configs without touching code or restarting

---

## 🚦 How Do I Use Cubicler?

**The Complete Flow:**

1. **Frontend** (Telegram bot, Slack app, etc.) → sends user request to Cubicler
2. **Cubicler** → routes request to appropriate AI Agent  
3. **AI Agent** → processes request, may ask Cubicler to execute external functions
4. **Cubicler** → executes functions via External Providers, returns results to Agent
5. **AI Agent** → sends final response back through Cubicler to Frontend
6. **Update anytime** → Edit YAML/Markdown files (agents, providers, prompts) - no restart needed!

**Perfect for:** Telegram bots, Slack apps, Discord bots, web chat interfaces, or any system that needs AI agents connected to real services.

---

## 📚 Integration Guides

Comprehensive guides for different types of developers:

- **🖥️ [Frontend Integration Guide](FRONTEND_INTEGRATION.md)** - For frontend developers building chat apps, Telegram bots, or web interfaces
- **🔌 [Provider Development Guide](PROVIDER_DEVELOPMENT.md)** - For backend developers creating external API services
- **🤖 [Agent Integration Guide](AGENT_INTEGRATION.md)** - For AI developers building OpenAI, Claude, or custom AI agents

---

## 📦 Features

- 🔌 Hot-swappable configuration (no code changes needed)
- 🎯 Clean separation of prompt/spec logic from code
- 🔐 Secure environment variable substitution
- 🚀 RESTful HTTP endpoints for interacting with agents
- 🧩 Modular architecture with single-responsibility services
- 🕵️‍♂️ Hidden override parameters (not visible to AI agents)
- 🔧 **Parameter type validation and conversion** (`string`, `number`, `boolean`, `array`, `object`)
- 📡 **Separate URL parameters and payload handling**
- 🎛️ **Enhanced override system** (parameters + payload)
- 🔄 **Smart parameter merging and type conversion**
- 📘 **Full TypeScript support** with comprehensive type definitions

---

## 🚀 Getting Started

### Quick Start with Docker Hub

The fastest way to get Cubicler running:

```bash
# Pull and run from Docker Hub
docker run -p 1503:1503 \
  -v $(pwd)/config:/app/config \
  -e CUBICLER_PROMPTS_SOURCE=/app/config/prompts.md \
  -e CUBICLER_AGENTS_LIST=/app/config/agents.yaml \
  -e CUBICLER_PROVIDERS_LIST=/app/config/providers.yaml \
  hainayanda/cubicler:latest
```

**Available tags:**

- `hainayanda/cubicler:latest` - Latest stable release
- `hainayanda/cubicler:1.0.0` - Version 1.0.0

Visit: `http://localhost:1503`

### Quick Start with Docker Compose

For easier configuration management:

```bash
# Create your config directory
mkdir config
cp prompt.example.md config/prompts.md
cp agents.example.yaml config/agents.yaml  
cp providers.example.yaml config/providers.yaml

# Run with Docker Compose
docker-compose up -d
```

### Installation from Source

```bash
git clone https://github.com/hainayanda/Cubicler.git
cd Cubicler
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Source of prompts (local folder or remote URL)
CUBICLER_PROMPTS_SOURCE=./prompt.example.md

# Source of agents list (local file or remote URL) 
CUBICLER_AGENTS_LIST=./agents.yaml

# Source of providers list (local file or remote URL)
CUBICLER_PROVIDERS_LIST=./providers.yaml

# Optional: Port number (default: 1503)
CUBICLER_PORT=1503

# Optional: Strict parameter validation (default: false)
CUBICLER_STRICT_PARAMS=false
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

## 🧠 How It Works

Cubicler acts as the **central orchestrator** in a 4-component architecture:

### 🔄 The Complete Data Flow

```text
┌─────────────────┐    1. User Request      ┌──────────────┐    2. Route to Agent    ┌─────────────┐
│  Frontend App   │ ──────────────────────► │   Cubicler   │ ──────────────────────► │ AI Agent    │
│ (Telegram,      │                         │(Orchestrator)│                         │(GPT, Claude)│
│  Slack, etc.)   │ ◄────────────────────── │              │ ◄────────────────────── │             │
└─────────────────┘    6. Final Response    └──────────────┘    5. Agent Response    └─────────────┘
                                                    ▲ │                                    │ ▲
                                                  4.│ │3. Execute                          │ │
                                                    │ │   Function                         │ │
                                                    │ ▼                                    │ │
                                            ┌──────────────┐                               │ │
                                            │   External   │ ◄─────────────────────────────┘ │
                                            │   Provider   │                                 │
                                            │ (REST APIs)  │ ────────────────────────────────┘
                                            └──────────────┘    3a. Function Request
```

**Step-by-Step:**

1. **Frontend** sends user request to Cubicler
2. **Cubicler** routes to appropriate AI Agent based on configuration
3. **AI Agent** processes request, may request function execution from Cubicler
4. **Cubicler** calls External Provider APIs and returns data to Agent
5. **AI Agent** sends response back to Cubicler
6. **Cubicler** returns final response to Frontend

### 📝 Configuration Files

**Agents YAML** (defines available AI agents):

```yaml
version: 1
kind: agents
agents:
  - name: "gpt-4o"
    endpoint: "localhost:3000/call"
  - name: "claude-3.5"
    endpoint: "localhost:3001/call"
```

**Providers YAML** (defines available external services):

```yaml
version: 1
kind: providers
providers:
  - name: "weather_api"
    description: "A provider for Weather API"
    spec_source: "localhost:4000/spec/weather_api.yaml"
    context_source: "localhost:4000/context/weather_api.md"
```

**Markdown Prompt** (tells AI how to behave):

```markdown
# Customer Support Assistant
You help customers by looking up their information.
You have access to multiple providers through the Cubicler framework.
```

> 📖 **Need detailed examples?** Check out our [integration guides](#-integration-guides) for complete setup instructions.

### 🎯 Example Request Flow

**User asks for weather via Telegram bot**

**Frontend → Cubicler:**

```json
POST /call/weather_agent
{
  "messages": [
    {"role": "user", "content": "What's the weather in Paris?"}
  ]
}
```

**Cubicler → AI Agent:** Routes request to weather_agent

**AI Agent → Cubicler:** "I need weather data"

```json
POST /execute/getWeather
{"city": "Paris", "country": "France"}
```

**Cubicler → External Provider:** Calls weather API

**Full Response Chain:** Weather data → AI Agent → Cubicler → Frontend → User sees "It's sunny and 25°C in Paris!"

> 📖 **Want to build this yourself?** Check our [Frontend Integration Guide](FRONTEND_INTEGRATION.md) and [Agent Integration Guide](AGENT_INTEGRATION.md).

---

## 📘 API Reference

### Quick Reference

| Endpoint | What It Does | Example Response |
|----------|-------------|------------------|
| `GET /prompt/:agentName` | Get AI instructions | `{"prompt": "You are a helpful assistant..."}` |
| `GET /provider/:providerName/spec` | Get provider functions | `{"spec": [...], "context": "..."}` |
| `POST /call` | Call default agent | `{"response": "AI agent response"}` |
| `POST /call/:agent` | Call specific agent | `{"response": "AI agent response"}` |
| `POST /execute/:functionName` | Execute a function | `{"id": "123", "name": "John", "email": "john@example.com"}` |
| `GET /agents` | List available agents | `{"availableAgents": [...]}` |
| `GET /health` | System health check | `{"status": "healthy", "services": {...}}` |

### Detailed Endpoints

#### GET `/prompt/:agentName`

Returns the system prompt for a specific agent.

```json
{ "prompt": "# Customer Support Assistant ..." }
```

#### GET `/provider/:providerName/spec`

Returns function specs and context for a specific provider.

```json
{
  "spec": [
    {
      "name": "getUserById",
      "description": "Get user information by ID",
      "parameters": {
        "type": "object",
        "properties": {
          "id": { "type": "string" }
        }
      }
    }
  ],
  "context": "This provider handles user data operations..."
}
```

#### POST `/execute/:function_name`

Executes the specified function through the provider system.

**Request:**

```json
{ 
  "id": "123", 
  "payload": { 
    "filters": ["active", "verified"],
    "metadata": { "priority": "high" }
  }
}
```

**Response:**

```json
{ 
  "id": "123", 
  "name": "John Doe", 
  "email": "john@example.com",
  "details": { "role": "admin" }
}
```

#### POST `/call` or `/call/:agent`

Calls an AI agent with messages. The agent will use the available providers to fulfill the request.

**Request:**

```json
{
  "messages": [
    {"role": "user", "content": "Get user information for ID 123"}
  ]
}
```

**Response:**

```json
{
  "response": "I found the user information for ID 123: John Doe (john@example.com)"
}
```

---

## ⚡ Advanced Features

### 🔒 Provider-based Architecture  

Cubicler uses a modular provider system where each provider defines its own specs and contexts.

### 🌍 Environment Variables

Provider specs support environment variable substitution with `{{env.VARIABLE_NAME}}`.

### 📦 Multiple Agents

Connect to different AI agents for different purposes - customer support, data analysis, content creation, etc.

### 🔒 Strict Parameter Validation

Control how Cubicler handles unknown parameters sent by AI agents with `CUBICLER_STRICT_PARAMS`.

> 📖 **Want full examples and implementation details?** See our [integration guides](#-integration-guides).

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific suites
npm test -- tests/core/
npm test -- tests/utils/
npm test -- tests/integration.test.ts
```

- ✅ Unit tests (services and utilities)
- ✅ Integration tests (mock external APIs)

---

## 📁 Project Structure

```text
src/
├── core/             # Core services (prompt, agent, provider, execution, call)
├── utils/            # Type definitions & utilities  
└── index.ts          # Main Express server
dist/                 # Compiled JavaScript output
tests/                # TypeScript test files
```

---

## 🔐 Environment Variable Use

YAML files can reference environment variables:

```yaml
Authorization: "Bearer {{env.API_KEY}}"
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific suites
npm test -- tests/core/
npm test -- tests/utils/
npm test -- tests/integration.test.ts
```

- ✅ Unit tests (services and utilities)
- ✅ Integration tests (mock external APIs)

---

## 🤝 Contributing

We welcome contributions! Please check the [CONTRIBUTING.md](CONTRIBUTING.md) file.

---

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

## 🙏 Acknowledgments

- Modern ES Modules + Node.js + TypeScript
- Tested using Jest + Supertest + ts-jest
- YAML parsing with `js-yaml`
- Env management via `dotenv`
- Full type safety with TypeScript

---

Made with ❤️ for the AI community.

**Cubicler: Where AI agents go to work** 🏢
