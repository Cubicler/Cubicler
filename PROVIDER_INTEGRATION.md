# 🔌 Provider Integration Guide

> *The complete guide for integrating external services with Cubicler*

This guide shows you how to create external services that integrate with Cubicler, enabling AI agents to interact with your APIs, databases, and services through two supported protocols: **MCP (Model Context Protocol)** and **REST APIs**.

---

## 🎯 What is a CubicProvider?

A **CubicProvider** is an external service that AI agents can use through Cubicler. There are two types:

### 1. **MCP Servers** (Recommended)

- **Native MCP protocol** for standardized AI tool integration
- **Built-in discovery** - tools are automatically available to agents
- **Structured communication** following MCP specifications
- **Better error handling** and tool introspection

### 2. **REST Servers** (Legacy Support)

- **Traditional REST APIs** that don't implement MCP
- **Manual configuration** - endpoints must be defined in `providers.json`
- **HTTP-based** with OpenAI function schema format
- **Simpler to implement** for existing APIs

**CubicProviders enable:** Weather services, user management, email sending, database queries, file processing, payment processing, and more.

---

## 🏗️ Provider Architecture

```text
┌─────────────────┐   1. Register in        ┌──────────────────┐
│   Cubicler      │   providers.json        │ Your MCP Server  │
│  (Orchestrator) │◄────────────────────────┤ (Recommended)    │
└─────────────────┘                         └──────────────────┘
        ▲                                            │
        │ 2. MCP Protocol                            │
        │ Communication                              ▼
        │                                  ┌──────────────────┐
        │                                  │  External APIs   │
        │                                  │  / Databases     │
        │                                  └──────────────────┘
        │
        │                                  ┌──────────────────┐
        │   Alternative:                   │ Your REST API    │
        │   REST API                       │ (Legacy)         │
        └─────────────────────────────────►└──────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Create an MCP Server (Recommended)

Let's build a simple user management MCP server:

```javascript
// user-mcp-server.js
const express = require('express');
const app = express();

app.use(express.json());

