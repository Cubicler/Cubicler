# 🖥️ Frontend Integration Guide

> *How to integrate your frontend application with Cubicler*

This guide shows you how to connect your frontend applications (Telegram bots, Slack apps, web chat interfaces, etc.) to Cubicler to leverage AI agents with external service capabilities.

---

## 🚀 Quick Start

### Basic Integration

```javascript
// Example: Simple chat interface integration
const response = await fetch('http://localhost:1503/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      { sender: 'user', content: 'What is the weather in Paris?' }
    ]
  })
});

const result = await response.json();
console.log(result.response); // AI agent's response
```

---

## 📘 API Reference

### Core Endpoints for Frontend Integration

| Endpoint | Method | Purpose | Required |
|----------|---------|---------|-----------|
| `/call` | POST | Call default AI agent | ✅ |
| `/call/:agent` | POST | Call specific AI agent | ✅ |
| `/agents` | GET | List available agents | Optional |
| `/health` | GET | Check system status | Optional |

---

## 🔧 Detailed Integration

### 1. Calling the Default Agent

**Endpoint:** `POST /call`

**Request Format:**

```json
{
  "messages": [
    {
      // previous message for context.
      "sender": "user", // or agent name if its message from the agent: eg, gpt-4o, claude-3.7, etc
      "content": "Your previous message here"
    },
    {
      "sender": "user",
      "content": "Your user's message here"
    }
  ]
}
```

**Response Format:**

```json
{
  "message": "AI agent's response to the user"
}
```

**Example:**

```javascript
const callDefaultAgent = async (userMessage) => {
  try {
    const response = await fetch('http://localhost:1503/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { sender: 'user', content: userMessage }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error('Error calling Cubicler:', error);
    return 'Sorry, I encountered an error while processing your request.';
  }
};
```

### 2. Calling a Specific Agent

**Endpoint:** `POST /call/:agent`

**When to use:** When you want to route to a specific AI agent (e.g., "customer_support", "data_analyst", "weather_bot")

**Example:**

```javascript
const callSpecificAgent = async (agentName, userMessage) => {
  const response = await fetch(`http://localhost:1503/call/${agentName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { sender: 'user', content: userMessage }
      ]
    })
  });
  
  return await response.json();
};

// Usage
const weatherResponse = await callSpecificAgent('weather_bot', 'Weather in Tokyo?');
const supportResponse = await callSpecificAgent('customer_support', 'I need help with my account');
```

### 3. Multi-turn Conversations

For chat applications that need to maintain conversation context:

```javascript
class CubiclerChat {
  constructor(baseUrl = 'http://localhost:1503') {
    this.baseUrl = baseUrl;
    this.conversationHistory = [];
  }
  
  async sendMessage(userMessage, agent = null) {
    // Add user message to history
    this.conversationHistory.push({
      sender: 'user',
      content: userMessage
    });
    
    const endpoint = agent ? `/call/${agent}` : '/call';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory
        })
      });
      
      const result = await response.json();
      
      // Add agent response to history
      this.conversationHistory.push({
        sender: 'assistant',
        content: result.response
      });
      
      return result.response;
    } catch (error) {
      console.error('Chat error:', error);
      return 'Sorry, I encountered an error.';
    }
  }
  
  clearHistory() {
    this.conversationHistory = [];
  }
}

// Usage
const chat = new CubiclerChat();
const response1 = await chat.sendMessage('What is the weather in Paris?');
const response2 = await chat.sendMessage('What about London?'); // Maintains context
```

---

## 🤖 Platform-Specific Examples

### Telegram Bot Integration

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chat = new CubiclerChat('http://localhost:1503');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;
  
  try {
    const response = await chat.sendMessage(userMessage);
    bot.sendMessage(chatId, response);
  } catch (error) {
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

const chat = new CubiclerChat('http://localhost:1503');

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  try {
    const response = await chat.sendMessage(message.content);
    message.reply(response);
  } catch (error) {
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

const chat = new CubiclerChat('http://localhost:1503');

app.post('/api/chat', async (req, res) => {
  try {
    const { message, agent } = req.body;
    const response = await chat.sendMessage(message, agent);
    
    res.json({ 
      success: true, 
      response 
    });
  } catch (error) {
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
    return data.availableAgents; // array of strings
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
};

// Usage
const agents = await getAvailableAgents();
console.log('Available agents:', agents);
```

### Health Check

```javascript
const checkCubiclerHealth = async () => {
  try {
    const response = await fetch('http://localhost:1503/health');
    const health = await response.json();
    return health.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

// Usage
if (await checkCubiclerHealth()) {
  console.log('Cubicler is healthy');
} else {
  console.log('Cubicler is not responding');
}
```

---

## 🔒 Error Handling

### Common Error Scenarios

```javascript
const robustCubiclerCall = async (message, agent = null) => {
  const endpoint = agent ? `/call/${agent}` : '/call';
  
  try {
    const response = await fetch(`http://localhost:1503${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ sender: 'user', content: message }]
      })
    });
    
    if (response.status === 404) {
      return 'The requested agent is not available.';
    }
    
    if (response.status === 500) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return 'Connection to AI service failed. Please check if Cubicler is running.';
    }
    
    console.error('Unexpected error:', error);
    return 'An unexpected error occurred. Please try again.';
  }
};
```

---

Made with ❤️ for frontend developers integrating with Cubicler.
