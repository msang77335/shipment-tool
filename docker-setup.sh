#!/bin/bash

# ==============================================
# Docker Setup Script for Shipment Tracking API
# Automated setup and deployment
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    log_success "Docker is installed"
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    log_success "Docker Compose is installed"
}

# Setup environment file
setup_env() {
    log_info "Setting up environment file..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_success "Created .env from .env.example"
            log_warning "Please edit .env file with your configuration"
            
            if command -v nano &> /dev/null; then
                read -p "Do you want to edit .env now? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    nano .env
                fi
            fi
        else
            log_error ".env.example not found"
            exit 1
        fi
    else
        log_success ".env file already exists"
    fi
}

# Build Docker image
build_image() {
    local env=$1
    
    if [ "$env" == "dev" ]; then
        log_info "Building development Docker image..."
        docker build -f Dockerfile.dev -t shipment-tracking-api:dev .
    else
        log_info "Building production Docker image..."
        docker build -t shipment-tracking-api:latest .
    fi
    
    log_success "Docker image built successfully"
}

# Start containers
start_containers() {
    local env=$1
    
    if [ "$env" == "dev" ]; then
        log_info "Starting development containers..."
        docker-compose -f docker-compose.dev.yml up -d
    else
        log_info "Starting production containers..."
        docker-compose up -d
    fi
    
    log_success "Containers started successfully"
}

# Check health
check_health() {
    log_info "Waiting for container to be ready..."
    sleep 5
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log_success "Container is healthy and ready!"
            return 0
        fi
        
        log_info "Waiting for container... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "Container failed to become healthy"
    log_info "Check logs with: docker-compose logs"
    return 1
}

# Show status
show_status() {
    log_info "Current status:"
    docker-compose ps
    echo ""
    log_info "Access the API at: http://localhost:8080"
    log_info "Health check: http://localhost:8080/health"
    log_info "API endpoint: http://localhost:8080/api/v1"
}

# Main menu
show_menu() {
    echo ""
    echo "======================================"
    echo "  Shipment Tracking API - Docker Setup"
    echo "======================================"
    echo ""
    echo "1) Setup and deploy PRODUCTION"
    echo "2) Setup and deploy DEVELOPMENT"
    echo "3) Build production image only"
    echo "4) Build development image only"
    echo "5) Start containers"
    echo "6) Stop containers"
    echo "7) View logs"
    echo "8) Restart containers"
    echo "9) Clean up (remove containers and images)"
    echo "0) Exit"
    echo ""
}

# Main script
main() {
    clear
    
    if [ "$1" == "--prod" ] || [ "$1" == "-p" ]; then
        # Quick production deployment
        check_prerequisites
        setup_env
        build_image "prod"
        start_containers "prod"
        check_health
        show_status
        exit 0
    elif [ "$1" == "--dev" ] || [ "$1" == "-d" ]; then
        # Quick development deployment
        check_prerequisites
        setup_env
        build_image "dev"
        start_containers "dev"
        check_health
        show_status
        exit 0
    fi
    
    # Interactive mode
    while true; do
        show_menu
        read -p "Choose an option: " choice
        
        case $choice in
            1)
                check_prerequisites
                setup_env
                build_image "prod"
                start_containers "prod"
                check_health
                show_status
                ;;
            2)
                check_prerequisites
                setup_env
                build_image "dev"
                start_containers "dev"
                check_health
                show_status
                ;;
            3)
                build_image "prod"
                ;;
            4)
                build_image "dev"
                ;;
            5)
                log_info "Starting containers..."
                docker-compose up -d
                check_health
                show_status
                ;;
            6)
                log_info "Stopping containers..."
                docker-compose down
                docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
                log_success "Containers stopped"
                ;;
            7)
                log_info "Showing logs (press Ctrl+C to exit)..."
                docker-compose logs -f
                ;;
            8)
                log_info "Restarting containers..."
                docker-compose restart
                check_health
                log_success "Containers restarted"
                ;;
            9)
                log_warning "This will remove all containers, images, and volumes"
                read -p "Are you sure? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    docker-compose down -v
                    docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
                    docker rmi shipment-tracking-api:latest 2>/dev/null || true
                    docker rmi shipment-tracking-api:dev 2>/dev/null || true
                    log_success "Cleanup complete"
                fi
                ;;
            0)
                log_info "Goodbye!"
                exit 0
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
main "$@"
