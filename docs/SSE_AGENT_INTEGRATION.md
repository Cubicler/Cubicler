# SSE Agent Integration Guide

This guide explains how to integrate agents with Cubicler using Server-Sent Events (SSE), where **Cubicler acts as the SSE server** and **agents act as SSE clients**.

## Overview

With SSE transport:

- **Cubicler acts as SSE server** providing endpoints for agent connections
- **Agents connect to Cubicler** via SSE to receive requests  
- **Agents send responses** back via HTTP POST

## Configuration

### agents.json

```json
{
  "basePrompt": "You are a helpful AI assistant powered by Cubicler.",
  "defaultPrompt": "You have access to various tools and services.",
  "agents": [{
    "identifier": "my_sse_agent",
    "name": "My SSE Agent",
    "transport": "sse",
    "description": "An agent that connects via SSE"
  }]
}
```

**Note**: SSE agents don't need a `url` field since they connect TO Cubicler's endpoints.

## Agent Implementation

### 1. Connect to Cubicler via SSE

```javascript
// Agent connects to Cubicler's SSE endpoint
const agentId = 'my_sse_agent';
const eventSource = new EventSource(`http://localhost:1503/sse/${agentId}`);

eventSource.onopen = () => {
  console.log('✅ Connected to Cubicler');
};

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'agent_request') {
    handleAgentRequest(data.id, data.data);
  }
};

eventSource.onerror = (error) => {
  console.error('❌ SSE connection error:', error);
};
```

### 2. Handle Agent Requests

```javascript
async function handleAgentRequest(requestId, agentRequest) {
  console.log(`📨 Received request ${requestId}`);
  
  try {
    // Process the agent request
    const response = await processRequest(agentRequest);
    
    // Send response back to Cubicler
    await sendResponse(requestId, response);
  } catch (error) {
    console.error('❌ Error processing request:', error);
    
    // Send error response
    await sendResponse(requestId, {
      timestamp: new Date().toISOString(),
      type: 'text',
      content: `Error: ${error.message}`,
      metadata: { usedToken: 0, usedTools: 0 }
    });
  }
}

async function processRequest(agentRequest) {
  // Your agent logic here
  // agentRequest contains:
  // - agent: agent configuration
  // - tools: available tools
  // - servers: available servers  
  // - messages: conversation messages
  
  return {
    timestamp: new Date().toISOString(),
    type: 'text',
    content: 'Hello from SSE agent!',
    metadata: { usedToken: 150, usedTools: 0 }
  };
}
```

### 3. Send Responses to Cubicler

```javascript
async function sendResponse(requestId, response) {
  const agentId = 'my_sse_agent';
  
  try {
    const result = await fetch(`http://localhost:1503/sse/${agentId}/response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if required
      },
      body: JSON.stringify({
        requestId,
        response
      })
    });
    
    if (!result.ok) {
      throw new Error(`HTTP ${result.status}: ${result.statusText}`);
    }
    
    console.log(`✅ Response sent for request ${requestId}`);
  } catch (error) {
    console.error(`❌ Failed to send response: ${error.message}`);
  }
}
```

## Message Formats

### Agent Request (received via SSE)

```json
{
  "id": "my_sse_agent_1641234567890_abc123",
  "type": "agent_request", 
  "data": {
    "agent": {
      "identifier": "my_sse_agent",
      "name": "My SSE Agent",
      "description": "An agent that connects via SSE",
      "prompt": "You specialize in SSE communication."
    },
    "tools": [/* available tools */],
    "servers": [/* available servers */],
    "messages": [{
      "sender": { "id": "user_123", "name": "John Doe" },
      "timestamp": "2025-01-01T12:00:00Z",
      "type": "text",
      "content": "Hello, agent!"
    }]
  }
}
```

### Agent Response (sent via HTTP POST)

```json
{
  "requestId": "my_sse_agent_1641234567890_abc123",
  "response": {
    "timestamp": "2025-01-01T12:00:01Z", 
    "type": "text",
    "content": "Hello! I received your message via SSE.",
    "metadata": { "usedToken": 150, "usedTools": 0 }
  }
}
```

## SSE Events

### Connection Events

- `connected` - Sent when agent successfully connects
- `agent_request` - Contains agent request data

### Connection Management

- Connection automatically closes if agent disconnects
- Pending requests are rejected if connection drops
- Agents should implement reconnection logic

## Testing SSE Connection

You can test the SSE connection using curl:

```bash
# Connect to SSE endpoint
curl -N -H "Accept: text/event-stream" http://localhost:1503/sse/my_sse_agent

# Check SSE status
curl http://localhost:1503/sse/status

# Send test response
curl -X POST http://localhost:1503/sse/my_sse_agent/response \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_123",
    "response": {
      "timestamp": "2025-01-01T12:00:00Z",
      "type": "text", 
      "content": "Test response",
      "metadata": {"usedToken": 0, "usedTools": 0}
    }
  }'
```

## Error Handling

### Common Issues

1. **Agent not found** - Ensure agent exists in agents.json
2. **Connection failed** - Check network connectivity and auth
3. **Request timeout** - Agents have 5 minutes to respond
4. **Invalid response format** - Ensure response matches expected schema

### Best Practices

1. Implement connection retry logic
2. Handle network disconnections gracefully  
3. Log request/response for debugging
4. Validate response format before sending
5. Use heartbeat/keepalive if needed
