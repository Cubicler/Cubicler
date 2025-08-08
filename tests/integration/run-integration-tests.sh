#!/bin/bash

# Integration Tests Runner
# This script runs the integration tests with proper environment setup

echo "🧪 Running Cubicler Integration Tests"
echo "======================================"

# Change to the integration test directory to ensure .env is loaded correctly
cd "$(dirname "$0")" || exit 1

# Check if required environment variables are set
if [ ! -f ".env" ]; then
    echo "❌ Missing .env file in tests/integration/"
    echo "Please ensure .env exists with OPENAI_API_KEY and OPENWEATHER_API_KEY"
    exit 1
fi

# Source the environment variables
export $(grep -v '^#' .env | xargs)

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Missing OPENAI_API_KEY in .env file"
    exit 1
fi

if [ -z "$OPENWEATHER_API_KEY" ]; then
    echo "❌ Missing OPENWEATHER_API_KEY in .env file"
    exit 1
fi

echo "✅ Environment variables loaded"

# Go back to root directory for npm commands
cd ../..

echo "📡 Running Dispatch Integration Tests..."
npm test -- tests/integration/dispatch-integration.test.ts --run

echo ""
echo "📡 Running SSE Integration Tests..."
npm test -- tests/integration/sse-integration.test.ts --run

echo ""
echo "🔗 Running MCP SSE Integration Tests..."
npm test -- tests/integration/mcp-sse-integration.test.ts --run

echo ""
echo "🔗 Running MCP HTTP Integration Tests..."
npm test -- tests/integration/mcp-http-integration.test.ts --run

echo ""
echo "🔗 Running Webhook Integration Tests..."
npm test -- tests/integration/webhook-integration.test.ts --run

echo ""
echo "📟 Running Stdio Agent Integration Tests..."
npm test -- tests/integration/stdio-integration.test.ts --run

echo ""
echo "✅ All integration tests completed!"
