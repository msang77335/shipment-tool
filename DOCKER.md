# Docker Deployment Guide

## Overview
This project includes optimized Docker configurations for both development and production environments with full Playwright browser automation support.

## 📦 Available Docker Files

| File | Purpose | Size | Use Case |
|------|---------|------|----------|
| `Dockerfile` | **Production** | ~2GB | Multi-stage, optimized, secure |
| `Dockerfile.dev` | **Development** | ~2.5GB | Hot reload, debugging |
| `docker-compose.yml` | **Production compose** | - | Production deployment |
| `docker-compose.dev.yml` | **Development compose** | - | Local development |

## 🚀 Quick Start

### Production Deployment

#### Using Docker:
```bash
# Build the image
docker build -t shipment-tracking-api:latest .

# Run the container
docker run -d \
  --name shipment-tracking-api \
  -p 8080:8080 \
  -e GEMINI_API_KEY=your_key_here \
  -e BROWSERLESS_API_TOKEN=your_token_here \
  shipment-tracking-api:latest

# Check logs
docker logs -f shipment-tracking-api
```

#### Using Docker Compose:
```bash
# Create .env file first (see Environment Variables section)
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Development Setup

#### Using Docker Compose (Recommended):
```bash
# Start development server with hot reload
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop
docker-compose -f docker-compose.dev.yml down
```

#### Using Docker:
```bash
# Build dev image
docker build -f Dockerfile.dev -t shipment-tracking-api:dev .

# Run with volume mounts for hot reload
docker run -d \
  --name shipment-tracking-api-dev \
  -p 8080:8080 \
  -v $(pwd)/src:/app/src \
  -e NODE_ENV=development \
  shipment-tracking-api:dev
```

## 🌍 Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
NODE_ENV=production
PORT=8080
API_PREFIX=/api/v1
TRUST_PROXY=loopback, linklocal, uniquelocal

# Captcha Services (optional)
CAPTCHA_SOLVER_API_KEY=
CAPTCHA_2CAPTCHA_KEY=
CAPTCHA_ANTICAPTCHA_KEY=

# Google AI (optional)
# For multiple keys, separate with commas: key1,key2,key3
GEMINI_API_KEY=
GOOGLE_AI_API_KEY=

# Browserless (optional)
# For multiple tokens, separate with commas: token1,token2,token3
BROWSERLESS_API_TOKEN=
```

## 🏗️ Docker Architecture

### Production Dockerfile (Multi-stage Build)

**Stage 1: Builder**
- Installs all dependencies
- Builds TypeScript to JavaScript
- Full Node.js image

**Stage 2: Production**
- Slim Node.js image
- Only production dependencies
- Playwright Firefox with system deps
- Non-root user for security
- Health check included
- Xvfb for headless browser

**Benefits:**
- ✅ Smaller final image (~2GB vs ~3GB+)
- ✅ Faster deployment
- ✅ Better security (minimal attack surface)
- ✅ Production optimized

### Development Dockerfile

**Features:**
- Full development dependencies
- Hot reload with nodemon
- Debugging support
- Source maps enabled
- Volume mounts for code changes

## 📊 Image Details

### Production Image Layers:
```
1. Base: node:20-bookworm-slim (~200MB)
2. Playwright dependencies (~500MB)
3. Production node_modules (~300MB)
4. Application code (~50MB)
5. Browsers (Firefox) (~900MB)
Total: ~2GB
```

### Development Image:
```
Similar to production but includes:
- DevDependencies
- Full debugging tools
Total: ~2.5GB
```

## 🔧 Useful Commands

### Container Management
```bash
# Build with tag
docker build -t shipment-tracking-api:v1.0.0 .

# Build without cache
docker build --no-cache -t shipment-tracking-api:latest .

# Run with custom port mapping (external:internal)
docker run -d -p 9090:8080 shipment-tracking-api:latest

# Run with all environment variables from file
docker run -d --env-file .env -p 8080:8080 shipment-tracking-api:latest

# Execute command inside container
docker exec -it shipment-tracking-api sh

# View real-time logs
docker logs -f shipment-tracking-api

# Inspect container
docker inspect shipment-tracking-api

# View container stats
docker stats shipment-tracking-api

# Restart container
docker restart shipment-tracking-api

# Stop and remove
docker stop shipment-tracking-api
docker rm shipment-tracking-api
```

### Docker Compose Commands
```bash
# Build images
docker-compose build

# Build without cache
docker-compose build --no-cache

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart specific service
docker-compose restart app

# Stop services
docker-compose stop

# Stop and remove containers, networks
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v

# Scale service (if needed)
docker-compose up -d --scale app=3
```

### Debugging
```bash
# Access container shell
docker exec -it shipment-tracking-api sh

# Check Node.js version
docker exec shipment-tracking-api node --version

# Check npm packages
docker exec shipment-tracking-api npm list

# Run health check manually
docker exec shipment-tracking-api node -e "require('http').get('http://localhost:8080/health', (r) => {console.log(r.statusCode)})"

# View environment variables
docker exec shipment-tracking-api env

# Check Playwright installation
docker exec shipment-tracking-api npx playwright --version
```

