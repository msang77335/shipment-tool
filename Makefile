# ==============================================
# Makefile for Shipment Tracking API
# Simplifies Docker and development commands
# ==============================================

.PHONY: help build build-dev up up-dev down down-dev logs logs-dev shell test clean

# Default target
.DEFAULT_GOAL := help

# Variables
IMAGE_NAME := shipment-tracking-api
CONTAINER_NAME := shipment-tracking-api
DEV_CONTAINER_NAME := shipment-tracking-api-dev

## help: Show this help message
help:
	@echo "📦 Shipment Tracking API - Available Commands:"
	@echo ""
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' | sed -e 's/^/ /'

## install: Install dependencies locally
install:
	@echo "📦 Installing dependencies..."
	npm install
	npx playwright install firefox

## dev: Start development server locally
dev:
	@echo "🚀 Starting development server..."
	npm run dev

## build-local: Build TypeScript locally
build-local:
	@echo "🔨 Building TypeScript..."
	npm run build

## start: Start production server locally
start:
	@echo "🚀 Starting production server..."
	npm start

## === Docker Production ===

## build: Build production Docker image
build:
	@echo "🐳 Building production Docker image..."
	docker build -t $(IMAGE_NAME):latest .

## build-nc: Build production image without cache
build-nc:
	@echo "🐳 Building production Docker image (no cache)..."
	docker build --no-cache -t $(IMAGE_NAME):latest .

## up: Start production container with docker-compose
up:
	@echo "🚀 Starting production containers..."
	docker-compose up -d

## down: Stop production containers
down:
	@echo "🛑 Stopping production containers..."
	docker-compose down

## restart: Restart production containers
restart: down up
	@echo "♻️ Production containers restarted"

## logs: View production container logs
logs:
	@echo "📋 Showing production logs..."
	docker-compose logs -f

## === Docker Development ===

## build-dev: Build development Docker image
build-dev:
	@echo "🐳 Building development Docker image..."
	docker build -f Dockerfile.dev -t $(IMAGE_NAME):dev .

## up-dev: Start development container with docker-compose
up-dev:
	@echo "🚀 Starting development containers..."
	docker-compose -f docker-compose.dev.yml up

## up-dev-bg: Start development container in background
up-dev-bg:
	@echo "🚀 Starting development containers (background)..."
	docker-compose -f docker-compose.dev.yml up -d

## down-dev: Stop development containers
down-dev:
	@echo "🛑 Stopping development containers..."
	docker-compose -f docker-compose.dev.yml down

## logs-dev: View development container logs
logs-dev:
	@echo "📋 Showing development logs..."
	docker-compose -f docker-compose.dev.yml logs -f

## === Container Management ===

## shell: Access production container shell
shell:
	@echo "💻 Accessing container shell..."
	docker exec -it $(CONTAINER_NAME) sh

## shell-dev: Access development container shell
shell-dev:
	@echo "💻 Accessing development container shell..."
	docker exec -it $(DEV_CONTAINER_NAME) sh

## ps: Show running containers
ps:
	@echo "📊 Running containers:"
	docker ps --filter name=$(IMAGE_NAME)

## stats: Show container resource usage
stats:
	@echo "📊 Container stats:"
	docker stats --no-stream $(CONTAINER_NAME)

## health: Check container health
health:
	@echo "🏥 Checking container health..."
	@curl -f http://localhost:8080/health && echo "✅ Healthy" || echo "❌ Unhealthy"

## === Cleanup ===

## stop: Stop all containers
stop:
	@echo "🛑 Stopping all containers..."
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker stop $(DEV_CONTAINER_NAME) 2>/dev/null || true

## clean: Remove containers and images
clean: stop
	@echo "🧹 Cleaning up containers and images..."
	@docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(DEV_CONTAINER_NAME) 2>/dev/null || true
	@docker rmi $(IMAGE_NAME):latest 2>/dev/null || true
	@docker rmi $(IMAGE_NAME):dev 2>/dev/null || true

## clean-all: Remove everything including volumes
clean-all: clean
	@echo "🧹 Removing all Docker resources..."
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	@docker system prune -f

## prune: Clean up Docker system
prune:
	@echo "🧹 Pruning Docker system..."
	docker system prune -f
	docker volume prune -f

## === Testing & Quality ===

## lint: Run ESLint
lint:
	@echo "🔍 Running ESLint..."
	npm run lint

## lint-fix: Fix ESLint errors
lint-fix:
	@echo "🔧 Fixing ESLint errors..."
	npm run lint:fix

## test: Run tests
test:
	@echo "🧪 Running tests..."
	npm test

## test-docker: Run tests in Docker
test-docker:
	@echo "🧪 Running tests in Docker..."
	docker run --rm $(IMAGE_NAME):latest npm test

## === Deployment ===

## tag: Tag image with version
tag:
	@read -p "Enter version tag (e.g., v1.0.0): " version; \
	docker tag $(IMAGE_NAME):latest $(IMAGE_NAME):$$version; \
	echo "✅ Tagged as $(IMAGE_NAME):$$version"

## push: Push image to registry (configure registry first)
push:
	@read -p "Enter registry URL (e.g., docker.io/username/$(IMAGE_NAME)): " registry; \
	docker tag $(IMAGE_NAME):latest $$registry:latest; \
	docker push $$registry:latest; \
	echo "✅ Pushed to $$registry:latest"

## === Information ===

## info: Show project information
info:
	@echo "📦 Project: Shipment Tracking API"
	@echo "📋 Node version: $$(node --version 2>/dev/null || echo 'Not installed locally')"
	@echo "🐳 Docker version: $$(docker --version)"
	@echo "🐳 Docker Compose version: $$(docker-compose --version)"
	@echo ""
	@echo "📊 Images:"
	@docker images | grep $(IMAGE_NAME) || echo "No images found"
	@echo ""
	@echo "📊 Containers:"
	@docker ps -a --filter name=$(IMAGE_NAME) || echo "No containers found"

## env-check: Check environment variables
env-check:
	@echo "🔍 Checking environment setup..."
	@test -f .env && echo "✅ .env file exists" || echo "❌ .env file missing (copy from .env.example)"
	@test -f .env.docker && echo "✅ .env.docker file exists" || echo "ℹ️  .env.docker is optional"
