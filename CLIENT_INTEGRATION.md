# 🖥️ Client Integration Guide

> *How to integrate your applications with Cubicler*

This guide shows you how to connect your client applications (Telegram bots, Slack apps, web chat interfaces, mobile apps, etc.) to Cubicler to leverage AI agents with external service capabilities.

---

## 🚀 Quick Start

### Basic Integration

```javascript
// Example: Simple chat interface integration
const response = await fetch('http://localhost:1503/dispatch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      {
        sender: {
          id: 'user_123',
          name: 'John Doe'
        },
        type: 'text',
        content: 'What is the weather in Paris?'
      }
    ]
  })
});

const result = await response.json();
console.log(result.content); // AI agent's response
```

---

## 📘 API Reference

### Core Endpoints for Client Integration

| Endpoint | Method | Purpose | Required |
|----------|---------|---------|-----------|
| `/dispatch` | POST | Send message to default AI agent | ✅ |
| `/dispatch/:agentId` | POST | Send message to specific AI agent | ✅ |
| `/agents` | GET | List available agents | Optional |
| `/health` | GET | Check system status | Optional |

---

## 🔧 Detailed Integration

### 1. Sending Messages to Default Agent

**Endpoint:** `POST /dispatch`

**Request Format:**

```json
{
  "messages": [
    {
      "sender": {
        "id": "user_123",
        "name": "John Doe" // optional
      },
      "timestamp": "2025-07-28T17:45:00+07:00", // optional, ISO 8601 format
      "type": "text", // currently only "text" supported (image/video planned)
      "content": "What's the weather like in Jakarta?"
    }
  ]
}
```

**Response Format:**

```json
{
  "sender": {
    "id": "gpt_4o",
    "name": "GPT-4O Agent"
  },
  "timestamp": "2025-07-28T17:45:30+07:00",
  "type": "text",
  "content": "The current weather in Jakarta is 28°C with partly cloudy conditions.",
  "metadata": {
    "usedToken": 150,
    "usedTools": 2
  }
}
```

**Example:**

```javascript
const sendToDefaultAgent = async (userMessage, userId = 'user_123', userName = null) => {
  try {
    const response = await fetch('http://localhost:1503/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: {
              id: userId,
              name: userName
            },
            type: 'text',
            content: userMessage
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error calling Cubicler:', error);
    return 'Sorry, I encountered an error while processing your request.';
  }
};
```

### 2. Sending Messages to Specific Agent

**Endpoint:** `POST /dispatch/:agentId`

**When to use:** When you want to route to a specific AI agent (e.g., "gpt_4o", "claude_3_5", "weather_specialist")

**Example:**

```javascript
const sendToSpecificAgent = async (agentId, userMessage, userId = 'user_123') => {
  const response = await fetch(`http://localhost:1503/dispatch/${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          sender: {
            id: userId
          },
          type: 'text',
          content: userMessage
        }
      ]
    })
  });
  
  return await response.json();
};

// Usage
const weatherResponse = await sendToSpecificAgent('weather_specialist', 'Weather in Tokyo?');
const gptResponse = await sendToSpecificAgent('gpt_4o', 'Analyze this data...');
```

### 3. Multi-turn Conversations

For chat applications that need to maintain conversation context:

```javascript
class CubiclerChat {
  constructor(baseUrl = 'http://localhost:1503', userId = 'user_123', userName = null) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    this.userName = userName;
    this.conversationHistory = [];
  }
  
  async sendMessage(userMessage, agentId = null) {
    // Add user message to history
    const userMsg = {
      sender: {
        id: this.userId,
        name: this.userName
      },
      timestamp: new Date().toISOString(),
      type: 'text',
      content: userMessage
    };
    
    this.conversationHistory.push(userMsg);
    
    const endpoint = agentId ? `/dispatch/${agentId}` : '/dispatch';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Add agent response to history
      this.conversationHistory.push({
        sender: result.sender,
        timestamp: result.timestamp,
        type: result.type,
        content: result.content
      });
      
      return result;
    } catch (error) {
      console.error('Chat error:', error);
      return {
        content: 'Sorry, I encountered an error.',
        error: true
      };
    }
  }
  
  clearHistory() {
    this.conversationHistory = [];
  }
  
  getLastResponse() {
    const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
    return lastMessage?.sender?.id !== this.userId ? lastMessage : null;
  }
}

// Usage
const chat = new CubiclerChat('http://localhost:1503', 'user_456', 'Alice Smith');
const response1 = await chat.sendMessage('What is the weather in Paris?');
const response2 = await chat.sendMessage('What about London?'); // Maintains context
console.log(response2.content);
```

---

## 🤖 Platform-Specific Examples

### Telegram Bot Integration

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chat = new CubiclerChat('http://localhost:1503');

## 🤖 Platform-Specific Examples

### Telegram Bot Integration

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = `telegram_${msg.from.id}`;
  const userName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const userMessage = msg.text;
  
  try {
    const response = await fetch('http://localhost:1503/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: {
              id: userId,
              name: userName
            },
            type: 'text',
            content: userMessage
          }
        ]
      })
    });
    
    const result = await response.json();
    bot.sendMessage(chatId, result.content);
  } catch (error) {
    console.error('Telegram bot error:', error);
    bot.sendMessage(chatId, 'Sorry, I encountered an error while processing your request.');
  }
});
```