// Mock user database
const users = {
  '1': { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
  '2': { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' }
};

// MCP tools/list endpoint - lists available tools
app.post('/mcp', (req, res) => {
  const { method } = req.body;

  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          {
            name: 'get_user',
            description: 'Get user information by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User ID to retrieve' }
              },
              required: ['id']
            }
          },
          {
            name: 'list_users',
            description: 'List all users, optionally filtered by role',
            inputSchema: {
              type: 'object',
              properties: {
                role: { type: 'string', description: 'Filter by role (optional)' }
              }
            }
          },
          {
            name: 'create_user',
            description: 'Create a new user',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'User full name' },
                email: { type: 'string', description: 'User email address' },
                role: { type: 'string', description: 'User role (admin, user)' }
              },
              required: ['name', 'email']
            }
          }
        ]
      }
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = req.body.params;

    try {
      let result;
      
      switch (name) {
        case 'get_user':
          const user = users[args.id];
          if (!user) {
            throw new Error('User not found');
          }
          result = user;
          break;

        case 'list_users':
          let userList = Object.values(users);
          if (args.role) {
            userList = userList.filter(user => user.role === args.role);
          }
          result = { users: userList };
          break;

        case 'create_user':
          const id = String(Object.keys(users).length + 1);
          const newUser = { 
            id, 
            name: args.name, 
            email: args.email, 
            role: args.role || 'user' 
          };
          users[id] = newUser;
          result = newUser;
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result)
            }
          ]
        }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -1,
          message: error.message
        }
      });
    }
    return;
  }

  // Handle other MCP methods if needed
  res.status(400).json({
    jsonrpc: '2.0',
    id: req.body.id,
    error: { code: -32601, message: 'Method not found' }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`User MCP Server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
```

### Option 2: Create a REST Server (Legacy)

For existing REST APIs that can't implement MCP:

```javascript
// user-rest-server.js  
const express = require('express');
const app = express();

app.use(express.json());

// Mock user database
const users = {
  '1': { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
  '2': { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' }
};

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users[id];
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// List all users
app.get('/api/users', (req, res) => {
  const { role } = req.query;
  let userList = Object.values(users);
  
  if (role) {
    userList = userList.filter(user => user.role === role);
  }
  
  res.json({ users: userList });
});

// Create new user
app.post('/api/users', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const id = String(Object.keys(users).length + 1);
  const newUser = { id, name, email, role };
  users[id] = newUser;
  
  res.status(201).json(newUser);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`User REST Server running on port ${PORT}`);
});
```

---

## 📋 Provider Registration

### Add to providers.json

Update your `providers.json` configuration file to register your service:

#### For MCP Server

```json
{
  "mcpServers": [
    {
      "identifier": "user_service",
      "name": "User Service", 
      "description": "User management and profile service",
      "transport": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  ]
}
```

#### For REST Server

```json
{
  "restServers": [
    {
      "identifier": "user_api",
      "name": "User API",
      "description": "User management REST API",
      "url": "http://localhost:5000/api",
      "defaultHeaders": {
        "Authorization": "Bearer your-api-key"
      },
      "endPoints": [
        {
          "name": "get_user_info",
          "description": "Get user information by user ID",
          "path": "/users/{userId}",
          "method": "GET",
          "userId": {
            "type": "string"
          },
          "query": {
            "type": "object",
            "properties": {
              "include_profile": {
                "type": "boolean"
              }
            }
          }
        },
        {
          "name": "list_users",
          "description": "List all users with optional role filter",
          "path": "/users",
          "method": "GET",
          "query": {
            "type": "object",
            "properties": {
              "role": {
                "type": "string",
                "description": "Filter by role"
              }
            }
          }
        },
        {
          "name": "create_user",
          "description": "Create a new user",
          "path": "/users",
          "method": "POST",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "User's full name"
              },
              "email": {
                "type": "string", 
                "description": "User's email address"
              },
              "role": {
                "type": "string",
                "description": "User role (admin, user)"
              }
            },
            "required": ["name", "email"]
          }
        }
      ]
    }
  ]
}
```

### Test Your Provider

```bash
# Start your MCP server
node user-mcp-server.js

# Test MCP tools/list
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Test MCP tool call
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", 
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_user",
      "arguments": {"id": "1"}
    }
  }'

# Or test REST endpoints
curl http://localhost:5000/api/users/1
```

### Configuration Environment Variables

Set environment variables for your providers configuration:

```env
# Point to your providers.json file
CUBICLER_PROVIDERS_LIST=./providers.json

# Or use a remote URL
CUBICLER_PROVIDERS_LIST=https://your-server.com/providers.json
```

---

## 📝 Configuration Reference

### MCP Server Configuration

```json
{
  "mcpServers": [
    {
      "identifier": "service_name",      // lowercase, no spaces, only - or _
      "name": "Display Name",
      "description": "Service description",
      "transport": "http",               // Currently only "http" supported
      "url": "http://localhost:4000/mcp", // MCP endpoint URL
      "headers": {                       // Optional: custom headers
        "Authorization": "Bearer token",
        "X-Custom": "value"
      }
    }
  ]
}
```

### REST Server Configuration

```json
{
  "restServers": [
    {
      "identifier": "api_name",          // lowercase, no spaces, only - or _
      "name": "API Display Name",
      "description": "API description",
      "url": "http://localhost:5000/api", // Base URL
      "defaultHeaders": {                // Optional: default headers for all endpoints
        "Authorization": "Bearer token",
        "Content-Type": "application/json"
      },
      "endPoints": [
        {
          "name": "endpoint_name",       // lowercase, no spaces, only - or _
          "description": "What this endpoint does",
          "path": "/resource/{id}",      // Path with {variable} placeholders
          "method": "GET",               // HTTP method
          "headers": {                   // Optional: endpoint-specific headers
            "X-Custom": "value"
          },
          "parameters": {                // URL parameters (path + query)
            "type": "object",
            "properties": {
              "id": {                    // Path variable {id}
                "type": "string",
                "description": "Resource ID"
              },
              "filter": {                // Query parameter
                "type": "string",
                "description": "Optional filter"
              }
            },
            "required": ["id"]
          },
          "payload": {                   // Request body for POST/PUT/PATCH
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Resource name"
              }
            },
            "required": ["name"]
          }
        }
      ]
    }
  ]
}
```

### Parameter Processing for REST APIs

- **Path Variables**: Parameters matching `{variableName}` in the path are extracted and replaced
- **Query Parameters**: Remaining parameters become URL query parameters
- **Query Parameter Conversion**:
  - Objects: JSON stringified
  - Arrays of primitives: Comma-separated values
  - Arrays of objects: JSON stringified

### Function Naming Convention

When AI agents call your functions, they use these naming patterns:

- **MCP Servers**: `{server_identifier}.{tool_name}` (e.g., `user_service.get_user`)
- **REST Servers**: `{server_identifier}.{endpoint_name}` (e.g., `user_api.get_user_info`)

---

## 💡 Implementation Examples

### Complete MCP Server Example (TypeScript)

```typescript
import express, { Request, Response } from 'express';

interface User {
  id: string;
  name: string; 
  email: string;
  role: string;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

const app = express();
app.use(express.json());

const users: Record<string, User> = {
  '1': { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
  '2': { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' }
};

app.post('/mcp', (req: Request, res: Response) => {
  const request: MCPRequest = req.body;

  if (request.method === 'tools/list') {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [
          {
            name: 'get_user',
            description: 'Get user by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'create_user',
            description: 'Create a new user',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Full name' },
                email: { type: 'string', description: 'Email address' },
                role: { type: 'string', description: 'User role' }
              },
              required: ['name', 'email']
            }
          }
        ]
      }
    };
    res.json(response);
    return;
  }

  if (request.method === 'tools/call') {
    const { name, arguments: args } = request.params;

    try {
      let result: any;

      switch (name) {
        case 'get_user':
          result = users[args.id];
          if (!result) throw new Error('User not found');
          break;

        case 'create_user':
          const id = String(Object.keys(users).length + 1);
          result = {
            id,
            name: args.name,
            email: args.email,
            role: args.role || 'user'
          };
          users[id] = result;
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      res.json({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        }
      });
    } catch (error: any) {
      res.json({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -1,
          message: error.message
        }
      });
    }
    return;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    id: request.id,
    error: { code: -32601, message: 'Method not found' }
  });
});

app.listen(4000, () => {
  console.log('MCP Server running on port 4000');
});
```

### REST Server with Express Validation

```javascript
const express = require('express');
const { body, param, validationResult } = require('express-validator');

const app = express();
app.use(express.json());

const users = {};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get user endpoint with validation
app.get('/api/users/:id', 
  param('id').isLength({ min: 1 }).withMessage('ID is required'),
  validate,
  (req, res) => {
    const user = users[req.params.id];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  }
);

// Create user endpoint with validation
app.post('/api/users',
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  validate,
  (req, res) => {
    const { name, email, role = 'user' } = req.body;
    const id = String(Object.keys(users).length + 1);
    const newUser = { id, name, email, role };
    users[id] = newUser;
    res.status(201).json(newUser);
  }
);

app.listen(5000, () => {
  console.log('REST Server running on port 5000');
});
```

---

## 🔍 Testing Your Provider

### Testing MCP Server

```bash
# Test tools/list
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Test tools/call
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_user",
      "arguments": {"id": "1"}
    }
  }'
```

### Testing REST Server

```bash
# Test GET endpoint
curl http://localhost:5000/api/users/1

# Test POST endpoint
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "admin"
  }'
```

### Integration Testing with Cubicler

1. **Start your provider service** (MCP or REST)
2. **Update providers.json** with your service configuration
3. **Start Cubicler** with your configuration
4. **Test through Cubicler**:

```bash
# Test via Cubicler dispatch
curl -X POST http://localhost:1503/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "sender": {"id": "test_user"},
      "type": "text",
      "content": "Get user information for ID 1"
    }]
  }'
```

---

## 🚀 Advanced Features

### Authentication and Security

#### For MCP Servers

```json
{
  "mcpServers": [
    {
      "identifier": "secure_service",
      "name": "Secure Service",
      "description": "Service with authentication",
      "transport": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-token",
        "X-API-Key": "your-api-key"
      }
    }
  ]
}
```

#### For REST Servers

```json
{
  "restServers": [
    {
      "identifier": "secure_api",
      "name": "Secure API",
      "description": "API with authentication",
      "url": "http://localhost:5000/api",
      "defaultHeaders": {
        "Authorization": "Bearer global-token"
      },
      "endPoints": [
        {
          "name": "protected_endpoint",
          "description": "Endpoint with specific auth",
          "path": "/protected",
          "method": "GET",
          "headers": {
            "X-Special-Auth": "endpoint-specific-token"
          }
        }
      ]
    }
  ]
}
```

### Error Handling Best Practices

#### MCP Server Error Responses

```javascript
// Standard MCP error response
res.json({
  jsonrpc: '2.0',
  id: request.id,
  error: {
    code: -1,                    // Custom error code
    message: 'User not found',   // Human-readable message
    data: {                      // Optional additional data
      userId: args.id,
      timestamp: new Date().toISOString()
    }
  }
});
```

#### REST Server Error Responses

```javascript
// Consistent error format
res.status(404).json({
  error: 'Not Found',
  message: 'User with ID 123 does not exist',
  code: 'USER_NOT_FOUND',
  timestamp: new Date().toISOString()
});
```

### Environment Configuration

Use environment variables for configuration:

```javascript
// In your provider service
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || 'default-key';
const DATABASE_URL = process.env.DATABASE_URL || 'sqlite:memory';

// In providers.json
{
  "mcpServers": [
    {
      "identifier": "dynamic_service",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer dynamic-token"
      }
    }
  ]
}
```

---

Made with ❤️ for service providers integrating with Cubicler.
