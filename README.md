# 🏢 Cubicle

> *A modular AI orchestration framework where GPT agents go to work*

[![npm version](https://badge.fury.io/js/cubicle.svg)](https://badge.fury.io/js/cubicle)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://github.com/hainayanda/Cubicle/workflows/Tests/badge.svg)](https://github.com/hainayanda/Cubicle/actions)

Cubicle is a lightweight, modular AI orchestration framework that connects GPT-based agents to real-world services via a clean REST API. Think of it as providing a **desk or cubicle where AI agents can go to work** — complete with tools, specifications, and function call capabilities.

---

## 💡 What Problem Does Cubicle Solve?

Modern AI agents often need to interact with external systems, but many frameworks tightly couple prompt logic, function specs, and code, making updates and scaling challenging. Cubicle addresses this by:

- Decoupling prompt and function specs from the codebase using YAML/Markdown
- Enabling hot-swappable configurations—no redeployment required for updates
- Offering a secure, modular, and testable middleware for AI-to-API orchestration
- Simplifying the process of adding, updating, or swapping services and functions

---

## 🛠️ What Does Cubicle Do?

- Loads system prompts and function specs from local or remote sources
- Exposes RESTful endpoints for:
  - Fetching the current prompt (`GET /prompt`)
  - Fetching the function spec (`GET /spec`)
  - Routing function calls to the appropriate microservice (`POST /call/:function_name`)
- Handles parameter merging, environment variable substitution, and flexible routing
- Simplifies building, testing, and scaling AI agent integrations

---

## 🚦 How Do I Use Cubicle?

1. **Start the Cubicle server** (see "Getting Started" below)
2. **Fetch the system prompt** for your agent via `GET /prompt`
3. **Retrieve the function spec** via `GET /spec` to view available functions and parameters
4. **Invoke functions** by sending a `POST` request to `/call/:function_name` with the required parameters
5. **Update configurations** by modifying the YAML/Markdown sources—no code changes needed

Cubicle is designed to be consumed by AI agents, backend services, or any client that needs a simple, unified API for orchestrating function calls.

---

## 📦 Features

- 🔌 Hot-swappable configuration (no code changes needed)
- 🎯 Clean separation of prompt/spec logic from code
- 🔐 Secure environment variable substitution
- 🚀 RESTful HTTP endpoints for interacting with agents
- 🧩 Modular architecture with single-responsibility services
- 🕵️‍♂️ Hidden override parameters (not visible to AI agents)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
git clone https://github.com/hainayanda/Cubicle.git
cd Cubicle
npm install
```

### Environment Setup

Create a `.env` file:

```env
# YAML function + routing spec source
CUBICLE_SPEC_SOURCE=./spec.example.yaml

# System prompt source (Markdown or text)
CUBICLE_PROMPT_SOURCE=./prompt.example.md

# Optional: Port number (default: 1503)
PORT=1503
```

### Start the Server

```bash
node src/index.js
```

Visit: `http://localhost:1503`

---

## 🧠 How It Works

### 1. Function Spec (YAML)

```yaml
version: 1
services:
  user_api:
    base_url: https://api.example.com
    default_headers:
      Authorization: "Bearer {{env.API_KEY}}"
    endpoints:
      get_user:
        method: GET
        path: /users/{id}
        parameters:
          id:
            type: string
          include_details:
            type: boolean

functions:
  getUserById:
    service: user_api
    endpoint: get_user
    description: Get user information by ID
    override_parameters:
      include_details: true
```

### 2. System Prompt (Markdown)

```markdown
# Customer Support Assistant

You are a helpful customer support agent. You can use the getUserById function 
to fetch user data. Always respond politely and helpfully.

## Functions
- getUserById: Get user details by ID
```

### 3. Request Flow

- AI calls: `getUserById({ id: "123", extra: "data" })`
- Override adds: `{ include_details: true }`
- Final URL: `GET /users/123?extra=data&include_details=true`

---

## 📘 API Reference

### GET `/prompt`

Returns the system prompt.

```json
{ "prompt": "# Customer Support Assistant ..." }
```

---

### GET `/spec`

Returns OpenAI-compatible function specs (override params excluded).

```json
[
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
]
```

---

### POST `/call/:function_name`

Executes the specified function.

**Request:**

```json
{ "id": "123", "extra_param": "value" }
```

**Response:**

```json
{ "id": "123", "name": "John Doe", "email": "john@example.com" }
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific suites
npm test -- tests/core/
npm test -- tests/utils/
npm test -- tests/integration.test.js
```

- ✅ Unit tests (services and utilities)
- ✅ Integration tests (mock external APIs)
- ✅ 26+ test cases

---

## 📁 Project Structure

```
src/
├── core/             # Core services (prompt, spec, function)
├── utils/            # Environment variable utils
└── index.js          # Main Express server
```

---

## 🔐 Environment Variable Use

YAML files can reference environment variables:

```yaml
Authorization: "Bearer {{env.API_KEY}}"
```

---

## 🛠️ Configuration Samples

### Basic

```yaml
services:
  weather_api:
    base_url: https://api.weather.com
    default_headers:
      X-API-Key: "{{env.WEATHER_API_KEY}}"
    endpoints:
      current_weather:
        method: GET
        path: /current/{city}
functions:
  getCurrentWeather:
    service: weather_api
    endpoint: current_weather
    override_parameters:
      units: "metric"
```

### Multiple Services

```yaml
services:
  user_service:
    ...
  email_service:
    ...
functions:
  getUserProfile:
    ...
  sendEmail:
    ...
```

---

## 🤝 Contributing

We welcome contributions! Please check the [CONTRIBUTING.md](CONTRIBUTING.md) file.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---

## 🙏 Acknowledgments

- Modern ES Modules + Node.js
- Tested using Jest + Supertest
- YAML parsing with `js-yaml`
- Env management via `dotenv`

---

Made with ❤️ for the AI community.

**Cubicle: Where AI agents go to work** 🏢
