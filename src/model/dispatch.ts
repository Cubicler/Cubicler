/**
 * Sender information for messages
 */
export interface MessageSender {
  id: string;
  name?: string; // optional
}

/**
 * Message structure for dispatch requests and responses
 */
export interface Message {
  sender: MessageSender;
  timestamp?: string; // ISO 8601, optional
  type: 'text' | 'null'; // text (image/video support planned), null for no content
  content: string | null;
}

/**
 * Request body for POST /dispatch[/:agentId] endpoint
 */
export interface DispatchRequest {
  messages: Message[];
}

/**
 * Tool definition for agent context (OpenAI function schema format)
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>; // OpenAI schema can have complex nested structures
    required?: string[];
  };
}

/**
 * Request sent to agents for processing
 */
export interface AgentRequest {
  agent: {
    identifier: string;
    name: string;
    description: string;
    prompt: string;
  };
  tools: AgentTool[];
  servers: Array<{
    identifier: string;
    name: string;
    description: string;
  }>;
  messages: Message[];
}

/**
 * Response expected from agents
 */
export interface AgentResponse {
  timestamp: string;
  type: 'text' | 'null';
  content: string | null;
  metadata: {
    usedToken?: number;  // Optional since some agents might not track tokens
    usedTools?: number;  // Optional since some agents might not track tools
  };
}/**
 * Response format for dispatch endpoints
 */
export interface DispatchResponse {
  sender: MessageSender;
  timestamp: string;
  type: 'text' | 'null'; // null when agent provides no response
  content: string | null; // null when agent provides no response
  metadata: {
    usedToken?: number;  // Optional since some agents might not track tokens
    usedTools?: number;  // Optional since some agents might not track tools
  };
}
