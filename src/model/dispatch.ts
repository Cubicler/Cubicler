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
  type: 'text' | 'image' | 'url' | 'null'; // text content, image data, url reference, or null for no content
  content: string | null; // text content, image base64, or url string
  metadata?: MessageMetadata; // metadata for images and files
}

/**
 * Metadata for image and file content in messages
 */
export interface MessageMetadata {
  fileName?: string; // optional file name for images/files
  fileSize?: number; // optional file size in bytes
  fileExtension?: string; // optional file extension (e.g., 'jpg', 'png', 'pdf')
  format: 'base64' | 'url'; // base64 encoded data or URL reference
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
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OpenAI schema can have complex nested structures
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
  type: 'text' | 'image' | 'null';
  content: string | null; // text content or image base64
  contentMetadata?: MessageMetadata; // optional metadata for images
  metadata: {
    usedToken?: number; // Optional since some agents might not track tokens
    usedTools?: number; // Optional since some agents might not track tools
  };
} /**
 * Response format for dispatch endpoints
 */
export interface DispatchResponse {
  sender: MessageSender;
  timestamp: string;
  type: 'text' | 'image' | 'null'; // null when agent provides no response
  content: string | null; // null when agent provides no response, or image base64
  contentMetadata?: MessageMetadata; // optional metadata for images
  metadata: {
    usedToken?: number; // Optional since some agents might not track tokens
    usedTools?: number; // Optional since some agents might not track tools
  };
}
