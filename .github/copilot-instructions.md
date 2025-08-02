# Cubicler AI Development Instructions

Cubicler is a **modular AI orchestration framework** that connects applications to AI agents and external services through the Model Context Protocol (MCP) and REST APIs.

## 🧱 System Overview

Cubicler acts as the **orchestrator/middleware** between frontend services, AI agents, MCP servers, and REST APIs.

## 📝 Global Development Standards

**Please follow my global development standards and coding preferences:**

# Global Development Standards & Best Practices

> **Author Preferences**: These are my personal coding standards and preferences that should be followed across all projects, regardless of programming language.

## 🎯 Core Philosophy

Write code that is **clean**, **maintainable**, **testable**, and **scalable**. Always prioritize code readability and long-term maintainability over short-term convenience. **Prefer simple, focused code over complex abstractions** - it's better to have code that does one thing well than code that tries to be reusable for everything.

## � SOLID Principles (Universal)

**Always follow SOLID principles when writing code:**

- **S**ingle Responsibility Principle - Each class/function/module should have one reason to change
- **O**pen/Closed Principle - Open for extension, closed for modification  
- **L**iskov Substitution Principle - Derived classes must be substitutable for their base classes
- **I**nterface Segregation Principle - Many specific interfaces are better than one general-purpose interface
- **D**ependency Inversion Principle - Depend on abstractions, not concretions

## 🛠️ Method & Function Design

### Method Length & Complexity

- **Break down long methods/functions** into smaller, focused units that each handle a specific responsibility
- **Avoid redundant wrapper methods** that only call one private method without additional logic
- **Single responsibility per method** - each method should do one thing well
- **Meaningful names** that clearly describe what the method does

### Parameters & Return Values

- **Limit parameters** - if you need more than 3-4 parameters, consider using a configuration object/struct
- **Consistent return types** - avoid functions that sometimes return different types
- **Fail fast** - validate inputs early and throw meaningful errors

## 🏗️ Architecture Principles

### Modularity & Separation of Concerns

- **Service-oriented design** with clear separation of responsibilities
- **Dependency injection** for testability and flexibility
- **Interface/contract-based programming** - depend on abstractions, not implementations
- **Avoid monolithic classes/modules** - break them into focused, cohesive units

### Error Handling

- **Throw errors, don't catch and ignore** - let errors bubble up unless they are expected and recoverable
- **Fail fast** - validate inputs early and throw meaningful errors immediately
- **Consistent error handling patterns** across the entire codebase
- **Meaningful error messages** that help developers understand what went wrong and how to fix it
- **Log at appropriate levels** with context and structured data
- **Only catch errors you can handle** - if you can't recover or provide meaningful handling, let it throw
- **Expected errors should be handled gracefully** - but unexpected errors should surface quickly

## 📝 Code Quality Standards

### Naming Conventions

- **Descriptive names** - code should be self-documenting
- **Consistent naming patterns** within each project/language
- **Avoid abbreviations** unless they're industry standard
- **Boolean variables/functions** should be clearly boolean (is/has/can/should prefixes)

### Comments & Documentation

- **Code should be self-documenting** - prefer clear code over comments
- **Document the "why", not the "what"** - explain business logic and decisions
- **Keep documentation up-to-date** with code changes
- **API documentation** for all public interfaces

### Testing Philosophy

- **Write testable code** - design with testing in mind
- **Unit tests for business logic** - test behavior, not implementation
- **Integration tests for workflows** - test how components work together
- **Test edge cases and error conditions**

## 🔄 Development Workflow

### Refactoring

- **Continuous refactoring** - improve code quality incrementally
- **Test before and after** refactoring to ensure behavior is preserved
- **Remove dead code** - don't leave commented-out code
- **DRY principle with wisdom** - Don't Repeat Yourself, but avoid premature abstraction and forced reuse
- **Prefer simple duplication over complex abstraction** - if reuse makes code complicated, duplicate and keep it simple
- **One thing well** - better to have multiple simple functions than one complex reusable one

## ⚡ Performance Considerations

### Optimization Philosophy

- **Measure before optimizing** - profile and identify actual bottlenecks
- **Readability first, optimize later** - don't sacrifice clarity for micro-optimizations
- **Cache appropriately** - but avoid premature caching
- **Consider scalability** from the design phase

