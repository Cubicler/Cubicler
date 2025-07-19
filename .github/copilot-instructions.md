# ⚙️ Cubicle Instructions

You're assisting me in improving **Cubicle**, a modular AI orchestration framework designed to run GPT-based agents connected to real-world services.

Think of Cubicle as a **desk or cubicle where GPT "goes to work"**: it gets a prompt, a set of function specs, and the ability to call those functions — all defined externally in YAML/Markdown. Your job is to help me refine, optimize, and expand this system cleanly and modularly.

---

## 🧱 System Overview

- Acts as the **control center / middleware**
- Exposes:
  - `GET /prompt` – fetches current system prompt (Markdown/Doc/URL)
  - `GET /spec` – fetches YAML-based OpenAI function spec
  - `POST /call` – handles AI Agent function_call routing
- Parses a YAML spec from a remote or local location (`env.CUBICLE_SPEC_SOURCE`)
- Gets a prompt from a remote or local location (`env.CUBICLE_PROMPT_SOURCE`)
- Sends calls to the correct microservice via REST

---

## 📦 Configuration

These are set via environment variables:

```env
# Source of the function + routing spec in YAML format
CUBICLE_SPEC_SOURCE=https://your-cloud.com/specs/agent.yaml

# Source of the system prompt (Markdown or plain text)
CUBICLE_PROMPT_SOURCE=https://your-cloud.com/prompts/agent.md
```

---

## 📑 YAML Spec Format

```yaml
version: 1
services:
  mock_service:
    base_url: https://api.cubicle.io
    default_headers:
      Authorization: "Bearer {{env.API_KEY}}"
    endpoints:
      get_mock:
        method: GET
        path: /mock_service/get/{mock_id}/{mock_name}
        headers:
            X-Client-Version: "cubicle/1.0"
        parameters:
          mock_id:
            type: string
          mock_name:
            type: string
        response:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
            description:
              type: string

functions:
  getMock:
    service: mock_service
    endpoint: get_mock
    description: Get mock object by ID
    override_parameters:
      mock_name: "my_mock"
```

---

## 🔄 Function Call Flow

When a function is called via `POST /call`, here's the exact flow:

1. **Collect Parameters:**
   - Get override parameters from YAML spec (hidden from AI)
   - Get parameters from the AI agent's function call

2. **Merge Parameters (overrides win):**
   ```javascript
   const mergedParameters = { ...userParameters, ...overrideParameters };
   ```

3. **Replace URL Path Parameters:**
   ```javascript
   // "/api/{id}/{name}" + {id: "123", name: "test"} → "/api/123/test"
   // Track which parameters were used in the path
   ```

4. **Send Unused Parameters as Query/Body:**
   - **GET requests:** Remaining parameters become query string
   - **POST requests:** Remaining parameters become JSON body

**Example:**
- YAML spec: `override_parameters: { api_key: "{{env.SECRET}}" }`
- AI calls: `{ id: "123", name: "test", filter: "active" }`
- Result URL: `/api/123/test?filter=active` (api_key injected in headers)

---

## Project Structure

```
map-context-service/
├── src/
│   ├── index.js
│   ├── core/
│   │   ├── promptService.js     # Loads, stores, and serves the system prompt
│   │   ├── specService.js       # Loads, stores, validates, and serves the spec
│   │   └── functionService.js   # Handles function calls
│   └── utils/  # Any utility functions
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## ✅ Your Role

When I ask you for code, your job is to:
 • Help me refine and optimize the system modularly
 • Suggest improvements to architecture, performance, and usability
 • Ensure the system remains clean, hot-swappable, and modular
 • Avoid overengineering (no LangChain, etc.)
 • Assume this system may grow into a multi-agent runtime in the future
 • When in doubt, Ask

## ✅ DO NOT

 • Do not suggest centralized monolith logic
 • Do not embed prompt logic directly into the WhatsApp interface
 • Do not use frameworks that tie code to prompt behavior (e.g. LangChain abstractions)

You’re here to help me improve and expand Cubicle — a proper desk for AI Agent.