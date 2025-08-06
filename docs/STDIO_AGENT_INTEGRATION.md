# Stdio Agent Integration Guide

This guide explains how to integrate agents with Cubicler using stdio transport, where **agents run as command-line processes** and **communicate via stdin/stdout**.

## Overview

With stdio transport:

- **Agents run as command-line processes** (executables, scripts, etc.)
- **Cubicler spawns the agent process** when needed
- **Communication via stdin/stdout** using JSON messages
- **Perfect for local models**, command-line tools, or lightweight agents

## Configuration

### agents.json

```json
{
  "agents": [{
    "identifier": "my_stdio_agent",
    "name": "My Stdio Agent",
    "transport": "stdio",
    "url": "/usr/bin/python3 /path/to/agent.py",
    "description": "A command-line AI agent that uses stdio",
    "prompt": "You are a command-line assistant.",
    "config": {
      "timeout": 90000,
      "workingDirectory": "/path/to/agent",
      "environment": {
        "MODEL_PATH": "/models/my-model",
        "API_KEY": "your-api-key"
      }
    }
  }]
}
```

## Agent Implementation

### Communication Pattern

Your agent must follow this simple pattern:

1. **Read `AgentRequest` from stdin** as JSON
2. **Process the request** with your AI model
3. **Write `AgentResponse` to stdout** as JSON
4. **Exit or continue** (agent can be persistent or single-use)

### Basic Implementation

**Python Example:**

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def main():
    # Read request from stdin
    request = json.loads(sys.stdin.read())
    
    # Process with your AI model
    agent = request['agent']
    messages = request['messages']
    last_message = messages[-1]['content']
    
    # Simple response (replace with your AI logic)
    response = {
        "timestamp": datetime.now().isoformat(),
        "type": "text",
        "content": f"Hello! I'm {agent['name']}. You said: {last_message}",
        "metadata": {"usedToken": 50, "usedTools": 0}
    }
    
    # Write response to stdout
    json.dump(response, sys.stdout)

if __name__ == "__main__":
    main()
```

**Node.js Example:**

```javascript
#!/usr/bin/env node
const fs = require('fs');

// Read from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const request = JSON.parse(input);
    
    // Process with your AI model
    const agent = request.agent;
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1].content;
    
    // Simple response (replace with your AI logic)
    const response = {
        timestamp: new Date().toISOString(),
        type: 'text',
        content: `Hello! I'm ${agent.name}. You said: ${lastMessage}`,
        metadata: { usedToken: 50, usedTools: 0 }
    };
    
    // Write response to stdout
    process.stdout.write(JSON.stringify(response));
});
```

### Using Cubicler Tools

To call external services, make HTTP requests to Cubicler's `/mcp` endpoint:

```python
import requests

def call_cubicler_tool(tool_name, arguments):
    response = requests.post('http://localhost:1503/mcp', json={
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    })
    return response.json()

# Example: Get weather
weather = call_cubicler_tool('1r2dj4_get_current_weather', {'city': 'Paris'})
```

## Message Formats

### Input (AgentRequest from stdin)

```json
{
  "agent": {"identifier": "my_stdio_agent", "name": "My Stdio Agent"},
  "tools": [{"name": "cubicler_available_servers", "description": "..."}],
  "servers": [{"identifier": "weather_service", "name": "Weather Service"}],
  "messages": [{"sender": {"id": "user_123"}, "type": "text", "content": "Hello"}]
}
```

### Output (AgentResponse to stdout)

```json
{
  "timestamp": "2025-08-06T10:30:15Z",
  "type": "text",
  "content": "Hello! How can I help you?",
  "metadata": {"usedToken": 50, "usedTools": 0}
}
```

## Testing Your Agent

### 1. Test Directly

```bash
echo '{"agent":{"name":"Test"},"tools":[],"servers":[],"messages":[{"sender":{"id":"test"},"type":"text","content":"Hello"}]}' | python3 agent.py
```

### 2. Test via Cubicler

```bash
curl -X POST http://localhost:1503/dispatch/my_stdio_agent \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"sender": {"id": "test"}, "type": "text", "content": "Hello"}]}'
```

## Best Practices

- **Use stderr for logging** - stdout is reserved for JSON responses
- **Validate input JSON** - handle malformed requests gracefully
- **Handle timeouts** - Cubicler has a 90-second default timeout
- **Exit cleanly** - return proper exit codes (0 for success)
- **Environment variables** - access config via `os.getenv()` in Python

## Configuration Options

- **`url`**: Command to execute (including arguments)
- **`timeout`**: Process timeout in milliseconds (default: 90000)
- **`workingDirectory`**: Working directory for the process  
- **`environment`**: Environment variables for the process

---

**Next Steps:**

- See [Agent Integration Overview](AGENT_INTEGRATION.md) for concepts and other transport types
- Check [HTTP Agent Integration](HTTP_AGENT_INTEGRATION.md) for web-based agents
- See [SSE Agent Integration](SSE_AGENT_INTEGRATION.md) for streaming agents