### Resource Management

- **Clean up resources** - close files, connections, release memory appropriately
- **Efficient algorithms** - choose appropriate data structures and algorithms
- **Lazy loading** where appropriate to improve startup time

## 🔒 Security Best Practices

### Input Validation

- **Validate all inputs** at system boundaries
- **Sanitize data** before processing or storage
- **Use parameterized queries** to prevent injection attacks
- **Implement proper authentication and authorization**

### Data Protection

- **Never log sensitive data** (passwords, tokens, personal info)
- **Use environment variables** for configuration and secrets
- **Encrypt sensitive data** at rest and in transit
- **Follow principle of least privilege**

## ✅ Your Role as a Developer/AI Assistant

When working on any codebase, your job is to:

- **Follow these global standards** while adapting to language-specific conventions
- **Write clean, maintainable code** that other developers can easily understand and modify
- **Think about long-term maintainability** - code is read more often than it's written
- **Design for extensibility** - anticipate future changes and requirements
- **Prioritize code quality** over speed of delivery
- **Ask questions** when requirements are unclear rather than making assumptions
- **Implement exactly what is requested** - don't add features or functionality that wasn't asked for
- **Consider the bigger picture** - how does this code fit into the overall system?
- **Be consistent** with existing patterns and conventions in the codebase
- **Document decisions** that might not be obvious to future developers
- **Test your code** and consider edge cases

## ❌ DO NOT

- **Do not sacrifice code quality** for quick fixes or tight deadlines
- **Do not write monolithic functions/classes** - break them down into manageable pieces
- **Do not ignore error handling** - always consider what can go wrong and let errors surface
- **Do not catch and swallow exceptions** - only catch errors you can meaningfully handle or recover from
- **Do not hide failures** - if something fails, it should be visible and actionable
- **Do not hardcode values** - use configuration files or constants
- **Do not copy-paste code** without understanding what it does
- **Do not leave TODO comments** in production code without tracking them
- **Do not commit commented-out code** - use version control instead
- **Do not ignore linting/formatting tools** - consistency matters
- **Do not skip documentation** for public APIs and complex business logic
- **Do not make breaking changes** without proper versioning and migration paths
- **Do not optimize prematurely** - measure first, then optimize
- **Do not force code reuse** - avoid creating complicated abstractions just to eliminate duplication
- **Do not create "Swiss Army knife" functions** - functions that try to do everything for everyone
- **Do not sacrifice simplicity for reusability** - simple, testable code is better than complex reusable code
- **Do not reinvent the wheel** - use established libraries and patterns when appropriate, but don't force custom reuse
- **Do not ignore security considerations** - think about potential vulnerabilities
- **Do not add unrequested features** - implement exactly what is asked for, nothing more
- **Do not make assumptions** about data or user behavior - validate everything
- **Do not implement "nice to have" features** without explicit request - stick to requirements

## 🎯 Language-Specific Notes

While these principles apply universally, remember to:

- **Follow language idioms** and established conventions
- **Use language-specific tools** for testing, linting, and formatting
- **Leverage language strengths** - don't fight the language design
- **Stay updated** with language best practices and evolving standards
- **Use appropriate design patterns** for the specific language/framework

## 📋 Quick Checklist

Before considering any piece of code "done":

- [ ] Does it follow SOLID principles?
- [ ] Is each method/function focused on a single responsibility?
- [ ] Are names descriptive and consistent?
- [ ] Is error handling appropriate and consistent?
- [ ] Is it testable and tested?
- [ ] Is it documented where necessary?
- [ ] Does it follow project conventions?
- [ ] Is it secure and performant enough?
- [ ] Will it be maintainable in 6 months?

---

*These standards are living guidelines that should evolve with experience and changing best practices. The goal is to write code that is a joy to work with, both now and in the future.*

---

Key highlights for this project:
- Always follow **SOLID principles**
- Break down long methods into **focused smaller methods**
- **Throw errors, don't catch and ignore** - let errors bubble up unless expected
- **Prefer simple code over forced reuse** - avoid complex abstractions
- **Implement exactly what is requested** - no unrequested features

## 🏗️ Cubicler-Specific Terminology

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
- `cubicler_available_servers` - get information about available servers
- `cubicler_fetch_server_tools` - get tools from specific MCP server

