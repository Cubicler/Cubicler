# ⚙️ Cubicler Instructions

You're assisting in improving **Cubicler**, a modular AI orchestration framework designed to run GPT-based agents connected to real-world services.

Think of CuYou're here to help improve and expand Cubicler — a proper desk for AI Agent.icler as a **desk or cubicle where GPT "goes to work"**: it gets a prompt, a set of function specs, and the ability to call those functions — all defined externally in YAML/Markdown. Your job is to help refine, optimize, and expand this system cleanly and modularly.

---

## 🧱 System Overview

- Acts as the **control center / middleware**
- Exposes:
  - `GET /prompt` – fetches current system prompt (Markdown/Doc/URL)
  - `GET /spec` – fetches YAML-based AI agent function spec
  - `POST /call` – handles AI Agent function_call routing
- Parses a YAML spec from a remote or local location (`env.CUBICLER_SPEC_SOURCE`)
- Gets a prompt from a remote or local location (`env.CUBICLER_PROMPT_SOURCE`)
- Sends calls to the correct microservice via REST

---

## 📦 Configuration

These are set via environment variables:

```env
# Source of the function + routing spec in YAML format
CUBICLER_SPEC_SOURCE=https://your-cloud.com/specs/agent.yaml

# Source of the system prompt (Markdown or plain text)
CUBICLER_PROMPT_SOURCE=https://your-cloud.com/prompts/agent.md
```

---

## 📑 YAML Spec Format

```yaml
version: 2
services:
  mock_service:
    base_url: https://api.cubicler.com
    default_headers:
      Authorization: "Bearer {{env.API_KEY}}"
    endpoints:
      get_mock:
        method: POST
        path: /mock_service/get/{mock_id}/{mock_name}
        headers:
            X-Client-Version: "cubicler/1.0"
        parameters:
          mock_id:
            type: number
          mock_name:
            type: string
          active:
            type: boolean
        payload:
          type: object
          properties:
            filters:
              type: array
              items:
                type: string
            metadata:
              type: object
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
      active: true
    override_payload:
      filters: ["default", "active"]
      metadata: { "source": "system" }
```

### Parameter Types & Handling

**Supported Types:** `string`, `number`, `boolean`, `array`, `object`

**Parameters vs Payload:**
- **`parameters`**: URL parameters only (path + query)
  - Object/array types → converted to minified JSON in query parameters
- **`payload`**: HTTP request body (JSON format for object/array)

**Function Spec Generation:**
- Both `parameters` and `payload` are flattened into AI agent function spec
- Payload appears as parameter named `payload`
- Override parameters/payload are hidden from AI agents

---

## 🔄 Function Call Flow

When a function is called via `POST /call`, here's the exact flow:

1. **Collect Parameters:**
   - Get override parameters from YAML spec (hidden from AI)
   - Get override payload from YAML spec (hidden from AI)
   - Get parameters from the AI agent's function call
   - Separate `payload` from URL parameters

2. **Validate & Convert Types:**
   ```javascript
   // Validate parameters against their type definitions
   const validatedParams = validateAndConvertParameters(userParams, endpointSpec.parameters);
   const validatedOverrides = validateAndConvertParameters(overrideParams, endpointSpec.parameters);
   ```

3. **Merge Parameters (overrides win):**
   ```javascript
   const mergedParameters = { ...validatedParams, ...validatedOverrides };
   ```

4. **Handle Payload:**
   ```javascript
   // Validate payload and merge with overrides
   let finalPayload = validateAndConvertPayload(userPayload, endpointSpec.payload);
   if (overridePayload) {
     finalPayload = { ...finalPayload, ...overridePayload };
   }
   ```

5. **Replace URL Path Parameters:**
   ```javascript
   // "/api/{id}/{name}" + {id: 123, name: "test"} → "/api/123/test"
   ```

6. **Send Unused Parameters as Query & Payload as Body:**
   - **URL query:** Remaining parameters (object/array → minified JSON)
   - **Request body:** Payload as JSON

**Example:**
- YAML spec: `override_parameters: { active: true }`, `override_payload: { filters: ["default"] }`
- AI calls: `{ id: "123", name: "test", payload: { filters: ["custom"], priority: 1 } }`
- Result URL: `/api/123/test?active=true`
- Result Body: `{ "filters": ["default"], "priority": 1 }`

---

## Project Structure

```
Cubicler/
├── src/
│   ├── index.ts                 # Main Express server (TypeScript)
│   ├── core/
│   │   ├── promptService.ts     # Loads, stores, and serves the system prompt
│   │   ├── specService.ts       # Loads, stores, validates, and serves the spec
│   │   └── functionService.ts   # Handles function calls
│   └── utils/
│       ├── types.ts             # TypeScript type definitions
│       ├── envHelper.ts         # Environment variable utilities
│       └── parameterHelper.ts   # Parameter validation and conversion
├── tests/
│   ├── core/                    # Core service tests (TypeScript)
│   ├── utils/                   # Utility tests (TypeScript)
│   ├── integration.test.ts      # Integration tests
│   └── mocks/                   # Mock files for testing
├── dist/                        # Compiled JavaScript output
├── .env
├── tsconfig.json                # TypeScript configuration
├── jest.config.js               # Jest test configuration
├── package.json
└── README.md
```

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