### Discord Bot Integration

```javascript
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const userId = `discord_${message.author.id}`;
  const userName = message.author.displayName || message.author.username;
  
  try {
    const response = await fetch('http://localhost:1503/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: {
              id: userId,
              name: userName
            },
            type: 'text',
            content: message.content
          }
        ]
      })
    });
    
    const result = await response.json();
    message.reply(result.content);
  } catch (error) {
    console.error('Discord bot error:', error);
    message.reply('Sorry, I encountered an error while processing your request.');
  }
});

client.login(process.env.DISCORD_TOKEN);
```

### Express.js Web API Integration

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'web_user', userName, agentId } = req.body;
    
    const endpoint = agentId ? `/dispatch/${agentId}` : '/dispatch';
    
    const response = await fetch(`http://localhost:1503${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            sender: {
              id: userId,
              name: userName
            },
            type: 'text',
            content: message
          }
        ]
      })
    });
    
    const result = await response.json();
    
    res.json({ 
      success: true, 
      response: result.content,
      agent: result.sender,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process message' 
    });
  }
});

// Real-time chat with conversation history
const conversationSessions = new Map(); // In production, use Redis or database

app.post('/api/chat/session', async (req, res) => {
  try {
    const { sessionId, message, userId, userName, agentId } = req.body;
    
    // Get or create conversation history
    let history = conversationSessions.get(sessionId) || [];
    
    // Add user message to history
    const userMessage = {
      sender: { id: userId, name: userName },
      timestamp: new Date().toISOString(),
      type: 'text',
      content: message
    };
    history.push(userMessage);
    
    const endpoint = agentId ? `/dispatch/${agentId}` : '/dispatch';
    
    const response = await fetch(`http://localhost:1503${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });
    
    const result = await response.json();
    
    // Add agent response to history
    history.push(result);
    conversationSessions.set(sessionId, history);
    
    res.json({ 
      success: true, 
      response: result.content,
      agent: result.sender,
      metadata: result.metadata,
      sessionId
    });
  } catch (error) {
    console.error('Session API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process message' 
    });
  }
});

