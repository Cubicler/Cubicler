# 🔌 Agent Integration Guide

> *The complete API contract for integrating AI agents with Cubicler*

This guide defines the exact API contract and integration flow that AI agents must implement to work with Cubicler. If you're building an AI agent service, this document specifies what endpoints you need to provide and how the communication flow works.

---

## 🎯 Agent Integration Contract

A **CubicAgent** in Cubicler is an AI service that implements a streamlined API contract:

1. **Implements HTTP endpoint** to receive requests from Cubicler
2. **Uses Cubicler internal functions** as tools to discover and interact with external services
3. **Calls MCP servers and REST APIs** through Cubicler's `/mcp` endpoint
4. **Returns intelligent responses** to the user

---

## 🏗️ Integration Flow

```text
┌─────────────────┐   1. POST /agent       ┌──────────────────┐
│   Cubicler      │───────────────────────►│ Your CubicAgent  │
│ (Orchestrator)  │   AgentRequest         │   Service        │
└─────────────────┘                        └──────────────────┘
        ▲                                            │
        │                                            │
        │ 4. AgentResponse                           │ 2. Tool Calls via MCP
        │                                            ▼
        │                                  ┌──────────────────┐
        │                                  │   Cubicler       │
        │ 3. MCP Responses                 │ (MCP Endpoint)   │
        │                                  └──────────────────┘
        │                                            │
        │                                            │ 2a. Route to Services
        │                                            ▼
        │                                  ┌──────────────────┐
        └────────────────────────────────  │ MCP Servers /    │
                                           │ REST APIs        │
                                           └──────────────────┘
```

### Step-by-Step Flow

1. **Cubicler → Agent**: `POST /agent` with complete `AgentRequest` containing agent info, tools, servers, and messages
2. **CubicAgent → Cubicler**: Uses built-in tools like `cubicler_available_servers` and `cubicler_fetch_server_tools`
3. **CubicAgent → Cubicler**: Calls external functions via `POST /mcp` using MCP protocol
4. **CubicAgent → Cubicler**: Returns final `AgentResponse` with results

---

## 📋 Required API Contract

### Agent Endpoint: `POST /agent`

Your agent **MUST** implement an HTTP endpoint to receive requests from Cubicler.

#### Request Format (AgentRequest)

```json
{
  "agent": {
    "identifier": "gpt_4o",
    "name": "GPT-4O Agent",
    "description": "Advanced reasoning and analysis",
    "prompt": "You are a helpful AI assistant powered by Cubicler. You specialize in complex problem solving."
  },
  "tools": [
    {
      "name": "cubicler_available_servers",
      "description": "Get information for available servers managed by Cubicler",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    },
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
  ],
  "servers": [
    {
      "identifier": "weather_service",
      "name": "Weather Service", 
      "description": "Provides weather information via MCP"
    },
    {
      "identifier": "user_api",
      "name": "User API",
      "description": "Manage user information"
    }
  ],
  "messages": [
    {
      "sender": {
        "id": "user_123",
        "name": "John Doe"
      },
      "timestamp": "2025-07-28T17:45:00+07:00",
      "type": "text",
      "content": "What's the weather in Paris?"
    }
  ]
}
```

#### Response Format (AgentResponse)

```json
{
  "timestamp": "2025-07-28T17:45:30+07:00",
  "type": "text",
  "content": "The weather in Paris is sunny with a temperature of 25°C.",
  "metadata": {
    "usedToken": 150,
    "usedTools": 2
  }
}
```

### Calling External Functions via MCP

When your agent needs to call external functions, use Cubicler's MCP endpoint:

#### Request: `POST /mcp`

```bash
POST http://localhost:1503/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "weatherService_getCurrentWeather",
    "arguments": {
      "city": "Paris",
      "country": "France"
    }
  }
}
```

#### MCP Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"temperature\": 25, \"conditions\": \"sunny\", \"humidity\": 60}"
      }
    ]
  }
}
```

### Using Cubicler Internal Functions

Your agent has access to Cubicler's built-in functions for service discovery:

#### 1. `cubicler_available_servers`

Discover all available external services:

```bash
POST http://localhost:1503/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cubicler_available_servers",
    "arguments": {}
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"total\": 2, \"servers\": [{\"identifier\": \"weather_service\", \"name\": \"Weather Service\", \"description\": \"Provides weather information via MCP\", \"toolsCount\": 3}]}"
      }
    ]
  }
}
```

#### 2. `cubicler_fetch_server_tools`

Get detailed tools from a specific server:

```bash
POST http://localhost:1503/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cubicler_fetch_server_tools",
    "arguments": {
      "serverIdentifier": "weather_service"
    }
  }
}
```

**Tools Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text", 
        "text": "{\"functions\": [{\"name\": \"1r2dj4_get_current_weather\", \"description\": \"Get current weather for a location\", \"parameters\": {\"type\": \"object\", \"properties\": {\"city\": {\"type\": \"string\"}, \"country\": {\"type\": \"string\"}}, \"required\": [\"city\"]}}]}"
      }
    ]
  }
}
```