## 🎯 Production Best Practices

### 1. Use Multi-stage Builds ✅
Already implemented in `Dockerfile`

### 2. Run as Non-root User ✅
Container runs as `appuser` (uid: non-root)

### 3. Health Checks ✅
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3
```

### 4. Minimal Base Image ✅
Using `node:20-bookworm-slim` for production

### 5. Layer Caching Optimization ✅
Dependencies installed before code copy

### 6. Security Scanning
```bash
# Scan image for vulnerabilities
docker scan shipment-tracking-api:latest

# Or use Trivy
trivy image shipment-tracking-api:latest
```

### 7. Resource Limits
```bash
# Run with memory and CPU limits
docker run -d \
  --memory="2g" \
  --cpus="2.0" \
  -p 8080:8080 \
  shipment-tracking-api:latest
```

In docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker logs shipment-tracking-api

# Common issues:
# 1. Port already in use
docker ps -a  # Find conflicting container
docker stop <container-id>

# 2. Missing environment variables
docker exec shipment-tracking-api env | grep API_KEY
```

### Playwright errors
```bash
# Reinstall Playwright browsers
docker exec shipment-tracking-api npx playwright install firefox

# Check Xvfb is running
docker exec shipment-tracking-api ps aux | grep Xvfb

# Check display variable
docker exec shipment-tracking-api echo $DISPLAY
```

### Out of memory
```bash
# Increase Docker Desktop memory
# Settings → Resources → Memory → 4GB+

# Or run with explicit memory limit
docker run -d --memory="4g" shipment-tracking-api:latest
```

### Hot reload not working (Dev)
```bash
# Check volume mounts
docker inspect shipment-tracking-api-dev | grep Mounts -A 20

# Verify nodemon is watching
docker logs -f shipment-tracking-api-dev
```

### Build fails
```bash
# Clear Docker cache
docker builder prune -a

# Build with verbose output
docker build --progress=plain -t shipment-tracking-api:latest .

# Check disk space
docker system df
```

## 📝 CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t shipment-tracking-api:latest .
      
      - name: Run tests
        run: docker run --rm shipment-tracking-api:latest npm test
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push shipment-tracking-api:latest
```

## 🌐 Deployment Platforms

### Deploy to AWS ECS
```bash
# Tag for ECR
docker tag shipment-tracking-api:latest <account-id>.dkr.ecr.<region>.amazonaws.com/shipment-tracking-api:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/shipment-tracking-api:latest
```

### Deploy to Google Cloud Run
```bash
# Build and push
gcloud builds submit --tag gcr.io/<project-id>/shipment-tracking-api

# Deploy
gcloud run deploy shipment-tracking-api \
  --image gcr.io/<project-id>/shipment-tracking-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and init
railway login
railway init

# Deploy
railway up
```

## 📚 Additional Resources

- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Playwright Docker Guide](https://playwright.dev/docs/docker)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

## 🔐 Security Notes

- ✅ Never commit `.env` files
- ✅ Use secrets management in production
- ✅ Regular security scans with docker scan or Trivy
- ✅ Keep base images updated
- ✅ Run as non-root user
- ✅ Minimal dependencies in production image

## 📞 Support

For issues related to Docker deployment, check:
1. Container logs: `docker logs -f shipment-tracking-api`
2. Health endpoint: `http://localhost:8080/health`
3. GitHub Issues: [Project Repository]

docker exec -it express-server sh
```

### Stop and remove container:
```bash
docker stop express-server
docker rm express-server
```

### Remove image:
```bash
docker rmi express-server
```

### Check running containers:
```bash
docker ps
```

### Check image size:
```bash
docker images express-server
```

## Environment Variables

Set these environment variables when running the container:

- `NODE_ENV` - Set to 'production' for production
- `PORT` - Server port (default: 8080)
- `CORS_ORIGIN` - CORS origin URL (default: http://localhost:3001)

Example:
```bash
docker run -d \
  --name express-server \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://your-domain.com \
  express-server
```

## Health Check

The container includes a health check endpoint at `/health`. You can check if the container is healthy:

```bash
docker inspect --format='{{.State.Health.Status}}' express-server
```

## Volume Mounting

To persist screenshots or mount configuration:

```bash
docker run -d \
  --name express-server \
  -p 8080:8080 \
  -v $(pwd)/screenshots:/app/screenshots \
  -v $(pwd)/.env:/app/.env \
  express-server
```

## Image Sizes

- Standard build (~900MB) - Includes dev dependencies during build
- Production build (~400-500MB) - Multi-stage build, only production dependencies
- Development build (~900MB) - All dependencies for development

## Troubleshooting

### Container not starting:
```bash
docker logs express-server
```

### Check if port is available:
```bash
lsof -i :8080
```

### Rebuild without cache:
```bash
docker build --no-cache -t express-server .
```

### Clean up all containers and images:
```bash
docker system prune -a
```