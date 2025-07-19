# 🐳 Docker Setup for Cubicle

This document explains how to run Cubicle using Docker.

---

## 🚀 Quick Start

### 🧪 Test with Example Files

Use the provided example files to test Cubicle quickly:

```bash
npm run docker:example
```

This runs Cubicle using `spec.example.yaml` and `prompt.example.md`.

---

## 📦 Production Deployment (Recommended)

### 1. Choose Configuration Method

**Option A: Remote URLs (Recommended)**  

- Host your spec and prompt files online (e.g. GitHub, S3)  
- No local file mounting required

**Option B: Local Files**  

- Keep files locally  
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
CUBICLE_SPEC_SOURCE=https://your-domain.com/specs/agent.yaml
CUBICLE_PROMPT_SOURCE=https://your-domain.com/prompts/agent.md
API_KEY=your_secret_key
```

**For Local Files:**

```env
CUBICLE_SPEC_SOURCE=/app/config/spec.yaml
CUBICLE_PROMPT_SOURCE=/app/config/prompt.md
API_KEY=your_secret_key
```

---

### 3. Configure Volume Mounts (for local files)

In `docker-compose.yml`, uncomment and update:

```yaml
volumes:
  - ./your-spec.yaml:/app/config/spec.yaml:ro
  - ./your-prompt.md:/app/config/prompt.md:ro
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
curl http://localhost:1503/spec
curl http://localhost:1503/prompt
```

---

## 🧪 Development Mode

For local development with live reloading:

```bash
npm run docker:dev
```

This mounts source files and uses example prompt/spec files. It auto-restarts on file changes.

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
| `PORT` | API server port | `1503` |
| `CUBICLE_SPEC_SOURCE` | YAML function spec path or URL | `spec.example.yaml` |
| `CUBICLE_PROMPT_SOURCE` | Prompt file path or URL | `prompt.example.md` |

---

### Dev Volume Mounts

| Local Path | Container Path |
|------------|----------------|
| `./src/` | `/app/src/` |
| `./spec.example.yaml` | `/app/spec.example.yaml` |
| `./prompt.example.md` | `/app/prompt.example.md` |

---

## 📦 Pushing to Docker Registry

```bash
docker build -t your-registry/cubicle:latest .
docker push your-registry/cubicle:latest
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
  "timestamp": "2025-07-19T07:45:02.388Z",
  "services": {
    "prompt": { "status": "healthy" },
    "spec": { "status": "healthy" }
  }
}
```

**Unhealthy Response (HTTP 503):**

```json
{
  "status": "unhealthy",
  "timestamp": "2025-07-19T07:45:02.388Z",
  "services": {
    "prompt": { "status": "unhealthy", "error": "ENOENT: no such file" },
    "spec": { "status": "healthy" }
  }
}
```

The health check verifies both prompt and spec services are working correctly.

## 📝 Troubleshooting

---

### Container Fails to Start

- Run `npm run docker:logs`
- Confirm `.env` values are correct
- Check accessibility of prompt/spec sources

### Port Conflicts

- Modify `PORT` in `.env`
- Adjust port mapping in Docker Compose

### Permission Issues

- The app runs as non-root user `cubicle` (UID 1001)
- Ensure files mounted into the container are readable

---