---

## 💡 Implementation Examples

### Basic CubicAgent Implementation

```javascript
const express = require('express');
const fetch = require('node-fetch'); // or your preferred HTTP client
const app = express();
app.use(express.json());

// Required endpoint that Cubicler calls
app.post('/agent', async (req, res) => {
  try {
    const { agent, tools, servers, messages } = req.body;
    
    console.log(`Received request for agent: ${agent.name}`);
    console.log(`Available servers: ${servers.map(s => s.identifier).join(', ')}`);
    console.log(`Messages: ${messages.length} message(s)`);
    
    // Step 1: Get available servers if needed
    const availableServers = await callCubiclerTool('cubicler_available_servers', {});
    console.log('Available servers:', availableServers);
    
    // Step 2: Get detailed tools for a specific server if needed
    const weatherTools = await callCubiclerTool('cubicler_fetch_server_tools', {
      serverIdentifier: 'weather_service'
    });
    console.log('Weather service tools:', weatherTools);
    
    // Step 3: Process with your AI model (this is where you'd integrate with OpenAI, Claude, etc.)
    const response = await processWithAI(agent, tools, servers, messages);
    
    // Step 4: If needed, call external functions via MCP
    if (response.needsWeather) {
      const weatherData = await callExternalFunction(
        '1r2dj4_get_current_weather',
        { city: 'Paris', country: 'France' }
      );
      response.content = `The weather in Paris is ${weatherData.temperature}°C and ${weatherData.conditions}.`;
    }
    
    // Return in AgentResponse format
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
    console.error('Agent error:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      type: 'text',
      content: 'Sorry, I encountered an error processing your request.',
      metadata: {
        usedToken: 0,
        usedTools: 0
      }
    });
  }
});

// Helper function to call Cubicler internal tools
async function callCubiclerTool(toolName, arguments) {
  const response = await fetch('http://localhost:1503/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: arguments
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to call ${toolName}`);
  }
  
  const result = await response.json();
  return JSON.parse(result.result.content[0].text);
}

// Helper function to call external functions via MCP
async function callExternalFunction(functionName, parameters) {
  const response = await fetch('http://localhost:1503/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random(),
      method: 'tools/call',
      params: {
        name: functionName,
        arguments: parameters
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Function ${functionName} execution failed`);
  }
  
  const result = await response.json();
  return JSON.parse(result.result.content[0].text);
}

// Mock AI processing function - replace with your actual AI integration
async function processWithAI(agent, tools, servers, messages) {
  // This is where you would integrate with your AI model
  // For example: OpenAI GPT, Claude, local models, etc.
  
  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage.content.toLowerCase();
  
  if (userContent.includes('weather')) {
    return {
      needsWeather: true,
      content: '', // Will be filled after weather call
      tokens: 50,
      toolsUsed: 1
    };
  }
  
  return {
    needsWeather: false,
    content: `Hello! I'm ${agent.name}. I received your message: "${lastMessage.content}"`,
    tokens: 25,
    toolsUsed: 0
  };
}

app.listen(3000, () => {
  console.log('CubicAgent running on port 3000');
  console.log('Ready to receive requests from Cubicler at POST /agent');
});
```

### Configuration for Your Agent

Add your agent to the `agents.json` configuration:

```json
{
  "basePrompt": "You are a helpful AI assistant powered by Cubicler.",
  "defaultPrompt": "You have access to various tools and services through Cubicler.",
  "agents": [
    {
      "identifier": "my_custom_agent",
      "name": "My Custom Agent",
      "transport": "http",
      "url": "http://localhost:3000/agent",
      "description": "A custom AI agent that integrates with Cubicler",
      "prompt": "You are a specialized agent that can access weather data and other services."
    }
  ]
}
```

#### 📝 Flexible Prompt Configuration

**Cubicler automatically handles three types of prompt sources:**

1. **Inline Text** - Simple string prompts (recommended for most cases):

   ```json
   {
     "basePrompt": "You are a helpful AI assistant with tool access.",
     "prompt": "You specialize in data analysis and provide structured insights."
   }
   ```

2. **Local Files** - Load prompts from filesystem:

   ```json
   {
     "basePrompt": "./prompts/system-base.md",
     "prompt": "~/agent-configs/specialist.txt"
   }
   ```

3. **Remote URLs** - Fetch prompts from web sources:

   ```json
   {
     "basePrompt": "https://your-org.com/prompts/base.md",
     "prompt": "https://raw.githubusercontent.com/your-org/configs/main/agent.md"
   }
   ```

**Smart Detection & Fallback:**

- Cubicler automatically detects the prompt type based on content
- If file/URL loading fails, content is gracefully used as inline text
- No need to specify the prompt type - Cubicler handles it automatically

### TypeScript Implementation

```typescript
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string;
  };
  tools: Array<{
    name: string;
    description: string;
    parameters: any;
  }>;
  servers: Array<{
    identifier: string;
    name: string;
    description: string;
  }>;
  messages: Array<{
    sender: { id: string; name?: string };
    timestamp?: string;
    type: 'text';
    content: string;
  }>;
}

