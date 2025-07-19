// Service to handle function calls

import specService from './specService.js';

async function callFunction(functionName, parameters) {
  const functionSpec = await specService.getFunction(functionName);
  const endpointSpec = await specService.getEndpoint(functionSpec);

  const overrideValues = await specService.getOverrideParameters(functionName);
  
  let url = `${endpointSpec.base_url}${endpointSpec.path}`;
  
  // Merge parameters with overrides (overrides take precedence)
  const allParameters = { ...parameters, ...overrideValues };
  
  // Replace path parameters
  const pathParams = [];
  url = url.replace(/{(\w+)}/g, (match, paramName) => {
    pathParams.push(paramName);
    return allParameters[paramName] || match;
  });
  
  // Remaining parameters (not used in path) go to query/body
  const queryParameters = { ...allParameters };
  pathParams.forEach(param => delete queryParameters[param]);

  const method = endpointSpec.method;

  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...endpointSpec.headers, // Already processed by specService
    },
  };

  // Handle GET vs POST
  if (method === 'GET') {
    const queryParams = new URLSearchParams(queryParameters).toString();
    if (queryParams) {
      url = `${url}?${queryParams}`;
    }
  } else {
    requestOptions.body = JSON.stringify(queryParameters);
  }

  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    throw new Error(`Failed to call function: ${response.statusText}`);
  }

  return await response.json();
}

export default { callFunction };
