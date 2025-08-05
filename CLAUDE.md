# Cubicler AI Orchestration Framework

Cubicler is a **modular AI orchestration framework** that connects applications to AI agents and external services through MCP and REST APIs.

## Core Concepts

**Architecture**: Service-oriented with dependency injection using interfaces:

- `MCPCompatible` - Handle MCP protocol requests
- `AgentsProviding` - Manage AI agents and prompt composition  
- `ServersProviding` - Provide server listing and tools discovery
- `ToolsListProviding` - Provide tool definitions

**Configuration**:

- `providers.json` - MCP servers and REST endpoints
- `agents.json` - AI agents with prompt composition (basePrompt + defaultPrompt/agentPrompt)

**API Endpoints**:

- `POST /mcp` - MCP protocol endpoint
- `POST /dispatch[/:agentId]` - dispatch messages to agents
- `GET /agents` - lists available agents
- `GET /health` - health check

**Internal Functions** (available as tools to agents):

- `cubicler_available_servers` - get server information
- `cubicler_fetch_server_tools` - get tools from specific server

## Development Standards

**Core Principles**:

- Follow SOLID principles
- Break long methods into focused smaller methods
- Throw errors, don't catch and ignore - let them bubble up unless expected
- Prefer simple code over forced reuse - avoid complex abstractions
- Implement exactly what is requested - no unrequested features

**Error Handling**:

- Use emoji prefixes: `✅` success, `⚠️` warning, `❌` error
- Validate inputs early and throw meaningful errors
- Only catch errors you can handle or recover from

**Function Naming**:

- Internal tools: `cubicler_*`
- MCP tools: `{hash}_{snake_case_function}`
- REST tools: `{hash}_{snake_case_endpoint}`

**TypeScript**:

- Strict null checks enabled
- ES modules with `.js` extensions in imports
- Interface segregation over large interfaces
- JSDoc for public methods

**Testing**: Vitest framework, mock dependencies with `vi.fn()`, integration tests in `tests/integration/`

**Environment**:

- `CUBICLER_PROVIDERS_LIST` - Source of providers (file/URL)
- `CUBICLER_AGENTS_LIST` - Source of agents (file/URL)  
- `CUBICLER_PORT` - Server port (default: 1503)

## Key Services

- **AgentService** - Agent configuration and prompt composition
- **ProviderService** - MCP servers and REST endpoints management
- **DispatchService** - Message routing and response handling
- **MCPService** - MCP protocol communication
- **InternalToolsService** - Cubicler-specific tools

Services use singleton pattern with DI: `export { Class }; export default new Class(deps);`
