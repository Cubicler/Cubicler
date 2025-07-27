# Multi-stage Dockerfile for Cubicler

# Base stage
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
RUN npm ci
COPY src/ ./src/
# Copy example files for development/testing only
COPY spec.example.yaml ./
COPY prompt.example.md ./
EXPOSE 1503
# For development, build and start - better for TypeScript
CMD ["sh", "-c", "npm run build && npm start"]

# Build stage
FROM base AS build
RUN npm ci
COPY src/ ./src/
COPY tsup.config.ts ./
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts
COPY --from=build /app/dist/ ./dist/

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cubicler -u 1001 && \
    chown -R cubicler:nodejs /app

USER cubicler

# Expose the default port (1503) - actual port is configurable via CUBICLER_PORT env var
# Note: Docker EXPOSE doesn't support env vars, so this documents the default port
# For custom ports, update your docker-compose.yml or docker run port mappings accordingly
EXPOSE 1503

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request('http://localhost:' + (process.env.CUBICLER_PORT || 1503) + '/health', res => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["npm", "start"]
