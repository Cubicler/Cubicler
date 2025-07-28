# Cubicler Architecture

## Cubicler Configurations

### providers.json

List of providers that can be accessed by Cubicler:

```json
{ 
    "mcpServers": [{
        "identifier": "some", // id should be lowercase no space nose symbol except - or _
        "name": "some",
        "description": "some description",
        "transport": "http", // for now only support http, will support sse, websocket and stdio later
        "url": "http://serverurl.com/mcp",
        "headers": { 
            "Authorization": "Bearer your-api-key"
        }
    }],
    "restServers": [{ // REST server without MCP. It must be http transport
        "identifier": "some", // id should be lowercase no space nose symbol except - or _
        "name": "some",
        "description": "some description",
        "url": "http://serverurl.com/mcp",
        "defaultHeaders": { 
            "Authorization": "Bearer your-api-key"
        },
        "endPoints": [{
            "name": "some", // name should be lowercase no space nose symbol except - or _
            "url": "http://serverurl.com/endpoint",
            "method": "POST",
            "headers": { 
                "Authorization": "Bearer your-api-key"
            },
            // both param will be converted to function parameters when sent to the Agent
            "query": { 
                // same as MCP function (OpenAI-style)
                // Object will be converted to mified JSON
            },
            "payload": { 
                // same as MCP function (OpenAI-style)
                // will be used as JSON body
            }
        }]
    }]
}
```

### agents.json

List of Agents that can be accessed by Cubicler:

```json
{ 
    "basePrompt": "some", // optional, will use as base prompt. agents specific prompt will be append after this basePrompt before sent to the agent
    "defaultPrompt": "some", // optional
    "agents": [{
        "identifier": "some",// identifier should be lowercase no space nose symbol except - or _
        "name": "some",
        "transport": "http", // for now only support http, will support stdio later
        "url": "http://clienturl.com/agent",
        "description": "some description about this agent",
        "prompt": "You are an helpful assitant. You should do this and that" // optional if default prompt is provided
    }]
}
```

## Cubicler Internal Functions (tools/list functions)

### Check Available Servers

schema:

```json
{ 
    "name": "cubicler.available_servers",
    "descriptions": "Get information for available Servers managed by Cubicler",
    "inputSchema": {
    "type": "null"
  }
}
```

response:

```json
{ 
    "total": 10, // total mcp connected
    "servers": [{
        "identifier": "some", // id should be lowercase no space nose symbol except - or _
        "name": "some",
        "description": "some description",
        "toolsCount": 10
    }]
}
```

### Fetch Servers Tools

schema:

```json
{ 
    "name": "cubicler.fetch_server_tools",
    "descriptions": "Get tools from one particular MCP server managed by Cubicler",
    "inputSchema": { 
        "type": "string",
        "description": "Name of MPC server"
    }
}
```

response:

```json
{ 
    "functions": { 
        "name": "{server id}.{function name}",
        "description": "description of the function",
        "parameters": { 
            // same as MCP function (OpenAI-style)
        }
    }
}
```

## Cubicler REST endpoint

### POST /mcp

Default MCP endpoint

headers: not yet implemented, will add authorization later
body will be the same as MCP specification

### POST /dispatch/:agentId or /dispatch

Dispatch message to the Agent

agentId: optional, if not there, use the default agents (the first one listed)
headers: not yet implemented, will add authorization later
body:

```json
{ 
    "messages": [{
        "sender": { 
            "id": "sender id",
            "name": "name of the sender" // optional
        },
        "timestamp": "2025-07-28T17:45:00+07:00", // ISO 8601, this is optional meta data
        "type": "text", // only support text for now, will support image/video etc later
        "content": "the message"
    }]
}
```

response:

```json
{ 
    "sender": { 
        "id": "agent id",
        "name": "name of the agent"
    },
    "timestamp": "2025-07-28T17:45:00+07:00",
    "type": "text", // only support text for now, will support image/video etc later
    "content": "the message",
    "metadata": { 
        "usedToken": 100,
        "usedTools": 2
    }
}
```

### GET /agents

List all available Agents

headers: not yet implemented, will add authorization later
response:

```json
{ 
    "agents": { 
        "identifier": "some",
        "name": "some",
        "description": "some description about this agent",
    },
    "total": 10 
}
```

### GET /health

Get health of the Cubicler server

headers: not yet implemented, will add authorization later
response:

```json
{ 
    "status": "healthy|unhealthy",
}
```
