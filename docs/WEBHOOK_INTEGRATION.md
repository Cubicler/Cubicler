# Webhook Integration for Cubicler

## Overview

Cubicler supports webhook endpoints that allow external systems to trigger AI agents automatically. Webhooks complement the existing dispatch API by enabling event-driven agent interactions from calendar systems, monitoring tools, notifications, and other external triggers.

## Architecture

### Endpoint Pattern

```
POST /webhook/:identifier/:agentId
```

Examples:

- `POST /webhook/calendar-events/openai-gpt`
- `POST /webhook/monitoring/alert-agent`
- `POST /webhook/notifications/scheduler-agent`

### Configuration

Webhooks are configured in `webhooks.json`:

```json
{
  "webhooks": [
    {
      "identifier": "calendar-events",
      "name": "Calendar Events", 
      "description": "Calendar event notifications and reminders from external calendar systems",
      "config": {
        "authentication": {
          "type": "signature",
          "secret": "cal_webhook_secret"
        },
        "allowedOrigins": ["calendar.company.com"]
      },
      "agents": ["openai-gpt", "scheduler-agent"],
      "payload_transform": [
        {
          "path": "event.start_time", 
          "transform": "date_format",
          "format": "YYYY-MM-DD HH:mm:ss"
        },
        {
          "path": "event.priority",
          "transform": "map",
          "map": {
            "1": "Low",
            "2": "Medium", 
            "3": "High",
            "4": "Urgent"
          }
        },
        {
          "path": "event.description",
          "transform": "template",
          "template": "Event: {value}"
        },
        {
          "path": "internal_data",
          "transform": "remove"
        }
      ]
    },
    {
      "identifier": "monitoring",
      "name": "System Monitoring",
      "description": "System alerts and monitoring notifications from infrastructure monitoring tools",
      "config": {
        "authentication": {
          "type": "bearer",
          "token": "monitoring_token"
        }
      },
      "agents": ["alert-agent"],
      "payload_transform": [
        {
          "path": "alert.severity",
          "transform": "map", 
          "map": {
            "0": "Info",
            "1": "Warning",
            "2": "Critical",
            "3": "Emergency"
          }
        },
        {
          "path": "alert.timestamp",
          "transform": "date_format",
          "format": "MMM DD, YYYY HH:mm:ss"
        }
      ]
    }
  ]
}
```

## Agent Request Structure

### Dispatch vs Webhook Calls

**Dispatch Call (User Interaction):**

```typescript
interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string;
  };
  tools: AgentTool[];
  servers: AgentServerInfo[];
  messages: Message[]; // Present for dispatch calls
}
```

**Webhook Call (Automated Trigger):**

```typescript
interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string; // Enhanced with webhook context
  };
  tools: AgentTool[];
  servers: AgentServerInfo[];
  trigger: {           // Present for webhook calls
    type: 'webhook';
    identifier: string; // "calendar-events"
    name: string;       // "Calendar Events"
    description: string; // "Calendar event notifications..."
    triggeredAt: string; // ISO timestamp
    payload: any;       // Transformed webhook data
  };
}
```

## Agent Implementation

Agents can differentiate between dispatch and webhook calls:

```typescript
function handleRequest(request: AgentRequest) {
  if (request.messages) {
    // Handle user conversation
    console.log('Processing user messages:', request.messages.length);
    // Normal conversational flow
  } 
  else if (request.trigger) {
    // Handle webhook trigger
    console.log(`Webhook triggered: ${request.trigger.name} at ${request.trigger.triggeredAt}`);
    console.log('Webhook payload:', request.trigger.payload);
    
    // Process automated trigger
    // Agent knows this is not a conversation but an event response
  }
}
```

## Payload Transformation

Webhooks support the same powerful transformation engine used by REST endpoints:

### Available Transformations

- **`map`**: Transform values using key-value mapping
- **`template`**: Format values using templates with `{value}` placeholder
- **`date_format`**: Format dates using moment.js format strings
- **`regex_replace`**: Replace text using regex patterns
- **`remove`**: Remove fields from the payload

### Path Syntax

- **Simple paths**: `"event.title"`
- **Array elements**: `"users[].status"`
- **Root arrays**: `"_root[].field"`

### Transformation Example

**Raw Webhook Payload:**

```json
{
  "event": {
    "title": "Team Meeting",
    "start_time": "2025-08-07T14:00:00Z",
    "priority": "3",
    "description": "Weekly sync meeting"
  },
  "internal_data": {"webhook_id": "123"}
}
```

**After Transformation:**

```json
{
  "event": {
    "title": "Team Meeting", 
    "start_time": "2025-08-07 14:00:00",
    "priority": "High",
    "description": "Event: Weekly sync meeting"
  }
}
```

## Security

### Authentication Types

1. **Signature Validation**:

   ```json
   {
     "type": "signature",
     "secret": "your_webhook_secret"
   }
   ```

2. **Bearer Token**:

   ```json
   {
     "type": "bearer", 
     "token": "your_bearer_token"
   }
   ```

3. **No Authentication**:

   ```json
   {}
   ```

### Agent Authorization

Only agents listed in the `agents` array can receive webhook calls:

```json
{
  "identifier": "calendar-events",
  "agents": ["openai-gpt", "scheduler-agent"]
}
```

Calling `/webhook/calendar-events/unauthorized-agent` will return a 403 Forbidden error.

## Use Cases

### Calendar Integration

- **Webhook**: Calendar system sends meeting reminders
- **Agent**: Processes event details and suggests preparations
- **Benefit**: Proactive meeting assistance

### System Monitoring  

- **Webhook**: Monitoring tools send alerts
- **Agent**: Analyzes severity and suggests actions
- **Benefit**: Intelligent alert triage

### IoT Events

- **Webhook**: IoT devices send sensor data
- **Agent**: Processes readings and triggers automations
- **Benefit**: Smart environment control

### CI/CD Integration

- **Webhook**: Build systems send deployment status
- **Agent**: Analyzes failures and suggests fixes
- **Benefit**: Intelligent DevOps assistance

## Implementation Flow

1. **Webhook Registration**: Configure webhook in `webhooks.json`
2. **External System**: Sends POST request to webhook endpoint
3. **Authentication**: Cubicler validates webhook signature/token
4. **Agent Validation**: Confirms agent is authorized for this webhook
5. **Payload Transform**: Applies configured transformations
6. **Agent Dispatch**: Calls agent with webhook trigger context
7. **Response**: Returns agent response to webhook caller

## Benefits

- **Event-Driven AI**: Agents respond to real-world events automatically
- **Flexible Configuration**: No code changes needed for new webhooks
- **Powerful Transformations**: Clean, normalized data for agents
- **Security**: Multiple authentication methods and agent authorization
- **Reuse Existing Logic**: Leverages existing dispatch and tool infrastructure
- **Clear Context**: Agents know they're handling automated triggers vs user conversations

## Environment Configuration

Set webhook configuration source:

```bash
export CUBICLER_WEBHOOKS_LIST="./webhooks.json"
# or
export CUBICLER_WEBHOOKS_LIST="https://config.company.com/webhooks.json"
```
