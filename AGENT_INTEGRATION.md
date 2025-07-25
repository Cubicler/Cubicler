# 🔌 Agent Integration Guide

> *The complete API contract for integrating AI agents with Cubicler*

This guide defines the exact API contract and integration flow that AI agents must implement to work with Cubicler. If you're building an AI agent service, this document specifies what endpoints you need to provide and how the communication flow works.

---

## 🎯 Agent Integration Contract

An **CubicAgent** in Cubicler is an AI service that implements a specific API contract:

1. **Implements `POST /call` endpoint** to receive requests from Cubicler
2. **Calls back to Cubicler** to discover provider capabilities via `/provider/:providerName/spec`  
3. **Executes functions** through Cubicler via `/execute/:functionName`
4. **Returns intelligent responses** to the user

---

## 🏗️ Integration Flow

```text
┌─────────────────┐    1. POST /call        ┌──────────────────┐
│   Cubicler      │────────────────────────►│ Your CubicAgent  │
│ (Orchestrator)  │   AgentRequest          │   Service        │
└─────────────────┘                         └──────────────────┘
        ▲                                             │
        │                                             │
        │ 6. Response                                 │ 2. GET /provider/X/spec
        │                                             ▼
        │                                   ┌──────────────────┐
        │                                   │   Cubicler       │
        │ 5. POST /execute/func             │ (Provider Specs) │
        │                                   └──────────────────┘
        │                                             │
        │                                             │ 3. Spec + Context
        │                                             ▼
        │                                   ┌──────────────────┐
        │                                   │ Your CubicAgent  │
        └───────────────────────────────────│ (Build Functions)│
                4. Function Execution       └──────────────────┘
                                                      │
                                                      │
                                               4a. Make Decision
                                                      ▼
                                              [Return Response]
```

### Step-by-Step Flow

1. **Cubicler → Agent**: `POST /call` with `AgentRequest` containing prompt, provider list, and messages
2. **CubicAgent → Cubicler**: `GET /provider/:providerName/spec` to get detailed function specs  
3. **Cubicler → CubicAgent**: Returns spec and context for the provider
4. **CubicAgent**: Rebuilds its function definitions and prompts based on received specs
5. **CubicAgent → Cubicler**: (Optional) `POST /execute/:functionName` to execute functions
6. **CubicAgent → Cubicler**: Returns final response to user

---

## 📋 Required API Contract

### 1. CubicAgent Endpoint: `POST /call`

Your agent **MUST** implement this endpoint to receive requests from Cubicler.

#### Request Format (AgentRequest)

```json
{
  "prompt": "# Weather Assistant\nYou are a weather assistant...",
  "providers": [
    {
      "name": "weather_api", 
      "description": "A provider for Weather API"
    },
    {
      "name": "user_service",
      "description": "User management service"  
    }
  ],
  "messages": [
    {
      "sender": "user",
      "content": "What's the weather in Paris?"
    }
  ]
}
```

#### Response Format

```json
{
  "message": "The weather in Paris is sunny with a temperature of 25°C."
}
```

### 2. Discover Provider Capabilities

To understand what functions are available, your agent should call Cubicler:

#### Request: `GET /provider/:providerName/spec`

```bash
GET http://localhost:1503/provider/weather_api/spec
```

#### Response

```json
{
  "context": "# Weather API Context\nThis provider handles weather data...",
  "functions": [
    {
      "name": "getWeather",
      "description": "Get current weather for a city",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {
            "type": "string",
            "description": "The city name"
          },
          "country": {
            "type": "string", 
            "description": "The country name"
          }
        },
        "required": ["city"]
      }
    }
  ]
}
```

### 3. Execute Functions

When your agent decides to execute a function:

#### Request: `POST /execute/:functionName`

```bash
POST http://localhost:1503/execute/getWeather
Content-Type: application/json

{
  "city": "Paris",
  "country": "France"
}
```

#### Response

```json
{
  "temperature": 25,
  "conditions": "sunny",
  "humidity": 60,
  "description": "Clear skies with sunshine"
}
```

---

## 💡 Implementation Examples

### Basic CubicAgent Implementation

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Required endpoint that Cubicler calls
app.post('/call', async (req, res) => {
  try {
    const { prompt, providers, messages } = req.body;
    
    console.log('Received prompt:', prompt);
    console.log('Available providers:', providers);
    console.log('User messages:', messages);
    
    // Step 1: Get detailed specs for providers you need
    const weatherSpec = await getProviderSpec('weather_api');
    
    // Step 2: Rebuild your AI function definitions
    const functions = weatherSpec.functions;
    const context = weatherSpec.context;
    
    // Step 3: Process with your AI model
    const response = await processWithAI(prompt, context, functions, messages);
    
    res.json({ message: response });
    
  } catch (error) {
    console.error('Agent error:', error);
    res.status(500).json({ 
      message: 'Sorry, I encountered an error processing your request.' 
    });
  }
});

// Helper function to get provider specs from Cubicler
async function getProviderSpec(providerName) {
  const response = await fetch(`http://localhost:1503/provider/${providerName}/spec`);
  if (!response.ok) {
    throw new Error(`Failed to get spec for ${providerName}`);
  }
  return await response.json();
}

// Helper function to execute functions via Cubicler
async function executeFunction(functionName, parameters) {
  const response = await fetch(`http://localhost:1503/execute/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters)
  });
  
  if (!response.ok) {
    throw new Error(`Function ${functionName} execution failed`);
  }
  
  return await response.json();
}

app.listen(3000, () => {
  console.log('Agent running on port 3000');
});
```

---

Made with ❤️ for AI agents integrating with Cubicler.
