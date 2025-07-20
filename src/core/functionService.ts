import specService from './specService.js';
import { 
  validateAndConvertParameters, 
  validateAndConvertPayload, 
  convertParametersForQuery 
} from '../utils/parameterHelper.js';
import type { FunctionCallParameters, FunctionCallResult } from '../utils/types.js';

/**
 * Executes a function call by routing to the appropriate service endpoint
 * @param functionName - The name of the function to call
 * @param parameters - The parameters to pass to the function
 * @returns Promise that resolves to the function call result
 * @throws Error if function is not found or call fails
 */
async function callFunction(
  functionName: string, 
  parameters: FunctionCallParameters
): Promise<FunctionCallResult> {
  const functionSpec = await specService.getFunction(functionName);
  const endpointSpec = await specService.getEndpoint(functionSpec);

  const overrideParameters = await specService.getOverrideParameters(functionName);
  const overridePayload = await specService.getOverridePayload(functionName);
  
  let url = `${endpointSpec.base_url}${endpointSpec.path}`;
  
  const { payload, ...urlParameters } = parameters;
  
  // Validate and convert URL parameters
  const validatedUrlParameters = validateAndConvertParameters(urlParameters, endpointSpec.parameters);
  const validatedOverrideParameters = validateAndConvertParameters(overrideParameters, endpointSpec.parameters);
  
  // Merge URL parameters with overrides (overrides take precedence)
  const allUrlParameters = { ...validatedUrlParameters, ...validatedOverrideParameters };
  
  // Handle payload
  let finalPayload = payload;
  if (endpointSpec.payload) {
    // Validate payload if it exists
    if (payload !== undefined) {
      finalPayload = validateAndConvertPayload(payload, endpointSpec.payload);
    }
    
    // Apply override payload (merge with user payload, overrides take precedence)
    if (overridePayload !== undefined) {
      if (endpointSpec.payload.type === 'object' && typeof finalPayload === 'object' && finalPayload !== null) {
        finalPayload = { ...finalPayload, ...overridePayload };
      } else {
        finalPayload = overridePayload;
      }
    }
  }
  
  // Replace path parameters
  const pathParams: string[] = [];
  url = url.replace(/{(\w+)}/g, (match: string, paramName: string) => {
    if (allUrlParameters[paramName] !== undefined) {
      pathParams.push(paramName);
      return String(allUrlParameters[paramName]);
    }
    return match;
  });
  
  // Remaining parameters (not used in path) go to query params
  const queryParameters = { ...allUrlParameters };
  pathParams.forEach(param => delete queryParameters[param]);

  const method = endpointSpec.method;

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...endpointSpec.headers,
    },
  };

  // Handle query parameters for URL
  if (Object.keys(queryParameters).length > 0) {
    const queryParams = convertParametersForQuery(queryParameters);
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  }

  // Handle payload for request body
  if (finalPayload !== undefined && finalPayload !== null) {
    requestOptions.body = JSON.stringify(finalPayload);
  }

  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    throw new Error(`Failed to call function: ${response.statusText}`);
  }

  return await response.json() as FunctionCallResult;
}

export default { callFunction };