## 🏗️ Core Architecture Principles

### Service-Oriented Design with Dependency Injection
Cubicler uses a clean service architecture with dependency injection. Each service implements specific interfaces:

- **`MCPCompatible`** - Services that can handle MCP protocol requests (`initialize`, `toolsList`, `toolsCall`, `canHandleRequest`)
- **`AgentsProviding`** - Services that manage AI agents and prompt composition  
- **`ServersProviding`** - Services that provide server listing and tools discovery
- **`ToolsListProviding`** - Services that can provide tool definitions

Key services are instantiated with dependencies injected:
```typescript
// Export class for DI and default instance for backward compatibility
export { ProviderService };
export default new ProviderService(configProvider, [providerMcpService, providerRestService]);
```

### Multi-Provider Tool Aggregation
The `MCPService` aggregates tools from multiple `MCPCompatible` providers:
- `InternalToolsService` - Provides `cubicler_*` internal functions
- `ProviderMCPService` - Handles MCP server communication
- `ProviderRESTService` - Handles REST API endpoints

Tool names follow the pattern: `{hash}_{snake_case_function}` where hash is a 6-character base36 hash derived from server identifier and URL

## � Configuration

Environment variables:

```env
# Required - Source of providers list (local file or remote URL) 
CUBICLER_PROVIDERS_LIST=https://your-cloud.com/providers.json

# Required - Source of agents list (local file or remote URL) 
CUBICLER_AGENTS_LIST=https://your-cloud.com/agents.json

# Optional - Server port (default: 1503)
CUBICLER_PORT=1503
```

### JSON Providers Configuration Format

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

### JSON Agents Configuration Format

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

## � Parameter Handling & Message Formats

### REST Server Parameter Processing
- **Path Variables**: Parameters matching `{variableName}` in the path are extracted and used for path replacement
- **Query Parameters**: Remaining parameters from the `parameters` schema become query parameters
- **Query Parameter Conversion**:
  - Objects: JSON stringified
  - Arrays of primitives (string, number, boolean): Comma-separated values
  - Arrays of objects: JSON stringified

### Function Naming Convention
- **MCP servers**: `{hash}_{snake_case_function}` (e.g., `1r2dj4_get_current_weather`)
- **REST servers**: `{hash}_{snake_case_endpoint}` (e.g., `sft7he_get_user_info`)
- **Internal tools**: `cubicler_available_servers`, `cubicler_fetch_server_tools`

The hash is a 6-character base36 encoding derived from SHA-256 hash of `{server_identifier}:{server_url}`, ensuring collision-resistant and config-order-independent function names.

### Transport Support
- **Current Phase**: HTTP transport only for both MCP servers and agents
- **Future Phases**: SSE, WebSocket, and stdio transports will be added later

### Dispatch Request Format (`POST /dispatch[/:agentId]`)

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

### Agent Request Payload (what agents receive)

```json
{ 
  "agent": { 
    "identifier": "gpt_4o",
    "name": "My GPT-4O Agent",
    "description": "Advanced GPT-4O agent for complex tasks",
    "prompt": "You specialize in complex reasoning and analysis."
  },
  "tools": [
    {
      "name": "cubicler_available_servers",
      "description": "Get information for available servers managed by Cubicler",
      "parameters": { "type": "object", "properties": {} }
    }
    // ... all available cubicler internal tools
  ],
  "servers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service", 
      "description": "Provides weather information via MCP"
    }
    // ... all available servers
  ],
  "messages": [/* original messages array */]
}
```

### Agent Response Format (what agents must return)

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

## � Cubicler Internal Functions

### `cubicler_available_servers`

Get information about available servers managed by Cubicler.

**Schema:**
```json
{ 
    "name": "cubicler_available_servers",
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

### `cubicler_fetch_server_tools`

Get tools from a specific MCP server managed by Cubicler.

**Schema:**
```json
{ 
    "name": "cubicler_fetch_server_tools",
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
        "name": "1r2dj4_get_current_weather",
        "description": "Get current weather for a location",
        "parameters": { 
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "country": {"type": "string"}
            }
        }
    }]
}
```

## 🔧 Development Workflows

### Running Tests
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI
```

