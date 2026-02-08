#!/bin/bash
# deploy.sh - Deployment script for CloudCost MCP (Server + Updater)
# Usage: ./deploy.sh [command]

set -e

# Docker Compose service names
SERVICE_MAIN="cloudcost-mcp"
SERVICE_UPDATER="cloudcost-updater"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_deps() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed."
        exit 1
    fi
}

# Start all services
start() {
    check_deps
    log_info "Starting CloudCost MCP (Server + Updater)..."
    docker compose up -d --build
    
    log_success "Services started!"
    log_info "Main Server: http://localhost:3000"
    log_info "Pricing Updater: http://localhost:3001"
    
    # Wait briefly for startup
    sleep 5
    health
}

# Stop all services
stop() {
    log_info "Stopping services..."
    docker compose down
    log_success "Services stopped."
}

# Restart
restart() {
    stop
    start
}

# View logs (combined or specific)
logs() {
    if [ -z "$1" ]; then
        docker compose logs -f
    else
        docker compose logs -f "$1"
    fi
}

# Check health of both services
health() {
    log_info "Checking system health..."
    
    # Check Main Server
    if curl -s -f http://localhost:3000/health > /dev/null; then
        log_success "MCP Server (3000): HEALTHY"
    else
        log_error "MCP Server (3000): UNHEALTHY or DOWN"
    fi

    # Check Updater
    if curl -s -f http://localhost:3001/updater/status > /dev/null; then
        log_success "Pricing Updater (3001): HEALTHY"
    else
        log_error "Pricing Updater (3001): UNHEALTHY or DOWN"
    fi
}

# Manually trigger pricing update
trigger_update() {
    log_info "Triggering manual pricing update..."
    RESPONSE=$(curl -s -X POST http://localhost:3001/updater/trigger)
    
    if [[ $? -eq 0 && "$RESPONSE" != "" ]]; then
        log_success "Update triggered successfully!"
        echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"
    else
        log_error "Failed to trigger update. Is the updater running on port 3001?"
    fi
}

# Run MCP Inspector on the main server
inspect() {
    log_info "Starting MCP Inspector for local server..."
    log_warning "Ensure you have stopped the docker container for port 3000 if running locally, or use a different port."
    
    # Check if local node_modules exists, else warn
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found. Installing dependencies..."
        npm install
    fi
    
    npm run inspect
}

# Update from git and rebuild
update() {
    log_info "Pulling latest changes..."
    git pull origin master
    start
}

# Main command dispatcher
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs "$2"
        ;;
    health)
        health
        ;;
    trigger)
        trigger_update
        ;;
    inspect)
        inspect
        ;;
    update)
        update
        ;;
    *)
        echo "CloudCost MCP Deployment Script"
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start     - Build and start all services (Server :3000, Updater :3001)"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  logs      - View logs (add service name for specific logs)"
        echo "  health    - Check health of both services"
        echo "  trigger   - Manually trigger a pricing update (POST /updater/trigger)"
        echo "  inspect   - Run MCP Inspector locally (npm run inspect)"
        echo "  update    - Git pull and restart"
        exit 1
        ;;
esac
