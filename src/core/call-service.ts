import axios from 'axios';
import promptService from './prompt-service.js';
import providerService from './provider-service.js';
import agentService from './agent-service.js';
import { fetchWithAgentTimeout } from '../utils/fetch-helper.js';
import type { Agent, AgentRequest, CallRequest, CallResponse } from '../model/types.js';

/**
 * Call an AI agent with the provided messages
 * @param agentName - Name of the agent to call (optional, uses first available if not provided)
 * @param request - The call request containing messages
 * @returns Promise that resolves to the agent's response
 * @throws Error if agent is not found or call fails
 */
async function callAgent(
  agentName: string | undefined,
  request: CallRequest
): Promise<CallResponse> {
  console.log(`🤖 [CallService] Calling agent: ${agentName || 'default'} with ${request.messages.length} messages`);
  
  const agents = await agentService.getAgents();

  let selectedAgent: Agent;
  if (agentName) {
    // Find specific agent
    console.log(`🔍 [CallService] Looking for specific agent: ${agentName}`);
    const foundAgent = agents.agents.find((agent) => agent.name === agentName);
    if (!foundAgent) {
      console.error(`❌ [CallService] Agent '${agentName}' not found. Available agents: ${agents.agents.map(a => a.name).join(', ')}`);
      throw new Error(`Agent '${agentName}' not found`);
    }
    selectedAgent = foundAgent;
    console.log(`✅ [CallService] Found agent: ${agentName}`);
  } else {
    // Use first available agent as default
    if (!agents.agents || agents.agents.length === 0) {
      console.error(`❌ [CallService] No agents available`);
      throw new Error('No agents available');
    }
    const firstAgent = agents.agents[0];
    if (!firstAgent) {
      console.error(`❌ [CallService] No agents available`);
      throw new Error('No agents available');
    }
    selectedAgent = firstAgent;
    console.log(`✅ [CallService] Using default agent: ${selectedAgent.name}`);
  }

  console.log(`📝 [CallService] Getting prompt for agent: ${selectedAgent.name}`);
  const prompt = await promptService.getPrompt(selectedAgent.name);

  console.log(`🏢 [CallService] Getting provider information`);
  const providers = await providerService.getProviders();
  const providerInfo = providers.map((provider) => ({
    name: provider.name,
    description: provider.description,
  }));
  console.log(`✅ [CallService] Found ${providerInfo.length} providers: ${providerInfo.map(p => p.name).join(', ')}`);

  // Prepare request for the agent
  const agentRequest: AgentRequest = {
    prompt,
    providers: providerInfo,
    messages: request.messages,
  };

  // Call the agent
  console.log(`🚀 [CallService] Calling agent endpoint: ${selectedAgent.endpoints}/call`);
  try {
    const response = await fetchWithAgentTimeout(`${selectedAgent.endpoints}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: agentRequest,
    });

    if (response.status < 200 || response.status >= 300) {
      console.error(`❌ [CallService] Agent call failed: ${response.status} ${response.statusText}`);
      throw new Error(`Agent call failed: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ [CallService] Agent call successful`);
    const result = response.data;

    if (!result.message || typeof result.message !== 'string') {
      console.error(`❌ [CallService] Invalid agent response format: missing or invalid message field`);
      throw new Error('Invalid agent response format: missing or invalid message field');
    }

    console.log(`✅ [CallService] Agent response received (${result.message.length} characters)`);
    return {
      message: result.message,
    };
  } catch (error) {
    console.error(`❌ [CallService] Agent call error:`, error instanceof Error ? error.message : 'Unknown error');
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const statusText = error.response?.statusText || 'Unknown error';
      throw new Error(`Agent call failed: ${status} ${statusText}`);
    }
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new Error(`Agent call timed out after 90 seconds`);
      }
      throw error;
    }
    throw new Error('Unknown error occurred during agent call');
  }
}

export default {
  callAgent,
};
