# Stdio Agent Integration Guide

This guide explains how to integrate agents with Cubicler using stdio transport, where **agents run as command-line processes** and **communicate bidirectionally via stdin/stdout**.

## Overview

With stdio transport:

- **Agents run as command-line processes** (executables, scripts, etc.)
- **Cubicler spawns the agent process** when needed
- **Bidirectional communication via stdin/stdout** using JSON messages
- **Agents can call MCP tools** directly through the stdio connection
- **Perfect for local models**, command-line tools, or lightweight agents

## Configuration

### agents.json Structure

The agents configuration uses a named object structure (not an array):

```json
{
  "agents": {
    "my_stdio_agent": {
      "name": "My Stdio Agent",
      "transport": "stdio",
      "command": "/usr/bin/python3",
      "args": ["/path/to/agent.py"],
      "description": "A command-line AI agent that uses stdio",
      "prompt": "You are a command-line assistant.",
      "env": {
        "MODEL_PATH": "/models/my-model",
        "API_KEY": "your-api-key"
      },
      "cwd": "/path/to/agent"
    }
  }
}
```

### Configuration Fields

- **`name`**: Display name for the agent (required)
- **`transport`**: Must be `"stdio"` (required)
- **`command`**: Executable command path (required)
- **`args`**: Array of command-line arguments (optional)
- **`description`**: Agent description (required)
- **`prompt`**: Agent-specific prompt (optional)
- **`env`**: Environment variables (optional)
- **`cwd`**: Working directory (optional)
- **`allowedServers`**: Restrict access to specific MCP servers (optional)
- **`allowedTools`**: Allow specific tools only (optional)
- **`restrictedServers`**: Block specific MCP servers (optional)
- **`restrictedTools`**: Block specific tools (optional)

## Agent Implementation

### Communication Pattern

Your agent must follow this **bidirectional messaging pattern**:

1. **Read `agent_request` from stdin** - Initial request with agent data, tools, and messages
2. **Process the request** with your AI model
3. **Optionally make MCP calls** back to Cubicler via `mcp_request` messages
4. **Send `agent_response` to stdout** - Final response when done
5. **Process runs persistently** until the conversation is complete

### Message Types

The stdio transport uses **line-delimited JSON messages** with these types:

```typescript
type StdioMessage =
  | { type: 'agent_request'; data: AgentRequest }    // From Cubicler to Agent
  | { type: 'agent_response'; data: AgentResponse }  // From Agent to Cubicler (final)
  | { type: 'mcp_request'; id: string; data: MCPRequest }      // From Agent to Cubicler
  | { type: 'mcp_response'; id: string; data: MCPResponse }    // From Cubicler to Agent
```

### Basic Implementation

**Python Example (Bidirectional):**

```python
#!/usr/bin/env python3
import json
import sys
import uuid
from datetime import datetime

class StdioBidirectionalAgent:
    def __init__(self):
        # Buffer for reading line-delimited JSON
        self.buffer = ""
    
    def send_message(self, message):
        """Send a message to Cubicler via stdout"""
        json.dump(message, sys.stdout)
        sys.stdout.write('\n')
        sys.stdout.flush()
    
    def read_message(self):
        """Read a message from Cubicler via stdin"""
        line = sys.stdin.readline()
        return json.loads(line.strip())
    
    def call_mcp_tool(self, tool_name, arguments):
        """Call an MCP tool via bidirectional stdio"""
        request_id = str(uuid.uuid4())
        
        # Send MCP request to Cubicler
        self.send_message({
            "type": "mcp_request",
            "id": request_id,
            "data": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments}
            }
        })
        
        # Wait for MCP response
        while True:
            message = self.read_message()
            if message["type"] == "mcp_response" and message["id"] == request_id:
                return message["data"]
    
    def run(self):
        # Read initial agent request
        initial_message = self.read_message()
        if initial_message["type"] != "agent_request":
            raise ValueError(f"Expected agent_request, got {initial_message['type']}")
        
        agent_data = initial_message["data"]
        agent = agent_data['agent']
        messages = agent_data['messages']
        last_message = messages[-1]['content']
        
        # Example: Call weather tool
        try:
            weather = self.call_mcp_tool('weather_get_current', {'city': 'Paris'})
            content = f"Hello! I'm {agent['name']}. Weather in Paris: {weather}"
        except Exception as e:
            content = f"Hello! I'm {agent['name']}. You said: {last_message} (MCP error: {e})"
        
        # Send final response
        self.send_message({
            "type": "agent_response", 
            "data": {
                "timestamp": datetime.now().isoformat(),
                "type": "text",
                "content": content,
                "metadata": {"usedToken": 50, "usedTools": 1}
            }
        })

if __name__ == "__main__":
    agent = StdioBidirectionalAgent()
    agent.run()
```

**Node.js Example (Bidirectional):**

