// Quick test for environment variable substitution

// Set a test environment variable
process.env.TEST_API_KEY = 'test-secret-key';

// Simple direct test
function substituteEnvVars(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{env\.(\w+)\}\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
}

// Test string substitution
const testString = "Bearer {{env.TEST_API_KEY}}";
console.log('Original:', testString);
console.log('Substituted:', substituteEnvVars(testString));

const testStringMissing = "Bearer {{env.MISSING_KEY}}";
console.log('Missing env var:', testStringMissing);
console.log('Substituted missing:', substituteEnvVars(testStringMissing));
