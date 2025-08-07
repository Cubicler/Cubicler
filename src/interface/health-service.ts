import type { HealthStatus } from '../model/types.js';

/**
 * Interface for health check services
 */
export interface HealthServiceProviding {
  /**
   * Get comprehensive health status of all services
   * @returns Health status object with service details
   */
  getHealthStatus(): Promise<HealthStatus>;
}