### Development Server
```bash
npm run dev           # Start with ts-node
npm run dev:watch     # Start with watch mode
```

### Build Process
- **TypeScript**: Compiles to ES modules with strict settings (`target: ES2020`, `module: ESNext`)
- **Build tool**: Uses `tsup` for fast bundling
- **Type definitions**: Generates `.d.ts` files automatically

### Docker Development
```bash
npm run docker:dev    # Development with docker-compose
npm run docker:prod   # Production build
```

## 🔗 Architecture Flow & Service Separation

### High-Level Data Flow
1. **Agent Configuration**: Agents loaded from `agents.json` with prompt composition (basePrompt + defaultPrompt/agentPrompt)
2. **Provider Management**: Providers loaded from `providers.json` (MCP servers + REST endpoints)
3. **Message Dispatch**: Enhanced message format → agent selection → prompt composition → response
4. **MCP Communication**: Direct MCP protocol endpoint for tool discovery and execution
5. **Internal Functions**: Built-in `cubicler_*` functions for server discovery and tool introspection

### Service Architecture
The system maintains modular service separation:

- **Agent Service**: Handles agent configuration, selection, and communication
- **Provider Service**: Manages MCP servers and REST endpoints  
- **MCP Service**: Handles MCP protocol communication
- **Dispatch Service**: Orchestrates message routing and response handling
- **Internal Tools Service**: Provides Cubicler-specific tools

Each service is transport-agnostic and reusable across different communication methods.

## � Code Conventions

### Error Handling Pattern
Services use consistent error logging with emojis:
```typescript
console.log(`✅ [ServiceName] Success message`);
console.warn(`⚠️ [ServiceName] Warning message`);
console.error(`❌ [ServiceName] Error message`); 
```

### Function Naming & Tool Resolution
- **Internal tools**: `cubicler_available_servers`, `cubicler_fetch_server_tools`
- **MCP tools**: `{hash}_{snake_case_function}`
- **REST tools**: `{hash}_{snake_case_endpoint}`

The system routes tool calls by parsing the prefix and delegating to the appropriate service.

### TypeScript Patterns
- **Strict null checks** enabled - always handle undefined/null cases
- **ES modules** with `.js` extensions in imports (required for Node.js ES modules)
- **Interface segregation** - small, focused interfaces over large ones
- **Dependency injection** pattern for testability and modularity
- **Documentation** - All public methods must have JSDoc documentation explaining purpose, parameters, return values, and usage examples where helpful

### Testing Approach
- **Vitest** for testing framework with Node.js environment
- **Mock dependencies** using `vi.fn()` and interface implementations
- **Integration tests** in `tests/integration/` for API endpoints  
- **Unit tests** mirror the `src/` structure

## �🚀 Adding New Features

### Adding a New Provider Type
1. Create service implementing `MCPCompatible` interface
2. Add to `MCPService` providers array in dependency injection
3. Implement tool name parsing logic in `canHandleRequest`
4. Add configuration schema to `model/providers.ts`

### Adding Internal Functions
1. Add tool definition to `InternalToolsService.getToolsDefinitions()`
2. Implement handler in `toolsCall` method
3. Use `cubicler_*` namespace for consistency

### Extending Agent Communication
- Agent requests follow strict schema in `model/dispatch.ts`
- Always include technical section about available servers in prompts
- Maintain backward compatibility in API responses

## ✅ Your Role

When I ask you for code, your job is to:
 - Help refine and optimize the TypeScript system modularly following the 2.0 architecture
 - Implement MCP server support and enhanced REST server handling
 - Ensure the system remains clean, hot-swappable, and modular with separate service layers
 - Maintain TypeScript type safety and best practices
 - Build transport-agnostic services that can be reused across different communication methods
 - Avoid overengineering (no LangChain, etc.)
 - Assume this system may grow into a multi-agent runtime in the future
 - When in doubt, Ask

## ✅ DO NOT

 - Do not suggest centralized monolith logic
 - Do not embed prompt logic directly into routing - keep services separate
 - Do not use frameworks that tie code to specific transport behavior
 - Do not sacrifice type safety for convenience
 - Do not make the system too rigid - ensure extensibility for future features

When working on Cubicler, focus on maintaining the modular architecture, consistent error handling, and type safety throughout the system.
