# Docker Quick Reference

## 🚀 Quick Start Commands

```bash
# Production (automated)
./docker-setup.sh --prod

# Development (automated)
./docker-setup.sh --dev

# Interactive menu
./docker-setup.sh
```

## 📋 Common Commands

### Using Makefile (Recommended)
```bash
make help           # Show all commands
make build          # Build production image
make up             # Start production
make down           # Stop production
make logs           # View logs
make shell          # Access container shell
make clean          # Remove everything
```

### Using Docker Compose
```bash
# Production
docker-compose up -d              # Start
docker-compose down               # Stop
docker-compose logs -f            # View logs
docker-compose restart            # Restart
docker-compose ps                 # Show status

# Development
docker-compose -f docker-compose.dev.yml up
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml logs -f
```

### Using Docker CLI
```bash
# Build
docker build -t shipment-tracking-api:latest .
docker build -f Dockerfile.dev -t shipment-tracking-api:dev .

# Run
docker run -d -p 8080:8080 --name api shipment-tracking-api:latest
docker run -d -p 8080:8080 --env-file .env shipment-tracking-api:latest

# Manage
docker stop api
docker start api
docker restart api
docker rm api
docker logs -f api
docker exec -it api sh

# Info
docker ps                         # List running containers
docker images                     # List images
docker stats api                  # Resource usage
```

## 🔍 Debugging

```bash
# Check container logs
docker logs -f shipment-tracking-api

# Access shell
docker exec -it shipment-tracking-api sh

# Check health
curl http://localhost:8080/health

# View environment variables
docker exec shipment-tracking-api env

# Inspect container
docker inspect shipment-tracking-api

# Check resource usage
docker stats shipment-tracking-api
```

## 🧹 Cleanup

```bash
# Using Makefile
make clean          # Remove containers and images
make clean-all      # Remove everything including volumes
make prune          # Clean Docker system

# Using Docker
docker stop shipment-tracking-api
docker rm shipment-tracking-api
docker rmi shipment-tracking-api:latest

# Clean all
docker system prune -a
docker volume prune
```

## 🔧 Environment Variables

Create `.env` file:
```env
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=key1,key2,key3
BROWSERLESS_API_TOKEN=token1,token2
```

## 📊 Health Check

```bash
# Check availability
curl http://localhost:8080/health

# In container
docker exec shipment-tracking-api \
  node -e "require('http').get('http://localhost:8080/health')"
```

## 🎯 Common Issues

**Port already in use:**
```bash
# Find and stop conflicting container
docker ps -a
docker stop <container-id>

# Or change port mapping (external:internal)
docker run -p 9090:8080 shipment-tracking-api:latest
```

**Container won't start:**
```bash
# Check logs
docker logs shipment-tracking-api

# Remove and recreate
docker-compose down
docker-compose up -d
```

**Out of memory:**
```bash
# Run with memory limit
docker run --memory="4g" -p 8080:8080 shipment-tracking-api:latest
```

**Rebuild without cache:**
```bash
make build-nc
# or
docker build --no-cache -t shipment-tracking-api:latest .
```

## 📦 Image Sizes

- Production: ~2GB (optimized, multi-stage)
- Development: ~2.5GB (includes dev dependencies)

## 🔐 Security

```bash
# Run as non-root (already configured)
docker exec shipment-tracking-api whoami  # Should be 'appuser'

# Scan for vulnerabilities
docker scan shipment-tracking-api:latest

# Or use Trivy
trivy image shipment-tracking-api:latest
```

## 🌐 Deployment

```bash
# Tag for registry
docker tag shipment-tracking-api:latest myregistry/shipment-tracking-api:v1.0.0

# Push to registry
docker push myregistry/shipment-tracking-api:v1.0.0

# Pull and run on server
docker pull myregistry/shipment-tracking-api:v1.0.0
docker run -d -p 8080:8080 myregistry/shipment-tracking-api:v1.0.0
```

## 📚 More Information

See [DOCKER.md](DOCKER.md) for comprehensive documentation.
