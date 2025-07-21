import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { config } from 'dotenv';
import { Cache, createEnvCache } from '../utils/cache.js';
import { convertToFunctionSpecs } from '../utils/definition-helper.js';
import type { 
  ProvidersList,
  Provider,
  ProviderSpecResponse
} from '../model/types.js';
import type { AgentFunctionDefinition } from '../model/definitions.js';
import type { ProviderDefinition } from '../model/definitions.js';

config();

interface CachedProviderSpec {
  context: string;
  functions: AgentFunctionDefinition[];
}

const providersCache: Cache<ProvidersList> = createEnvCache('PROVIDERS_LIST', 600); // 10 minutes default
const specCache: Cache<CachedProviderSpec> = createEnvCache('PROVIDER_SPEC', 600); // 10 minutes default

/**
 * Get provider spec and context for AI agents
 */
async function getProviderSpec(providerName: string): Promise<ProviderSpecResponse> {
  // Check cache first
  const cached = specCache.get(providerName);
  if (cached) {
    return {
      context: cached.context,
      functions: cached.functions
    };
  }

  const provider = await findProvider(providerName);
  
  const [providerDefinition, providerContext] = await Promise.all([
    retrievesProviderDefinition(provider.spec_source),
    retrievesProviderContext(provider.context_source)
  ]);

  // Convert spec to function specs with provider naming convention
  const functions = convertToFunctionSpecs(providerDefinition, providerName);

  // Cache the result
  specCache.set(providerName, {
    context: providerContext,
    functions
  });

  return {
    context: providerContext,
    functions
  };
}

/**
 * Find a provider by name
 */
async function findProvider(providerName: string): Promise<Provider> {
  const availableProviders = await retrieveProvidersList();
  const provider = availableProviders.providers.find((p: Provider) => p.name === providerName);
  
  if (!provider) {
    throw new Error(`Provider '${providerName}' not found in providers list`);
  }
  
  return provider;
}

/**
 * Load providers list from configured source with caching
 */
async function retrieveProvidersList(): Promise<ProvidersList> {
  const cached = providersCache.get('providers_list');
  if (cached) {
    return cached;
  }

  const providersSource = process.env.CUBICLER_PROVIDERS_LIST;
  if (!providersSource) {
    throw new Error('CUBICLER_PROVIDERS_LIST is not defined in environment variables');
  }

  let yamlText: string;
  
  if (providersSource.startsWith('http')) {
    const response = await fetch(providersSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch providers list: ${response.statusText}`);
    }
    yamlText = await response.text();
  } else {
    yamlText = readFileSync(providersSource, 'utf-8');
  }
  
  const providers = load(yamlText) as ProvidersList;
  if (!providers || typeof providers !== 'object') {
    throw new Error('Invalid providers YAML format');
  }

  if (providers.kind !== 'providers') {
    throw new Error('Invalid providers YAML: kind must be "providers"');
  }
  
  // Cache the result
  providersCache.set('providers_list', providers);
  
  return providers;
}

/**
 * Load and parse a provider's spec from URL
 */
async function retrievesProviderDefinition(specUrl: string): Promise<ProviderDefinition> {
  let yamlText: string;
  
  if (specUrl.startsWith('http')) {
    const response = await fetch(specUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch provider spec: ${response.statusText}`);
    }
    yamlText = await response.text();
  } else {
    yamlText = readFileSync(specUrl, 'utf-8');
  }
  
  const spec = load(yamlText) as ProviderDefinition;
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid provider spec YAML format');
  }
  
  return spec;
}

/**
 * Load provider context from URL
 */
async function retrievesProviderContext(contextUrl: string): Promise<string> {
  if (contextUrl.startsWith('http')) {
    const response = await fetch(contextUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch provider context: ${response.statusText}`);
    }
    return await response.text();
  } else {
    return readFileSync(contextUrl, 'utf-8');
  }
}

/**
 * Clear all caches
 */
function clearCache(): void {
  providersCache.clear();
  specCache.clear();
}

/**
 * Get list of available providers
 */
async function getProviders(): Promise<Provider[]> {
  const providers = await retrieveProvidersList();
  return providers.providers;
}

export default { 
  getProviderSpec, 
  clearCache, 
  getProviders 
};
