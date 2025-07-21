#!/usr/bin/env node

// Example usage of the new GET /provider/:providerName/spec endpoint

import { app } from '../src/index.js';

const port = process.env.CUBICLER_PORT || 1503;

// Set up test environment
process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.yaml';
process.env.PROVIDER_SPEC_CACHE_ENABLED = 'true';
process.env.PROVIDER_SPEC_CACHE_TIMEOUT = '600'; // 10 minutes in seconds
process.env.PROVIDERS_LIST_CACHE_TIMEOUT = '600'; // 10 minutes in seconds

const server = app.listen(port, () => {
  console.log(`🏢 Cubicler server is running on port ${port}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /prompt`);
  console.log(`   GET  /spec`);
  console.log(`   GET  /provider/:providerName/spec  ⬅️  NEW!`);
  console.log(`   POST /call/:function_name`);
  
  console.log(`\n🧪 Try the new provider endpoint:`);
  console.log(`   curl http://localhost:${port}/provider/weather_api/spec`);
  console.log(`   curl http://localhost:${port}/provider/mock_service/spec`);
  
  console.log(`\n🔧 Environment variables in use:`);
  console.log(`   CUBICLER_PROVIDERS_LIST=${process.env.CUBICLER_PROVIDERS_LIST}`);
  console.log(`   PROVIDER_SPEC_CACHE_ENABLED=${process.env.PROVIDER_SPEC_CACHE_ENABLED}`);
  console.log(`   PROVIDER_SPEC_CACHE_TIMEOUT=${process.env.PROVIDER_SPEC_CACHE_TIMEOUT}`);
  console.log(`   PROVIDERS_LIST_CACHE_TIMEOUT=${process.env.PROVIDERS_LIST_CACHE_TIMEOUT}`);
  
  console.log(`\n🧰 New Generic Cache System:`);
  console.log(`   ✅ Extracted caching into reusable Cache utility`);
  console.log(`   ✅ Environment-based cache configuration (in seconds)`);
  console.log(`   ✅ TTL support with custom timeout overrides`);
  console.log(`   ✅ Enable/disable caching dynamically`);
  console.log(`   ✅ 10-minute default for long-lived configurations`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
