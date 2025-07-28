import type { ProvidersConfig } from '../cubicler';

/**
 * Protocol for providing provider configuration
 */

export interface ProvidersConfigProviding {
  /**
   * Load providers configuration from source (file or URL)
   */
  getProvidersConfig(): Promise<ProvidersConfig>;
}
