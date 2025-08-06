# HTTP Agent Integration Guide

This guide explains how to integrate agents with Cubicler using HTTP transport, where **agents run as web servers** and **Cubicler sends HTTP requests** to agent endpoints.

## Overview

With HTTP transport:

- **Agents run as web servers** listening on HTTP endpoints
- **Cubicler makes HTTP requests** to agent endpoints when dispatching messages
- **Most common transport type** for cloud-based or containerized agents
- **Simple request/response pattern** using standard HTTP

## Configuration

### agents.json

```json
{
  "agents": [{
    "identifier": "my_http_agent",
    "name": "My HTTP Agent",
    "transport": "http",
    "url": "http://localhost:3000/agent",
    "description": "An HTTP-based AI agent",
    "prompt": "You specialize in complex problem solving.",
    "config": {
      "timeout": 90000,
      "headers": {
        "Authorization": "Bearer your-api-key",
        "X-Agent-Version": "1.0"
      }
    }
  }]
}
```

## Agent Implementation

### 1. Required Endpoint: `POST /agent`

Your agent **MUST** implement an HTTP endpoint that accepts POST requests from Cubicler:

**Node.js/Express Example:**

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/agent', async (req, res) => {
  try {
    const { agent, tools, servers, messages } = req.body;
    
    // Process with your AI model
    const response = await processAgentRequest(req.body);
    
    // Return AgentResponse format
    res.json({
      timestamp: new Date().toISOString(),
      type: 'text',
      content: response.content,
      metadata: {
        usedToken: response.tokens || 0,
        usedTools: response.toolsUsed || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      type: 'text',
      content: 'Sorry, I encountered an error processing your request.',
      metadata: { usedToken: 0, usedTools: 0 }
    });
  }
});

app.listen(3000, () => {
  console.log('HTTP Agent running on port 3000');
});
```

**Python/Flask Example:**

```python
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

@app.route('/agent', methods=['POST'])
def agent_endpoint():
    try:
        data = request.json
        agent = data['agent']
        messages = data['messages']
        
        # Process with your AI model
        response = process_agent_request(data)
        
        return jsonify({
            'timestamp': datetime.now().isoformat(),
            'type': 'text',
            'content': response['content'],
            'metadata': {
                'usedToken': response.get('tokens', 0),
                'usedTools': response.get('toolsUsed', 0)
            }
        })
    except Exception as e:
        return jsonify({
            'timestamp': datetime.now().isoformat(),
            'type': 'text',
            'content': 'Sorry, I encountered an error processing your request.',
            'metadata': {'usedToken': 0, 'usedTools': 0}
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
```

### 2. Using Cubicler Tools

Your agent can call back to Cubicler to use available tools and services:

```javascript
// Helper function to call Cubicler internal tools
async function callCubiclerTool(toolName, arguments) {
  const response = await fetch('http://localhost:1503/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random(),
      method: 'tools/call',
      params: { name: toolName, arguments: arguments }
    })
  });
  
  const result = await response.json();
  return JSON.parse(result.result.content[0].text);
}

// Example usage
const servers = await callCubiclerTool('cubicler_available_servers', {});
const weatherData = await callExternalFunction('1r2dj4_get_current_weather', {
  city: 'Jakarta', country: 'Indonesia'
});
```

### 3. JWT Authentication Support

If your Cubicler instance uses JWT authentication:

```javascript
const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.cubiclerAuth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid JWT token' });
  }
}

// Protected agent endpoint
app.post('/agent', verifyJWT, async (req, res) => {
  // Your agent logic here
});
```

## Message Formats

### Request Format (AgentRequest)

```json
{
  "agent": {
    "identifier": "my_http_agent",
    "name": "My HTTP Agent",
    "description": "An HTTP-based AI agent",
    "prompt": "You are a helpful AI assistant powered by Cubicler."
  },
  "tools": [
    {
      "name": "cubicler_available_servers",
      "description": "Get information for available servers managed by Cubicler"
    }
  ],
  "servers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service",
      "description": "Provides weather information via MCP"
    }
  ],
  "messages": [
    {
      "sender": {"id": "user_123", "name": "John Doe"},
      "timestamp": "2025-08-06T10:30:00Z",
      "type": "text",
      "content": "What's the weather like in Jakarta?"
    }
  ]
}
```

### Response Format (AgentResponse)

```json
{
  "timestamp": "2025-08-06T10:30:15Z",
  "type": "text",
  "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
  "metadata": {
    "usedToken": 150,
    "usedTools": 2
  }
}
```

## Configuration Options

### Agent Configuration

```json
{
  "identifier": "my_http_agent",
  "name": "My HTTP Agent",
  "transport": "http",
  "url": "http://localhost:3000/agent",
  "description": "An HTTP-based AI agent",
  "prompt": "You are a helpful assistant.",
  "config": {
    "timeout": 90000,
    "retries": 3,
    "headers": {
      "Authorization": "Bearer api-key",
      "X-Agent-Version": "1.0",
      "User-Agent": "Cubicler/2.3.0"
    }
  }
}
```

### Configuration Properties

- **`url`** (required): The HTTP endpoint where your agent listens
- **`timeout`** (optional): Request timeout in milliseconds (default: 90000)
- **`retries`** (optional): Number of retry attempts on failure (default: 0)
- **`headers`** (optional): Custom headers to send with requests

## Testing Your HTTP Agent

### 1. Start Your Agent

```bash
# Node.js
node agent.js

# Python
python agent.py
```

### 2. Test Agent Endpoint Directly

```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {"identifier": "test", "name": "Test", "description": "Test", "prompt": "You are helpful."},
    "tools": [],
    "servers": [],
    "messages": [{"sender": {"id": "test", "name": "Test"}, "type": "text", "content": "Hello"}]
  }'
```

### 3. Test via Cubicler

```bash
curl -X POST http://localhost:1503/dispatch/my_http_agent \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "sender": {"id": "test_user", "name": "Test User"},
      "type": "text",
      "content": "Hello, can you help me?"
    }]
  }'
```

## Best Practices

### 1. Error Handling

Always return a valid `AgentResponse` even on errors:

```javascript
try {
  // Your processing logic
} catch (error) {
  return res.json({
    timestamp: new Date().toISOString(),
    type: 'text',
    content: `I encountered an error: ${error.message}`,
    metadata: { usedToken: 0, usedTools: 0 }
  });
}
```

### 2. Health Checks

Implement a health check endpoint:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
```

## Common Issues

### 1. **Connection Refused**

- Ensure your agent is running and listening on the correct port
- Check firewall settings and network connectivity
- Verify the URL in agent configuration matches your agent's endpoint

### 2. **Timeout Errors**

- Reduce processing time in your agent
- Increase timeout in agent configuration
- Implement proper timeout handling in your agent code

### 3. **Invalid Response Format**

- Ensure response follows exact `AgentResponse` schema
- Include all required fields: `timestamp`, `type`, `content`, `metadata`
- Use proper JSON serialization

### 4. **JWT Authentication Issues**

- Verify JWT secret matches between Cubicler and agent
- Check token expiration and claims
- Implement proper error handling for authentication failures

---

**Next Steps:**

- Check out [Agent Integration Overview](AGENT_INTEGRATION.md) for the complete agent integration overview
- See [Stdio Agent Integration](STDIO_AGENT_INTEGRATION.md) for command-line agent integration
- See [SSE Agent Integration](SSE_AGENT_INTEGRATION.md) for real-time streaming integration