app.listen(3000, () => {
  console.log('Chat API running on port 3000');
});
```

---

## 🛠️ Utility Functions

### Check Available Agents

```javascript
const getAvailableAgents = async () => {
  try {
    const response = await fetch('http://localhost:1503/agents');
    const data = await response.json();
    return data.agents; // array of agent objects
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
};

// Usage
const agents = await getAvailableAgents();
console.log('Available agents:', agents);
// Expected output: 
// [
//   { identifier: 'gpt_4o', name: 'GPT-4O Agent', description: '...' },
//   { identifier: 'claude_3_5', name: 'Claude 3.5 Agent', description: '...' }
// ]
```

### Health Check

```javascript
const checkCubiclerHealth = async () => {
  try {
    const response = await fetch('http://localhost:1503/health');
    const health = await response.json();
    return {
      isHealthy: health.status === 'healthy',
      details: health
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      isHealthy: false,
      error: error.message
    };
  }
};

// Usage
const healthCheck = await checkCubiclerHealth();
if (healthCheck.isHealthy) {
  console.log('Cubicler is healthy');
  console.log('Agents:', healthCheck.details.services.agents?.count || 0);
  console.log('Providers:', healthCheck.details.services.providers?.count || 0);
} else {
  console.log('Cubicler is not responding properly');
}
```

### Agent Selector Helper

```javascript
const selectBestAgent = async (userMessage, availableAgents = null) => {
  // Get available agents if not provided
  if (!availableAgents) {
    availableAgents = await getAvailableAgents();
  }
  
  // Simple heuristic-based agent selection
  const message = userMessage.toLowerCase();
  
  // Look for weather-related queries
  if (message.includes('weather') || message.includes('temperature') || message.includes('forecast')) {
    const weatherAgent = availableAgents.find(agent => 
      agent.identifier.includes('weather') || agent.description.toLowerCase().includes('weather')
    );
    if (weatherAgent) return weatherAgent.identifier;
  }
  
  // Look for data analysis queries
  if (message.includes('analyze') || message.includes('data') || message.includes('statistics')) {
    const dataAgent = availableAgents.find(agent => 
      agent.identifier.includes('data') || agent.description.toLowerCase().includes('analys')
    );
    if (dataAgent) return dataAgent.identifier;
  }
  
  // Look for GPT-4 for complex reasoning
  if (message.includes('complex') || message.includes('reasoning') || message.length > 200) {
    const gptAgent = availableAgents.find(agent => 
      agent.identifier.includes('gpt') || agent.identifier.includes('4')
    );
    if (gptAgent) return gptAgent.identifier;
  }
  
  // Default: use first available agent or null for default routing
  return null;
};

// Usage
const smartSend = async (userMessage, userId = 'user_123') => {
  const bestAgent = await selectBestAgent(userMessage);
  
  const endpoint = bestAgent ? `/dispatch/${bestAgent}` : '/dispatch';
  
  const response = await fetch(`http://localhost:1503${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{
        sender: { id: userId },
        type: 'text',
        content: userMessage
      }]
    })
  });
  
  return await response.json();
};
```

---

## 🔒 Error Handling

### Common Error Scenarios

```javascript
const robustCubiclerCall = async (message, agentId = null, userId = 'user_123', userName = null) => {
  const endpoint = agentId ? `/dispatch/${agentId}` : '/dispatch';
  
  try {
    const response = await fetch(`http://localhost:1503${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          sender: {
            id: userId,
            name: userName
          },
          type: 'text',
          content: message
        }]
      })
    });
    
    // Handle different HTTP status codes
    if (response.status === 400) {
      const errorData = await response.json();
      console.error('Bad request:', errorData.error);
      return {
        content: 'Invalid request format. Please try again.',
        error: true,
        code: 'BAD_REQUEST'
      };
    }
    
    if (response.status === 404) {
      return {
        content: 'The requested agent is not available.',
        error: true,
        code: 'AGENT_NOT_FOUND'
      };
    }
    
    if (response.status === 500) {
      return {
        content: 'The AI service is temporarily unavailable. Please try again later.',
        error: true,
        code: 'SERVER_ERROR'
      };
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      ...data,
      error: false
    };
    
  } catch (error) {
    console.error('Cubicler call error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return {
        content: 'Connection to AI service failed. Please check if Cubicler is running.',
        error: true,
        code: 'CONNECTION_REFUSED'
      };
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        content: 'Network error. Please check your connection.',
        error: true,
        code: 'NETWORK_ERROR'
      };
    }
    
    return {
      content: 'An unexpected error occurred. Please try again.',
      error: true,
      code: 'UNKNOWN_ERROR'
    };
  }
};

// Usage with error handling
const handleUserMessage = async (userMessage, userId) => {
  const result = await robustCubiclerCall(userMessage, null, userId);
  
  if (result.error) {
    console.log(`Error (${result.code}):`, result.content);
    // You might want to show different UI based on error type
    switch (result.code) {
      case 'CONNECTION_REFUSED':
        // Show "service unavailable" UI
        break;
      case 'AGENT_NOT_FOUND':
        // Fallback to default agent
        break;
      default:
        // Show generic error message
        break;
    }
  } else {
    console.log('AI Response:', result.content);
    console.log('Metadata:', result.metadata);
  }
  
  return result;
};
```

### Retry Logic with Exponential Backoff

```javascript
const callWithRetry = async (message, agentId = null, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://localhost:1503/dispatch${agentId ? `/${agentId}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            sender: { id: 'user_123' },
            type: 'text',
            content: message
          }]
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // Don't retry for 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      throw new Error(`Server error: ${response.status}`);
      
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

### Request Timeout Handling

```javascript
const callWithTimeout = async (message, agentId = null, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`http://localhost:1503/dispatch${agentId ? `/${agentId}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          sender: { id: 'user_123' },
          type: 'text',
          content: message
        }]
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    
    throw error;
  }
};
```

---

## 🎯 Best Practices

### 1. Message Formatting

- Always include a unique `sender.id` for tracking conversations
- Include `sender.name` when available for better agent context
- Use descriptive user IDs (e.g., `telegram_123`, `discord_456`, `web_user_789`)
- Keep message content concise but provide necessary context

### 2. Error Handling

- Implement proper error handling for network issues
- Use retry logic for transient failures
- Provide meaningful error messages to users
- Log errors for debugging but don't expose internal details

### 3. Performance

- Use specific agent IDs when you know which agent is best for the task
- Implement request timeouts to avoid hanging requests
- Consider caching agent lists if making frequent calls
- Use conversation history efficiently - don't send unnecessary old messages

### 4. Security

- Validate user input before sending to Cubicler
- Don't expose internal error details to end users
- Use proper authentication if exposing Cubicler endpoints publicly
- Consider rate limiting for public-facing applications

---

## 🚀 Ready to Integrate?

1. **Start Simple**: Begin with the basic `/dispatch` endpoint
2. **Add Error Handling**: Implement robust error handling from the start
3. **Test Different Scenarios**: Try various message types and error conditions
4. **Scale Gradually**: Add conversation history and agent selection as needed

---

Made with ❤️ for developers integrating with Cubicler.