interface AgentResponse {
  timestamp: string;
  type: 'text';
  content: string;
  metadata: {
    usedToken?: number;
    usedTools?: number;
  };
}

const app = express();
app.use(express.json());

app.post('/agent', async (req: Request, res: Response) => {
  try {
    const request: AgentRequest = req.body;
    
    // Your AI processing logic here
    const response: AgentResponse = {
      timestamp: new Date().toISOString(),
      type: 'text',
      content: `Processed message from ${request.messages[0].sender.id}`,
      metadata: {
        usedToken: 100,
        usedTools: 1
      }
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      type: 'text',
      content: 'Error processing request',
      metadata: { usedToken: 0, usedTools: 0 }
    });
  }
});

app.listen(3000);
```

---

## 🔍 Testing Your Agent

1. **Start Cubicler** with your agent configured in `agents.json`
2. **Send a test message** to Cubicler:

```bash
curl -X POST http://localhost:1503/dispatch/my_custom_agent \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "sender": {"id": "test_user", "name": "Test User"},
      "type": "text", 
      "content": "Hello, can you help me?"
    }]
  }'
```

1. **Check the response** follows the `DispatchResponse` format
2. **Verify tool calls** work by asking for weather or other services

### Stdio Agent Implementation (Python Example)

For stdio transport, your agent runs as a command-line process that communicates via stdin/stdout:

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def call_cubicler_tool(tool_name, params):
    """Call a Cubicler tool - implement your HTTP client here"""
    # This would make HTTP request to Cubicler for tool execution
    # Implementation depends on your environment and HTTP library
    pass

def process_request():
    # Read request from stdin
    try:
        request_data = json.load(sys.stdin)
        agent = request_data['agent']
        tools = request_data['tools'] 
        servers = request_data['servers']
        messages = request_data['messages']
        
        # Process the last user message
        last_message = messages[-1]
        user_content = last_message['content']
        
        # Simple echo response - replace with your AI logic
        response_content = f"I received: {user_content}"
        
        # You can call Cubicler tools here if needed:
        # weather_data = call_cubicler_tool('1r2dj4_get_weather', {'city': 'Jakarta'})
        
        # Return response as JSON to stdout
        response = {
            "timestamp": datetime.now().isoformat(),
            "type": "text",
            "content": response_content,
            "metadata": {
                "usedToken": 10,
                "usedTools": 0
            }
        }
        
        json.dump(response, sys.stdout)
        sys.stdout.flush()
        
    except Exception as e:
        # Error response
        error_response = {
            "timestamp": datetime.now().isoformat(),
            "type": "text", 
            "content": f"Error processing request: {str(e)}",
            "metadata": {
                "usedToken": 0,
                "usedTools": 0
            }
        }
        json.dump(error_response, sys.stdout)
        sys.stdout.flush()

if __name__ == "__main__":
    process_request()
```

**Agent Configuration:**

```json
{
  "identifier": "python-agent",
  "name": "Python CLI Agent",
  "transport": "stdio",
  "url": "/usr/bin/python3 /path/to/agent.py",
  "description": "Python-based command-line agent"
}
```

---

## 🚀 Advanced Features

### Function Naming Convention

External functions follow the pattern: `{hash}_{snake_case_function}` where hash is a 6-character base36 hash derived from server identifier and URL.

- MCP servers: `1r2dj4_get_current_weather`
- REST servers: `sft7he_get_user_info`

The hash ensures collision-resistant and config-order-independent function names.

### Error Handling

Always return a valid `AgentResponse` even on errors:

```json
{
  "timestamp": "2025-07-28T17:45:30+07:00",
  "type": "text",
  "content": "I encountered an error: [error description]",
  "metadata": {
    "usedToken": 0,
    "usedTools": 0
  }
}
```

### Transport Support

Cubicler supports multiple transport types for agent communication:

#### HTTP Transport

- Standard REST API communication
- Agent runs as a web server listening on HTTP endpoint
- Most common for cloud-based or containerized agents

#### Stdio Transport

- Local process-based communication via stdin/stdout
- Perfect for command-line agents or local model runners
- Agent configured with command to execute (e.g., `/usr/local/bin/agent --model llama2`)
- Communication flow:
  1. Cubicler spawns the process
  2. Sends `AgentRequest` as JSON to stdin
  3. Agent responds with `AgentResponse` as JSON via stdout
  4. Process can exit or continue running

Future versions will add:

- Server-Sent Events (SSE)
- WebSocket

---

Made with ❤️ for AI agents integrating with Cubicler.
