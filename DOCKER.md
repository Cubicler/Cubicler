# 🐳 Docker Setup for Cubicler

This document explains how to run Cubicler using Docker.

---

## 🚀 Quick Start

### 🧪 Test with Example Files

Use the provided example files to test Cubicler quickly:

```bash
npm run docker:example
```

This runs Cubicler using `providers.example.json` and `agents.example.json`.

---

## 📦 Production Deployment (Recommended)

### 1. Choose Configuration Method

**Option A: Remote URLs (Recommended)**  

- Host your providers and agents configuration files online (e.g. GitHub, S3)  
- Configure using JSON format
- No local file mounting required

**Option B: Local Files**  

- Keep configuration files locally  
- Requires volume mounts in Docker

---

### 2. Setup Environment File

Copy and edit the `.env` file:

```bash
cp .env.example .env
```

Update `.env`:

**For Remote Files:**

```env
CUBICLER_PROVIDERS_LIST=https://your-domain.com/config/providers.json
CUBICLER_AGENTS_LIST=https://your-domain.com/config/agents.json
CUBICLER_PORT=1503
```

**For Local Files:**

```env
CUBICLER_PROVIDERS_LIST=/app/config/providers.json
CUBICLER_AGENTS_LIST=/app/config/agents.json
CUBICLER_PORT=1503
```

---

### 3. Configure Volume Mounts (for local files)

In `docker-compose.yml`, uncomment and update:

```yaml
volumes:
  - ./your-providers.json:/app/config/providers.json:ro
  - ./your-agents.json:/app/config/agents.json:ro
```

---

### 4. Start Production Container

```bash
npm run docker:prod
```

---

### 5. Verify API Endpoints

```bash
curl http://localhost:1503/health
curl http://localhost:1503/agents
curl http://localhost:1503/mcp
```

---

## 📝 API Endpoints

Cubicler 2.0 provides the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for all services |
| `/agents` | GET | List all available agents |
| `/mcp` | POST | MCP protocol endpoint for tool discovery and execution |
| `/dispatch` | POST | Dispatch messages to default agent |
| `/dispatch/:agentId` | POST | Dispatch messages to specific agent |

---

## 🧪 Development Mode

For local development with live reloading:

```bash
npm run docker:dev
```

This mounts source files and uses example providers/agents configuration files. It auto-restarts on file changes.

---

## 🛠 Available Docker Commands

```bash
# Build Docker image
npm run docker:build

# Run production container
npm run docker:run

# Start development container
npm run docker:dev

# Start production container with compose
npm run docker:prod

# Run example setup
npm run docker:example

# Stop all containers
npm run docker:stop

# View logs
npm run docker:logs

# Build and tag for Docker Hub
npm run docker:build-hub

# Push to Docker Hub
npm run docker:push-hub

# Build and publish to Docker Hub
npm run docker:publish
```

---

## 📁 Docker File Structure

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage image (dev + prod) |
| `docker-compose.yml` | Base config for production |
| `docker-compose.dev.yml` | Dev config with mounts |
| `docker-compose.example.yml` | Config for running examples |
| `.dockerignore` | Ignore rules for Docker build |

---

## ⚙️ Configuration Reference

### Environment Variables (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `CUBICLER_PORT` | API server port | `1503` |
| `CUBICLER_PROVIDERS_LIST` | Providers JSON config path or URL | `providers.example.json` |
| `CUBICLER_AGENTS_LIST` | Agents JSON config path or URL | `agents.example.json` |
| `PROVIDERS_CACHE_ENABLED` | Enable providers config caching | `true` |
| `PROVIDERS_CACHE_TIMEOUT` | Cache timeout in seconds | `600` |
| `AGENTS_CACHE_ENABLED` | Enable agents config caching | `true` |
| `AGENTS_CACHE_TIMEOUT` | Cache timeout in seconds | `600` |
| `DEFAULT_CALL_TIMEOUT` | HTTP request timeout in ms | `30000` |

---

### Configuration File Formats

**Providers Configuration (`providers.json`):**

```json
{
  "mcpServers": [{
    "identifier": "weather_service",
    "name": "Weather Service",
    "description": "Provides weather information via MCP",
    "transport": "http",
    "url": "http://localhost:4000/mcp",
    "headers": { 
      "Authorization": "Bearer your-api-key"
    }
  }],
  "restServers": [{
    "identifier": "legacy_api",
    "name": "Legacy API",
    "description": "Legacy REST API without MCP",
    "url": "http://localhost:5000/api",
    "defaultHeaders": { "Authorization": "Bearer your-api-key" },
    "endPoints": [{
      "name": "get_user_info",
      "description": "Get user information by user ID",
      "path": "/users/{userId}",
      "method": "GET"
    }]
  }]
}
```

**Agents Configuration (`agents.json`):**

```json
{
  "basePrompt": "You are a helpful AI assistant powered by Cubicler.",
  "defaultPrompt": "You have access to various tools and services.",
  "agents": [{
    "identifier": "gpt_4o",
    "name": "My GPT-4O Agent", 
    "transport": "http",
    "url": "http://localhost:3000/agent",
    "description": "Advanced GPT-4O agent for complex tasks",
    "prompt": "You specialize in complex reasoning and analysis."
  }]
}
```

---

### Dev Volume Mounts

| Local Path | Container Path |
|------------|----------------|
| `./src/` | `/app/src/` |
| `./providers.example.json` | `/app/providers.example.json` |
| `./agents.example.json` | `/app/agents.example.json` |

---

## 📦 Pushing to Docker Registry

### Docker Hub (Official)

```bash
npm run docker:build-hub
npm run docker:push-hub
# or combined:
npm run docker:publish
```

### Custom Registry

```bash
docker build -t your-registry/cubicler:latest .
docker push your-registry/cubicler:latest
```

Update your deployment config (Docker Compose, Kubernetes, etc.) accordingly.

---

## 🔍 Health Checks

The Docker container includes comprehensive health checks via the `/health` endpoint:

```bash
curl http://localhost:1503/health
```

**Healthy Response (HTTP 200):**

```json
{
  "status": "healthy",
  "timestamp": "2025-07-28T17:45:02.388Z",
  "services": {
    "providers": { "status": "healthy" },
    "agents": { "status": "healthy" }
  }
}
```

**Unhealthy Response (HTTP 503):**

```json
{
  "status": "unhealthy",
  "timestamp": "2025-07-28T17:45:02.388Z",
  "services": {
    "providers": { "status": "unhealthy", "error": "ENOENT: no such file" },  
    "agents": { "status": "healthy" }
  }
}
```

The health check verifies both providers and agents services are working correctly.

## 📝 Troubleshooting

---

### Container Fails to Start

- Run `npm run docker:logs`
- Confirm `.env` values are correct
- Check accessibility of providers/agents configuration sources

### Port Conflicts

- Modify `CUBICLER_PORT` in `.env`
- Adjust port mapping in Docker Compose

### Permission Issues

- The app runs as non-root user `cubicler` (UID 1001)
- Ensure files mounted into the container are readable

---
