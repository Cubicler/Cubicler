# 🔌 Provider Integration Guide

> *How to create external service providers for Cubicler*

This guide shows you how to build provider services that integrate with Cubicler, enabling AI agents to interact with your APIs, databases, and external services.

---

## 🎯 What is a Provider?

A **Provider** is an external service that:

1. **Exposes REST APIs** that perform specific business functions
2. **Provides a YAML spec** describing available functions and their parameters  
3. **Provides context documentation** explaining how to use these functions
4. **Handles authentication, validation, and business logic** independently

**Providers enable:** Weather services, user management, email sending, database queries, file processing, payment processing, and more.

---

## 🏗️ Provider Architecture

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cubicler      │    │   Your Provider  │    │  External APIs  │
│  (Orchestrator) │◄──►│    Service       │◄──►│  / Databases    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        ▲                        │
        │                        ▼
        │               ┌──────────────────┐
        │               │  Provider Files  │
        └───────────────┤ • spec.yaml      │
                        │ • context.md     │
                        └──────────────────┘
```

---

## 🚀 Quick Start

### 1. Create a Basic Provider Service

Let's build a simple user management provider:

```javascript
// user-provider.js
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

// Serve spec file
app.get('/spec/user_service.yaml', (req, res) => {
  res.sendFile(__dirname + '/user_service.yaml');
});

// Serve context file
app.get('/context/user_service.md', (req, res) => {
  res.sendFile(__dirname + '/user_service.md');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`User Provider running on port ${PORT}`);
  console.log(`Spec: http://localhost:${PORT}/spec/user_service.yaml`);
  console.log(`Context: http://localhost:${PORT}/context/user_service.md`);
});
```

### 2. Create the Provider Spec File

Create `user_service.yaml`:

```yaml
version: 2
kind: specs
services:
  user_service:
    base_url: http://localhost:4000
    default_headers:
      Content-Type: "application/json"
      Authorization: "Bearer {{env.API_KEY}}"
    endpoints:
      get_user:
        method: GET
        path: /api/users/{id}
        parameters:
          id:
            type: string
            description: User ID to retrieve
        response:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
            email:
              type: string
            role:
              type: string
      
      list_users:
        method: GET
        path: /api/users
        parameters:
          role:
            type: string
            description: Filter users by role (optional)
        response:
          type: object
          properties:
            users:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  name:
                    type: string
                  email:
                    type: string
                  role:
                    type: string
      
      create_user:
        method: POST
        path: /api/users
        payload:
          type: object
          properties:
            name:
              type: string
              description: User's full name
            email:
              type: string
              description: User's email address
            role:
              type: string
              description: User role (admin, user)
        response:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
            email:
              type: string
            role:
              type: string

functions:
  getUserById:
    service: user_service
    endpoint: get_user
    description: Retrieve a user by their ID
  
  listUsers:
    service: user_service
    endpoint: list_users
    description: Get list of all users, optionally filtered by role
  
  createUser:
    service: user_service
    endpoint: create_user
    description: Create a new user account
    override_payload:
      role: "user"  # Default role for new users
```

### 3. Create the Context Documentation

Create `user_service.md`:

```markdown
# User Service Provider

This provider manages user accounts and profiles in the system.

## Available Functions

### getUserById
Retrieves detailed information about a specific user.

**When to use:** When you need to look up a specific user's details, profile information, or verify a user exists.

**Parameters:**
- `id` (required): The unique identifier of the user to retrieve

**Example usage:**
- "Get user information for ID 123"
- "Show me the profile for user 456"
- "Look up details for user with ID abc123"

### listUsers  
Retrieves a list of all users in the system, with optional filtering.

**When to use:** When you need to show multiple users, search for users, or get an overview of user accounts.

**Parameters:**
- `role` (optional): Filter users by their role ("admin", "user", etc.)

**Example usage:**
- "Show me all users"
- "List all admin users"
- "Get all users with role 'user'"

### createUser
Creates a new user account in the system.

**When to use:** When registering new users or adding accounts to the system.

**Parameters:**
- `name` (required): The user's full name
- `email` (required): The user's email address  
- `role` (optional): The user's role, defaults to "user"

**Example usage:**
- "Create a user named John Doe with email john@example.com"
- "Register a new admin user"
- "Add user Jane Smith as an administrator"

## Response Format

All functions return user objects with the following structure:
- `id`: Unique user identifier
- `name`: User's full name
- `email`: User's email address
- `role`: User's role in the system

## Error Handling

- Returns 404 if user is not found
- Returns 400 for invalid input data
- Returns appropriate error messages in JSON format
```

---

## 📋 Provider Registration

### 1. Add to Providers List

Update your `providers.yaml` file:

```yaml
version: 1
kind: providers
providers:
  - name: "user_service"
    description: "User management and profile service"
    spec_source: "http://localhost:4000/spec/user_service.yaml"
    context_source: "http://localhost:4000/context/user_service.md"
```

### 2. Test Your Provider

```bash
# Start your provider service
node user-provider.js

# Test the spec endpoint
curl http://localhost:4000/spec/user_service.yaml

# Test the context endpoint  
curl http://localhost:4000/context/user_service.md

# Test an API endpoint
curl http://localhost:4000/api/users/1
```

---

## 📝 Spec File Reference

### Complete Spec Schema

```yaml
version: 2
kind: specs

# Service definitions
services:
  service_name:
    base_url: https://api.example.com
    default_headers:
      Authorization: "Bearer {{env.TOKEN}}"
      Content-Type: "application/json"
    endpoints:
      endpoint_name:
        method: GET|POST|PUT|DELETE|PATCH
        path: /api/path/{param}
        headers:          # Optional: endpoint-specific headers
          X-Custom: "value"
        parameters:       # URL parameters (path + query)
          param_name:
            type: string|number|boolean|array|object
            description: "Parameter description"
        payload:          # Request body (for POST/PUT/PATCH)
          type: object
          properties:
            field_name:
              type: string
              description: "Field description"
        response:         # Response schema
          type: object
          properties:
            field_name:
              type: string

# Function definitions (what AI agents see)
functions:
  functionName:
    service: service_name
    endpoint: endpoint_name
    description: "Function description"
    override_parameters:    # Hidden from AI, always included
      secret_key: "{{env.SECRET}}"
    override_payload:       # Hidden from AI, always included
      source: "cubicler"
```

### Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | `"hello"` |
| `number` | Numeric values | `42`, `3.14` |
| `boolean` | True/false | `true`, `false` |
| `array` | List of values | `["a", "b", "c"]` |
| `object` | Key-value pairs | `{"key": "value"}` |

### Environment Variables

Use `{{env.VARIABLE_NAME}}` syntax:

```yaml
default_headers:
  Authorization: "Bearer {{env.API_TOKEN}}"
  X-Client-ID: "{{env.CLIENT_ID}}"
```

---

Made with ❤️ for service providers integrating with Cubicler.
