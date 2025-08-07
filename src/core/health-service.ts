import type { HealthStatus } from '../model/types.js';
import type { HealthServiceProviding } from '../interface/health-service.js';
import type { AgentsProviding } from '../interface/agents-providing.js';
import type { ServersProviding } from '../interface/servers-providing.js';

class HealthService implements HealthServiceProviding {
  constructor(
    // eslint-disable-next-line no-unused-vars
    private agentsProvider: AgentsProviding,
    // eslint-disable-next-line no-unused-vars
    private serversProvider: ServersProviding
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    console.log(`🏥 [HealthService] Health check requested`);

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Check agents service
    try {
      const agentsInfo = await this.agentsProvider.getAllAgents();
      health.services.agents = {
        status: 'healthy',
        count: agentsInfo.length,
        agents: agentsInfo.map((a) => a.identifier),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      health.services.agents = { status: 'unhealthy', error: errorMessage };
      health.status = 'unhealthy';
    }

    // Check providers service
    try {
      const servers = await this.serversProvider.getAvailableServers();
      health.services.providers = {
        status: 'healthy',
        count: servers.total,
        servers: servers.servers.map((s) => s.identifier),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      health.services.providers = { status: 'unhealthy', error: errorMessage };
      health.status = 'unhealthy';
    }

    // MCP service status (basic check)
    health.services.mcp = { status: 'healthy' };

    return health;
  }
}

export { HealthService };
export default new HealthService(
  await import('./agent-service.js').then((m) => m.default),
  await import('./provider-service.js').then((m) => m.default)
);
