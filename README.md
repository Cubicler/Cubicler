# 🏢 Cubicler

> *A modular AI orchestration framework where AI agents go to work*

[![npm version](https://badge.fury.io/js/cubicler.svg)](https://badge.fury.io/js/cubicler)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://github.com/hainayanda/Cubicler/workflows/Tests/badge.svg)](https://github.com/hainayanda/Cubicler/actions)

Cubicler is a lightweight, modular AI orchestration framework that connects AI agents to real-world services via a clean REST API. Think of it as providing a **desk or cubicle where AI agents can go to work** — complete with tools, specifications, and function call capabilities.

## 🎯 What Does It Do? (In 30 Seconds)

```text
AI Agent: "Hey Cubicler, what can I do?"
Cubicler: "Here are your available functions: getUserById, sendEmail..."

AI Agent: "Get user 123 for me"
Cubicler: "Sure!" → calls https://api.example.com/users/123 → returns data

AI Agent: "Thanks! Now send them an email"
Cubicler: "On it!" → calls https://email-api.com/send → returns success
```

**The magic:** Change the YAML config file, and suddenly your AI agent has new powers. No code changes, no restarts!

---

## 💡 What Problem Does Cubicler Solve?

Modern AI agents often need to interact with external systems, but many frameworks tightly couple prompt logic, function specs, and code, making updates and scaling challenging. Cubicler addresses this by:

- Decoupling prompt and function specs from the codebase using YAML/Markdown
- Enabling hot-swappable configurations—no redeployment required for updates
- Offering a secure, modular, and testable middleware for AI-to-API orchestration
- Simplifying the process of adding, updating, or swapping services and functions

---

## 🛠️ What Does Cubicler Do?

**Simple:** It's a bridge between AI agents and your APIs.

**Specifically:**

- 🔄 **Loads configs** from YAML/Markdown files (local or remote)
- 🚀 **Serves 3 endpoints:** `/prompt`, `/spec`, `/call/functionName`
- 🔧 **Handles the messy stuff:** parameter validation, type conversion, API routing
- 🔥 **Hot-swappable:** Update configs without touching code or restarting

---

## 🚦 How Do I Use Cubicler?

**The Complete Flow:**

1. **Start Cubicler** → `npm run dev` (development) or `npm start` (production)
2. **AI Agent asks "What can I do?"** → `GET /spec` → Gets available functions
3. **AI Agent asks "How should I behave?"** → `GET /prompt` → Gets system instructions
4. **AI Agent executes** → `POST /call/getUserById` → Cubicler routes to real API
5. **Update anytime** → Edit YAML/Markdown files (no restart needed!)

**Perfect for:** AI chatbots, automation systems, or any app that needs AI agents to interact with APIs.

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

### Prerequisites

- Node.js (v18 or higher)
- npm
- TypeScript (installed via npm dependencies)

### Installation

```bash
git clone https://github.com/hainayanda/Cubicler.git
cd Cubicler
npm install
```

### Environment Setup

Create a `.env` file:

```env
# YAML function + routing spec source
CUBICLER_SPEC_SOURCE=./spec.example.yaml

# System prompt source (Markdown or text)
CUBICLER_PROMPT_SOURCE=./prompt.example.md

# Optional: Port number (default: 1503)
CUBICLER_PORT=1503

# Optional: Strict parameter validation (default: false)
# Set to 'true' to throw errors for unknown parameters
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

Cubicler acts as a **smart translator** between AI agents and your APIs. Here's the simple flow:

### 🔄 The Data Flow

```text
┌─────────────┐    1. "What can I do?"     ┌──────────────┐    4. Translate & Call    ┌─────────────┐
│             │ ─────────────────────────► │              │ ────────────────────────► │             │
│  AI Agent   │    2. "How should I act?"  │   Cubicler   │                           │  Real APIs  │
│             │ ◄───────────────────────── │              │ ◄──────────────────────── │             │
└─────────────┘    3. "Do this function"   └──────────────┘    5. Return Response     └─────────────┘
```

### 📝 Configuration Files

**YAML Spec** (defines what functions are available):

```yaml
version: 2
services:
  user_api:
    base_url: https://api.example.com
    endpoints:
      get_user:
        method: POST
        path: /users/{id}
        parameters:
          id: { type: string }

functions:
  getUserById:
    service: user_api
    endpoint: get_user
    description: Get user information by ID
```

**Markdown Prompt** (tells AI how to behave):

```markdown
# Customer Support Assistant
You help customers by looking up their information.
Use getUserById to fetch user data.
```

### 🎯 Example Request Flow

**What the AI Agent sends:**

```json
POST /call/getUserById
{ "id": "123" }
```

**What Cubicler does:**

- Looks up `getUserById` function in YAML spec
- Finds it maps to `user_api` service → `get_user` endpoint
- Translates to: `POST https://api.example.com/users/123`
- Forwards the response back to AI Agent

---

## 📘 API Reference

### Quick Reference

| Endpoint | What It Does | Example Response |
|----------|-------------|------------------|
| `GET /prompt` | Get AI instructions | `{"prompt": "You are a helpful assistant..."}` |
| `GET /spec` | Get available functions | `[{"name": "getUserById", "parameters": {...}}]` |
| `POST /call/getUserById` | Execute a function | `{"id": "123", "name": "John", "email": "john@example.com"}` |

### Detailed Endpoints

#### GET `/prompt`

Returns the system prompt that tells the AI agent how to behave.

```json
{ "prompt": "# Customer Support Assistant ..." }
```

#### GET `/spec`

Returns OpenAI-compatible function specs (override params and payload excluded).

```json
[
  {
    "name": "getUserById",
    "description": "Get user information by ID",
    "parameters": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "payload": {
          "type": "object",
          "properties": {
            "filters": { 
              "type": "array",
              "items": { "type": "string" }
            },
            "metadata": { "type": "object" }
          }
        }
      }
    }
  }
]
```

#### POST `/call/:function_name`

Executes the specified function.

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

---

## ⚡ Advanced Features

### 🔒 Hidden Parameters

Add secret parameters that AI agents never see, but get automatically included in API calls:

```yaml
functions:
  getUserById:
    override_parameters:
      api_key: "secret-key"  # AI never sees this, but it's always sent
      include_details: true
```

### 🌍 Environment Variables

Keep secrets safe by referencing environment variables:

```yaml
default_headers:
  Authorization: "Bearer {{env.API_TOKEN}}"  # Pulls from .env file
```

### 📦 Multiple Services

Connect to as many APIs as you want in one config:

```yaml
services:
  user_api:
    base_url: https://users.example.com
  email_api:
    base_url: https://email.example.com
  payment_api:
    base_url: https://payments.example.com
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

## 📁 Project Structure

```
src/
├── core/             # Core services (prompt, spec, function)
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

## 🔒 Strict Parameter Validation

Control how Cubicler handles unknown parameters sent by AI agents:

### Non-Strict Mode (Default)
```env
CUBICLER_STRICT_PARAMS=false
```
- Unknown parameters are logged as warnings
- Request continues with unknown parameters included
- More forgiving for development and testing

### Strict Mode
```env
CUBICLER_STRICT_PARAMS=true
```
- Unknown parameters cause immediate error response
- Helps catch AI agent mistakes and spec mismatches
- Recommended for production environments

**Example Error Response in Strict Mode:**
```json
{
  "error": "Unknown parameter 'unexpected_param' is not allowed in strict mode"
}
```

---

## 🛠️ Configuration Samples

### Basic

```yaml
version: 2
services:
  weather_api:
    base_url: https://api.weather.com
    default_headers:
      X-API-Key: "{{env.WEATHER_API_KEY}}"
    endpoints:
      current_weather:
        method: GET
        path: /current/{city}
        parameters:
          city:
            type: string
          units:
            type: string
        payload:
          type: object
          properties:
            options:
              type: array
              items:
                type: string

functions:
  getCurrentWeather:
    service: weather_api
    endpoint: current_weather
    description: Get current weather for a city
    override_parameters:
      units: "metric"
    override_payload:
      options: ["temperature", "humidity", "pressure"]
```

### Multiple Services

```yaml
version: 2
services:
  user_service:
    base_url: https://api.users.com
    endpoints:
      get_profile:
        method: GET
        path: /profile/{id}
        parameters:
          id: { type: string }
  email_service:
    base_url: https://api.email.com
    endpoints:
      send_email:
        method: POST
        path: /send
        parameters:
          priority: { type: number }
        payload:
          type: object
          properties:
            to: { type: string }
            subject: { type: string }
            body: { type: string }

functions:
  getUserProfile:
    service: user_service
    endpoint: get_profile
    description: Get user profile information
  sendEmail:
    service: email_service
    endpoint: send_email
    description: Send an email
    override_parameters:
      priority: 1
```

---

## 🤝 Contributing

We welcome contributions! Please check the [CONTRIBUTING.md](CONTRIBUTING.md) file.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

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