```javascript
#!/usr/bin/env node
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

class StdioBidirectionalAgent {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.pendingMcpRequests = new Map();
    }

    sendMessage(message) {
        process.stdout.write(JSON.stringify(message) + '\n');
    }

    async callMcpTool(toolName, arguments) {
        const requestId = uuidv4();
        
        // Send MCP request
        this.sendMessage({
            type: 'mcp_request',
            id: requestId,
            data: {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: { name: toolName, arguments }
            }
        });

        // Wait for response
        return new Promise((resolve, reject) => {
            this.pendingMcpRequests.set(requestId, { resolve, reject });
        });
    }

    async run() {
        // Read initial agent request
        const initialLine = await new Promise(resolve => this.rl.once('line', resolve));
        const initialMessage = JSON.parse(initialLine);
        
        if (initialMessage.type !== 'agent_request') {
            throw new Error(`Expected agent_request, got ${initialMessage.type}`);
        }

        const agentData = initialMessage.data;
        const agent = agentData.agent;
        const messages = agentData.messages;
        const lastMessage = messages[messages.length - 1].content;

        // Set up message handler for MCP responses
        this.rl.on('line', (line) => {
            const message = JSON.parse(line);
            if (message.type === 'mcp_response') {
                const pending = this.pendingMcpRequests.get(message.id);
                if (pending) {
                    this.pendingMcpRequests.delete(message.id);
                    pending.resolve(message.data);
                }
            }
        });

        try {
            // Example: Call weather tool
            const weather = await this.callMcpTool('weather_get_current', { city: 'Paris' });
            const content = `Hello! I'm ${agent.name}. Weather in Paris: ${weather}`;
            
            // Send final response
            this.sendMessage({
                type: 'agent_response',
                data: {
                    timestamp: new Date().toISOString(),
                    type: 'text',
                    content,
                    metadata: { usedToken: 50, usedTools: 1 }
                }
            });
        } catch (error) {
            // Send error response
            this.sendMessage({
                type: 'agent_response',
                data: {
                    timestamp: new Date().toISOString(),
                    type: 'text',
                    content: `Hello! I'm ${agent.name}. You said: ${lastMessage} (Error: ${error.message})`,
                    metadata: { usedToken: 50, usedTools: 0 }
                }
            });
        }

        process.exit(0);
    }
}

const agent = new StdioBidirectionalAgent();
agent.run().catch(console.error);
```

### Using MCP Tools (Bidirectional)

With the new bidirectional stdio transport, agents can call MCP tools **directly through the stdio connection** instead of making HTTP requests:

```python
def call_mcp_tool(self, tool_name, arguments):
    """Call MCP tool via bidirectional stdio (recommended)"""
    request_id = str(uuid.uuid4())
    
    # Send MCP request to Cubicler
    self.send_message({
        "type": "mcp_request",
        "id": request_id,
        "data": {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments}
        }
    })
    
    # Wait for MCP response
    while True:
        message = self.read_message()
        if message["type"] == "mcp_response" and message["id"] == request_id:
            return message["data"]

# Example usage
weather = self.call_mcp_tool('weather_get_current', {'city': 'Paris'})
servers = self.call_mcp_tool('cubicler_available_servers', {})
```

### HTTP Fallback (Legacy)

For backward compatibility, agents can still make HTTP requests to Cubicler's `/mcp` endpoint:

```python
import requests

def call_cubicler_tool_http(tool_name, arguments):
    """HTTP fallback method"""
    response = requests.post('http://localhost:1503/mcp', json={
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    })
    return response.json()

