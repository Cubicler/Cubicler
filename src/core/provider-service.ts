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
 * Fetch providers list from URL source
 * @param providersSource - URL to fetch providers list from
 * @returns Parsed ProvidersList object
 * @throws Error if unable to fetch providers from URL
 */
async function fetchProvidersFromUrl(providersSource: string): Promise<ProvidersList> {
  const errors: string[] = [];

  try {
    const response = await fetch(providersSource);
    if (response.ok) {
      const yamlText = await response.text();
      const providers = load(yamlText) as ProvidersList;
      
      if (!providers || typeof providers !== 'object') {
        throw new Error('Invalid providers YAML format');
      }

      if (providers.kind !== 'providers') {
        throw new Error('Invalid providers YAML: kind must be "providers"');
      }
      
      return providers;
    }
    errors.push(`Fetch failed: ${response.status} ${response.statusText}`);
  } catch (error) {
    errors.push(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch providers from URL '${providersSource}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch providers list from local file source
 * @param providersSource - Local path to fetch providers list from
 * @returns Parsed ProvidersList object
 * @throws Error if unable to fetch providers from local path
 */
function fetchProvidersFromFile(providersSource: string): ProvidersList {
  const errors: string[] = [];

  try {
    const yamlText = readFileSync(providersSource, 'utf-8');
    const providers = load(yamlText) as ProvidersList;
    
    if (!providers || typeof providers !== 'object') {
      throw new Error('Invalid providers YAML format');
    }

    if (providers.kind !== 'providers') {
      throw new Error('Invalid providers YAML: kind must be "providers"');
    }
    
    return providers;
  } catch (error) {
    errors.push(`File read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch providers from path '${providersSource}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch provider definition from URL source
 * @param specUrl - URL to fetch spec from
 * @returns Parsed ProviderDefinition object
 * @throws Error if unable to fetch spec from URL
 */
async function fetchProviderDefinitionFromUrl(specUrl: string): Promise<ProviderDefinition> {
  const errors: string[] = [];

  try {
    const response = await fetch(specUrl);
    if (response.ok) {
      const yamlText = await response.text();
      const spec = load(yamlText) as ProviderDefinition;
      
      if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid provider spec YAML format');
      }
      
      return spec;
    }
    errors.push(`Spec fetch failed: ${response.status} ${response.statusText}`);
  } catch (error) {
    errors.push(`Spec fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch provider spec from URL '${specUrl}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch provider definition from local file source
 * @param specUrl - Local path to fetch spec from
 * @returns Parsed ProviderDefinition object
 * @throws Error if unable to fetch spec from local path
 */
function fetchProviderDefinitionFromFile(specUrl: string): ProviderDefinition {
  const errors: string[] = [];

  try {
    const yamlText = readFileSync(specUrl, 'utf-8');
    const spec = load(yamlText) as ProviderDefinition;
    
    if (!spec || typeof spec !== 'object') {
      throw new Error('Invalid provider spec YAML format');
    }
    
    return spec;
  } catch (error) {
    errors.push(`File read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch provider spec from path '${specUrl}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch provider context from URL source
 * @param contextUrl - URL to fetch context from
 * @returns Context text content
 * @throws Error if unable to fetch context from URL
 */
async function fetchProviderContextFromUrl(contextUrl: string): Promise<string> {
  const errors: string[] = [];

  try {
    const response = await fetch(contextUrl);
    if (response.ok) {
      return await response.text();
    }
    errors.push(`Context fetch failed: ${response.status} ${response.statusText}`);
  } catch (error) {
    errors.push(`Context fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch provider context from URL '${contextUrl}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch provider context from local file source
 * @param contextUrl - Local path to fetch context from
 * @returns Context text content
 * @throws Error if unable to fetch context from local path
 */
function fetchProviderContextFromFile(contextUrl: string): string {
  const errors: string[] = [];

  try {
    return readFileSync(contextUrl, 'utf-8');
  } catch (error) {
    errors.push(`File read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  throw new Error(`Cannot fetch provider context from path '${contextUrl}'. Errors: ${errors.join('; ')}`);
}

/**
 * Fetch and parse providers list from configured source (no caching)
 * @returns Complete ProvidersList object
 * @throws Error if environment variable is missing or if fetch fails
 */
async function fetchProvidersList(): Promise<ProvidersList> {
  const providersSource = process.env.CUBICLER_PROVIDERS_LIST;
  if (!providersSource) {
    throw new Error('CUBICLER_PROVIDERS_LIST is not defined in environment variables');
  }

  if (providersSource.startsWith('http')) {
    return await fetchProvidersFromUrl(providersSource);
  } else {
    return fetchProvidersFromFile(providersSource);
  }
}

/**
 * Load providers list from configured source with caching
 */
async function retrieveProvidersList(): Promise<ProvidersList> {
  const cached = providersCache.get('providers_list');
  if (cached) {
    return cached;
  }

  const providers = await fetchProvidersList();
  
  // Cache the result
  providersCache.set('providers_list', providers);
  
  return providers;
}

/**
 * Load and parse a provider's spec from URL or file
 * @param specUrl - URL or path to fetch spec from
 * @returns Parsed ProviderDefinition object
 * @throws Error if fetch fails
 */
async function retrievesProviderDefinition(specUrl: string): Promise<ProviderDefinition> {
  if (specUrl.startsWith('http')) {
    return await fetchProviderDefinitionFromUrl(specUrl);
  } else {
    return fetchProviderDefinitionFromFile(specUrl);
  }
}

/**
 * Load provider context from URL or file
 * @param contextUrl - URL or path to fetch context from
 * @returns Context text content
 * @throws Error if fetch fails
 */
async function retrievesProviderContext(contextUrl: string): Promise<string> {
  if (contextUrl.startsWith('http')) {
    return await fetchProviderContextFromUrl(contextUrl);
  } else {
    return fetchProviderContextFromFile(contextUrl);
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
 * @returns Array of Provider objects
 * @throws Error if no providers are available
 */
async function getProviders(): Promise<Provider[]> {
  const providers = await retrieveProvidersList();
  
  if (!providers.providers || providers.providers.length === 0) {
    throw new Error('No providers defined in configuration');
  }
  
  return providers.providers;
}

/**
 * Fetch providers list from configured source (no caching)
 * @returns Array of Provider objects
 * @throws Error if fetch fails or no providers are available
 */
async function fetchProviders(): Promise<Provider[]> {
  const providers = await fetchProvidersList();

  if (!providers.providers || providers.providers.length === 0) {
    throw new Error('No providers defined in configuration');
  }

  return providers.providers;
}

export default { 
  getProviderSpec, 
  clearCache, 
  getProviders,
  fetchProviders
};
