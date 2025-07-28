// Quick test to verify the technical section generation
import { AgentService } from './dist/index.js';

// Mock ServersProviding implementation
const mockServersProvider = {
  async getAvailableServers() {
    return {
      total: 2,
      servers: [
        {
          identifier: 'weather_service',
          name: 'Weather Service',
          description: 'Provides weather information via MCP',
          toolsCount: 3
        },
        {
          identifier: 'legacy_api', 
          name: 'Legacy API',
          description: 'Legacy REST API without MCP',
          toolsCount: 5
        }
      ]
    };
  },
  async getServerTools(serverIdentifier) {
    return { tools: [] };
  }
};

// Test the agent service with the mock
const agentService = new AgentService(mockServersProvider);

// Mock loadAgents method for this test
agentService.loadAgents = async () => ({
  basePrompt: 'You are a helpful AI assistant.',
  agents: [{
    identifier: 'test_agent',
    name: 'Test Agent',
    transport: 'http',
    url: 'http://localhost:3000',
    description: 'Test agent'
  }]
});

// Test the prompt generation
async function testTechnicalSection() {
  try {
    const prompt = await agentService.getAgentPrompt();
    console.log('Generated prompt:');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error:', error);
  }
}

testTechnicalSection();