# Example: Get weather via HTTP
weather = call_cubicler_tool_http('weather_get_current', {'city': 'Paris'})
```

## Real-World Examples

### Local LLaMA Agent

```json
{
  "local_llama_70b": {
    "name": "Local LLaMA 70B",
    "description": "High-performance local LLaMA 70B model for privacy-sensitive tasks",
    "transport": "stdio",
    "command": "/usr/local/bin/llama-agent",
    "args": ["--model", "llama-2-70b", "--temperature", "0.7", "--max-tokens", "4096"],
    "env": { "CUDA_VISIBLE_DEVICES": "0,1", "MODEL_PATH": "/models/llama-2-70b" },
    "prompt": "You are LLaMA 70B, a powerful open-source language model. You excel at reasoning, coding, and analysis while prioritizing user privacy since you run locally."
  }
}
```

### Ollama Agent

```json
{
  "local_ollama_agent": {
    "name": "Ollama Local Agent",
    "description": "Local agent using Ollama framework for various models",
    "transport": "stdio",
    "command": "ollama",
    "args": ["run", "llama3.1:8b"],
    "prompt": "You are a helpful AI assistant running locally via Ollama. You provide accurate, helpful responses while ensuring complete privacy since everything runs on the user's machine."
  }
}
```

## Message Formats

### Input (agent_request from Cubicler)

```json
{
  "type": "agent_request",
  "data": {
    "agent": {"identifier": "my_stdio_agent", "name": "My Stdio Agent"},
    "tools": [{"name": "weather_get_current", "description": "Get current weather"}],
    "servers": [{"identifier": "weather_service", "name": "Weather Service"}],
    "messages": [{"sender": {"id": "user_123"}, "type": "text", "content": "Hello"}]
  }
}
```

### Output (agent_response to Cubicler)

```json
{
  "type": "agent_response",
  "data": {
    "timestamp": "2025-08-08T10:30:15Z",
    "type": "text", 
    "content": "Hello! How can I help you?",
    "metadata": {"usedToken": 50, "usedTools": 0}
  }
}
```

### MCP Request (from Agent to Cubicler)

```json
{
  "type": "mcp_request",
  "id": "uuid-request-id",
  "data": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {"name": "weather_get_current", "arguments": {"city": "Paris"}}
  }
}
```

### MCP Response (from Cubicler to Agent)

```json
{
  "type": "mcp_response",
  "id": "uuid-request-id", 
  "data": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {"temperature": "22°C", "condition": "sunny"}
  }
}
```

## Testing Your Agent

### 1. Test Message Format

```bash
# Test basic bidirectional format
echo '{"type":"agent_request","data":{"agent":{"name":"Test"},"tools":[],"servers":[],"messages":[{"sender":{"id":"test"},"type":"text","content":"Hello"}]}}' | python3 agent.py
```

### 2. Test via Cubicler

```bash
curl -X POST http://localhost:1503/dispatch/my_stdio_agent \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"sender": {"id": "test"}, "type": "text", "content": "Hello"}]}'
```

### 3. Test MCP Integration

Create a simple test agent that calls an MCP tool and verify it works end-to-end.

## Best Practices

- **Use line-delimited JSON** - Each message should be on a single line ending with `\n`
- **Use stderr for logging** - stdout is reserved for JSON messages
- **Handle message types properly** - Always check the `type` field of incoming messages
- **Generate unique IDs** - Use UUIDs for MCP request IDs to avoid conflicts
- **Handle MCP errors gracefully** - MCP calls can fail, handle error responses
- **Validate input JSON** - Handle malformed requests gracefully
- **Handle timeouts** - Default timeout is 90 seconds (3x DEFAULT_CALL_TIMEOUT)
- **Flush stdout** - Ensure messages are sent immediately with `flush()`

## Timeout Configuration

The stdio agent timeout can be configured via environment variables:

- `AGENT_CALL_TIMEOUT`: Specific timeout for agent calls (default: 90000ms)
- `DEFAULT_CALL_TIMEOUT`: Base timeout used for calculations (default: 30000ms)

The agent timeout defaults to 3 times the `DEFAULT_CALL_TIMEOUT` value.

## Bidirectional vs HTTP Comparison

### Bidirectional Stdio (Recommended)

✅ **No HTTP overhead** - Direct process communication  
✅ **Integrated protocol** - Everything over stdin/stdout  
✅ **Better performance** - Fewer context switches  
✅ **Simpler networking** - No HTTP client needed in agents  
✅ **Persistent connection** - Agent can make multiple MCP calls  
✅ **Type safety** - Well-defined message protocols

### HTTP Method (Legacy Support)

⚠️ **HTTP overhead** - Network stack involvement  
⚠️ **Additional dependency** - Requires HTTP client library  
⚠️ **More complex** - Network error handling required  
✅ **Familiar protocol** - Standard REST API approach  
✅ **Debugging friendly** - Can use curl/Postman for testing

## Architecture Benefits

The new bidirectional stdio transport provides:

1. **Unified Communication Channel**: Everything happens over the same stdin/stdout pipes
2. **Lower Latency**: No HTTP request/response cycle for MCP calls
3. **Better Resource Utilization**: Single persistent process vs multiple HTTP connections
4. **Simplified Error Handling**: All errors come through the same channel
5. **Protocol Consistency**: JSON-RPC for both agent and MCP communication

## Error Handling

### Common Errors and Solutions

1. **"Agent command must be a non-empty string"**
   - Ensure the `command` field is set and not empty

2. **"Agent call timeout after Xms"**
   - Your agent is taking too long to respond
   - Increase `AGENT_CALL_TIMEOUT` environment variable
   - Optimize your agent's processing time

3. **"Invalid JSON response from agent"**
   - Ensure your agent writes valid JSON to stdout
   - Check that no debug output goes to stdout (use stderr instead)

4. **"Invalid agent response format: missing required fields"**
   - Response must include: `timestamp`, `type`, `content`, `metadata`

### Debugging Tips

- Use `stderr` for debugging output in your agent
- Test your agent manually with echo commands
- Check process exit codes (0 = success)
- Validate JSON output with tools like `jq`

## Configuration Options

The stdio agent configuration supports the following properties:

- **`command`**: The executable command (required)
- **`args`**: Array of command-line arguments (optional)
- **`env`**: Environment variables for the process (optional)
- **`cwd`**: Working directory for the process (optional)

**Note**: The timeout is controlled globally via the `AGENT_CALL_TIMEOUT` environment variable (default: 90 seconds).

---

**Next Steps:**

- See [Agent Integration Overview](AGENT_INTEGRATION.md) for concepts and other transport types
- Check [HTTP Agent Integration](HTTP_AGENT_INTEGRATION.md) for web-based agents
- See [SSE Agent Integration](SSE_AGENT_INTEGRATION.md) for streaming agents
