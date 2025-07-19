// Utility functions for environment variable substitution

// Helper function to substitute environment variables in strings
function substituteEnvVars(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{env\.(\w+)\}\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
}

// Helper function to substitute environment variables in an object
function substituteEnvVarsInObject(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = substituteEnvVars(value);
  }
  return result;
}

export { substituteEnvVars, substituteEnvVarsInObject };
