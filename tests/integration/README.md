# Integration Tests

This directory contains end-to-end integration tests for Cubicler that test the complete flow from HTTP endpoints to MCP servers.

## Structure

```
tests/integration/
├── .env                          # Environment variables (API keys)
├── integration-agents.json       # Test agent configurations
├── integration-providers.json    # Test MCP server configurations  
├── integration-webhooks.json     # Test webhook configurations
├── run-integration-tests.sh      # Test runner script
├── dispatch-integration.test.ts  # /dispatch endpoint tests
├── sse-integration.test.ts       # Server-Sent Events tests
├── mcp-sse-integration.test.ts   # MCP over SSE streaming tests
├── mcp-http-integration.test.ts  # MCP over HTTP API tests
├── webhook-integration.test.ts   # Webhook endpoint tests
├── stdio-integration.test.ts     # Stdio agent integration tests
└── README.md                     # This file
```

## Test Coverage

### Dispatch Integration Tests (`dispatch-integration.test.ts`)

- ✅ Health check endpoint
- ✅ Agent listing endpoint
- ✅ Basic agent conversation via `/dispatch`
- ✅ Tool discovery using `cubicler_available_servers`
- ✅ Weather requests using proper MCP flow

### SSE Integration Tests (`sse-integration.test.ts`)

- ✅ SSE endpoint availability check
- ✅ Streaming responses from `/dispatch-stream`
- ✅ Error handling in streaming mode
- ℹ️  Tests are designed to pass even if SSE is not yet implemented

### MCP SSE Integration Tests (`mcp-sse-integration.test.ts`)

- ✅ MCP `tools/list` request streaming via SSE
- ✅ MCP `tools/call` request for internal Cubicler tools via SSE
- ✅ MCP `tools/call` request for external MCP server tools via SSE
- ✅ JSON-RPC error handling via SSE (invalid requests, unknown methods)
- ✅ Multiple concurrent SSE clients support
- ✅ HTTP fallback when SSE client not registered
- ✅ Real MCP server integration with SSE streaming
- ✅ Full MCP protocol compliance over SSE

### MCP HTTP Integration Tests (`mcp-http-integration.test.ts`)

- ✅ MCP `tools/list` request via HTTP POST `/mcp`
- ✅ MCP `tools/call` request for internal Cubicler tools
- ✅ MCP `tools/call` request for external MCP server tools
- ✅ JSON-RPC error handling (invalid requests, unknown methods)
- ✅ Malformed JSON request handling
- ✅ Authentication support validation
- ✅ Full MCP protocol compliance over HTTP

### Webhook Integration Tests (`webhook-integration.test.ts`)

- ✅ Webhook endpoint listing
- ✅ Webhook POST request handling
- ✅ Agent processing triggered by webhooks
- ✅ Error handling for invalid webhook data
- ✅ Authentication handling (if configured)

### Stdio Agent Integration Tests (`stdio-integration.test.ts`)

- ✅ Stdio agent listing and discovery
- ✅ Basic request/response with CubicAgent-OpenAI v2.6.0
- ✅ Weather API integration through stdio transport
- ✅ MCP tool discovery through stdio agents
- ✅ Error handling for nonexistent stdio agents
- ✅ Malformed request handling
- ✅ Performance comparison between stdio and direct agents

## Setup

1. **Create environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`:**

   ```bash
   # Required for OpenAI agent integration
   OPENAI_API_KEY=your_openai_key_here
   
   # Required for OpenWeather MCP server
   OPENWEATHER_API_KEY=your_openweather_key_here
   ```

## Running Tests

### Quick Start

```bash
./run-integration-tests.sh
```

### Individual Test Suites

```bash
# Run dispatch tests only
npm test -- tests/integration/dispatch-integration.test.ts --run

# Run SSE tests only  
npm test -- tests/integration/sse-integration.test.ts --run

# Run MCP SSE tests only
npm test -- tests/integration/mcp-sse-integration.test.ts --run

# Run MCP HTTP tests only
npm test -- tests/integration/mcp-http-integration.test.ts --run

# Run webhook tests only
npm test -- tests/integration/webhook-integration.test.ts --run

# Run stdio agent tests only
npm test -- tests/integration/stdio-integration.test.ts --run
```

### Watch Mode (Development)

```bash
npm test -- tests/integration/dispatch-integration.test.ts
```

## Test Architecture

These integration tests follow the proper Cubicler architecture:

1. **Start Cubicler server** with test configurations
2. **Make HTTP requests** to actual endpoints (`/dispatch`, `/webhook/*`, etc.)
3. **Use internal OpenAI agents** configured with real API keys
4. **Test complete flow**: HTTP → Agent → MCP Server → External APIs
5. **Validate responses** and error handling

### Key Differences from Unit Tests

- ❌ **No mocking** - Uses real OpenAI API and OpenWeather API
- ✅ **Full server startup** - Tests actual HTTP endpoints
- ✅ **Real MCP servers** - Spawns actual `mcp-weather-demo` processes
- ✅ **End-to-end validation** - Tests complete request/response flow

## Test Configuration

### Agents (`integration-agents.json`)

- `test-openai-weather`: OpenAI agent configured for weather queries (direct transport)
- `test-webhook-agent`: OpenAI agent for webhook processing (direct transport)
- `test-stdio-openai-weather`: CubicAgent-OpenAI v2.6.0 stdio agent for weather queries
- `test-stdio-openai-basic`: CubicAgent-OpenAI v2.6.0 stdio agent for basic functionality

### Providers (`integration-providers.json`)  

- `openweather-integration`: OpenWeather MCP server with API key

### Webhooks (`integration-webhooks.json`)

- `test-webhook`: Test webhook endpoint at `/webhook/test`

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure `.env` file exists with valid keys
   - Check that keys are not expired or rate-limited

2. **Server Startup Timeouts**
   - Increase timeout values in test files
   - Check that ports (3000, 3001, 3002) are not in use

3. **MCP Server Issues**
   - Ensure `npx` can install `mcp-weather-demo`
   - Check internet connection for package downloads

4. **Test Flakiness**
   - Integration tests depend on external APIs
   - Some tests may be slower due to AI processing time
   - Network issues can cause intermittent failures

### Debug Logs

The tests include detailed console logging:

- Server startup/shutdown events
- HTTP request/response details  
- Agent responses and tool usage
- MCP server communication

### Test Isolation

Each test suite uses different ports:

- Dispatch tests: Port 3000
- SSE tests: Port 3001  
- Webhook tests: Port 3002

This prevents conflicts when running tests in parallel.
