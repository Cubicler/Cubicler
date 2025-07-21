# ⚙️ Cubicler Instructions

You're assisting in improving **Cubicler**, a modular AI orchestration framework designed to run GPT-based agents connected to real-world services.

You're here to help improve and expand Cubicler — a proper desk for AI Agents: it gets a prompt, a set of function specs, and the ability to call those functions — all defined externally in YAML/Markdown. Your job is to help refine, optimize, and expand this system cleanly and modularly.

---

## 🧱 System Overview

Cubicler acts as the **orchestrator/middleware** between frontend services, AI agents, and REST APIs. 

**Current Implementation:**
- Uses `agents.yaml` that defines which agents are available and their endpoints
- Uses `prompts.md` that defines the basic system prompts for AI agents  
- Supports `prompts.<agentName>.md` for agent-specific prompts
- Uses `providers.yaml` that defines the available providers and their endpoints
- Exposes REST API endpoints for calling agents and executing provider functions

**API Endpoints:**
- `POST /call` - calls default agent
- `POST /call/:agent` - calls specific agent  
- `POST /execute/:functionName` - executes provider functions
- `GET /provider/:providerName/spec` - gets provider spec and context
- `GET /prompt/:agentName` - gets prompt for specific agent
- `GET /agents` - lists available agents
- `GET /health` - health check for all services

---

## 📦 Configuration

Current environment variables:

```env
# Required - Source of prompts (local folder or remote URL)
CUBICLER_PROMPTS_SOURCE=https://your-cloud.com/prompts

# Required - Source of agents list (local file or remote URL) 
CUBICLER_AGENTS_LIST=https://your-cloud.com/agents.yaml

# Required - Source of providers list (local file or remote URL)
CUBICLER_PROVIDERS_LIST=https://your-cloud.com/providers.yaml

# Optional - Server port (default: 1503)
CUBICLER_PORT=1503

# Optional - Strict parameter validation (default: false)
CUBICLER_STRICT_PARAMS=true
```

---

## 📑 YAML Agents List Format

```yaml
version: 1
kind: agents
agents:
  - name: "gpt-4o"
    endpoint: "localhost:3000/call"
  - name: "claude-3.5"
    endpoint: "localhost:3001/call"
  - name: "gemini-1.5"
    endpoint: "localhost:3002/call"
```

---

## 📑 YAML Providers List Format

```yaml
version: 1
kind: providers
providers:
  - name: "weather_api"
    description: "A provider for Weather API"
    spec_source: "localhost:4000/spec/weather_api.yaml" # URL to the spec file
    context_source: "localhost:4000/context/weather_api.md" # URL to the context
  - name: "mock_service"
    description: "A mock service for testing"
    spec_source: "localhost:4000/spec/mock_service.yaml" # URL to the spec file
    context_source: "localhost:4000/context/mock_service.md" # URL to the context
```

## 📑 Markdown Context Example

```markdown
# Weather API Context
This is the context for the Weather provider. It provides weather information based on city and country.
## getWeather
This function retrieves the current weather for a specified city and country.
- **Parameters:**
  - `city`: The name of the city (string)
  - `country`: The name of the country (string)
- **Response:**
  - `id`: Unique identifier for the weather report (string)
  - `city`: The name of the city (string)
  - `country`: The name of the country (string)
  - `temperature`: Current temperature in Celsius (number)
  - `conditions`: Current weather conditions (string)
  - `description`: A brief description of the weather (string)
```

## 📑 YAML Spec Format

```yaml
version: 2
kind: specs
services:
  weather_api:
    base_url: https://api.weather.com
    default_headers:
      Authorization: "Bearer {{env.API_KEY}}"
    endpoints:
      get_weather:
        method: POST
        path: /api/weather/{city}/{country}
        headers:
            X-Client-Version: "cubicler/1.0"
        parameters:
          city:
            type: string
          country:
            type: string
        payload:
          type: object
          properties:
            filters:
              type: array
              items:
                type: string
        response:
          type: object
          properties:
            id:
              type: string
            city:
              type: string
            country:
              type: string
            temperature:
              type: number
            conditions:
              type: string
            description:
              type: string

functions:
  getWeather:
    service: weather_api
    endpoint: get_weather
    description: Get weather information by city and country
    override_parameters:
      country: "US"
    override_payload:
      filters: ["now"]
```

### Parameter Types & Handling

**Supported Types:** `string`, `number`, `boolean`, `array`, `object`

**Parameters vs Payload:**
- **`parameters`**: URL parameters only (path + query)
  - Object/array types → converted to minified JSON in query parameters
- **`payload`**: HTTP request body (JSON format for object/array)

**Function Spec Generation:**
- Both `parameters` and `payload` are flattened into AI agent function spec
- Payload will be flattened and appears as parameter named `payload`
- Overriden parameters/payload are hidden from AI agents

---

## High-Level Flow

1. **POST /call is called**:
   Cubicler will call the selected/default AI Agent with:
   - prompts from `prompts.md` or `prompts.<agentName>.md` 
   - function spec to get the available functions for the selected provider via `GET /provider/:providerName/spec`
   
2. **AI Agent decides**:
   Based on the prompts and function spec, the AI Agent will determine what it needs to do:
   - Call `GET /provider/:providerName/spec` to get the function spec and context for a specific provider:
     - Returned spec will be included in the AI Agent's function spec
     - Returned context will be sent to the AI Agent for understanding the function spec
   - Call `POST /execute/:functionName` to execute a function call:
     - Cubicler will convert the AI agent's function call into a REST API call to the correct provider and return the results
   - Return a response

---

## ✅ Your Role

When I ask you for code, your job is to:
 • Help refine and optimize the TypeScript system modularly
 • Suggest improvements to architecture, performance, and usability
 • Ensure the system remains clean, hot-swappable, and modular
 • Maintain TypeScript type safety and best practices
 • Avoid overengineering (no LangChain, etc.)
 • Assume this system may grow into a multi-agent runtime in the future
 • When in doubt, Ask

## ✅ DO NOT

 • Do not suggest centralized monolith logic
 • Do not embed prompt logic directly into interfaces
 • Do not use frameworks that tie code to prompt behavior (e.g. LangChain abstractions)
 • Do not sacrifice type safety for convenience

You're here to help improve and expand Cubicler — a proper TypeScript desk for AI Agents.