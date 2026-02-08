#!/bin/bash
# deploy.sh - Deployment script for CloudCost MCP Server
# Usage: ./deploy.sh [command]
# Commands: start, stop, restart, logs, update, status, build

set -e

COMPOSE_PROJECT_NAME="cloudcost-mcp"
DOCKER_COMPOSE="docker compose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start the server
start() {
    log_info "Starting CloudCost MCP Server..."
    $DOCKER_COMPOSE up -d --build
    log_success "Server started successfully!"
    status
}

# Stop the server
stop() {
    log_info "Stopping CloudCost MCP Server..."
    $DOCKER_COMPOSE down
    log_success "Server stopped successfully!"
}

# Restart the server
restart() {
    log_info "Restarting CloudCost MCP Server..."
    stop
    start
}

# View logs
logs() {
    log_info "Showing logs (Ctrl+C to exit)..."
    $DOCKER_COMPOSE logs -f
}

# Update from git and rebuild
update() {
    log_info "Pulling latest changes from git..."
    git pull origin master

    log_info "Rebuilding and restarting containers..."
    $DOCKER_COMPOSE up -d --build

    log_success "Update complete!"
    status
}

# Show status
status() {
    echo ""
    log_info "Container Status:"
    $DOCKER_COMPOSE ps

    echo ""
    log_info "Health Check:"
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Server is healthy and responding"
    else
        log_warning "Server is not responding on port 3000"
    fi

    echo ""
    log_info "Server URL:"
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
    echo "  http://${PUBLIC_IP}:3000"
}

# Build only (no start)
build() {
    log_info "Building Docker image..."
    $DOCKER_COMPOSE build
    log_success "Build complete!"
}

# Clean up (remove images and volumes)
clean() {
    log_warning "This will remove all containers, images, and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE down -v --rmi all
        log_success "Cleanup complete!"
    else
        log_info "Cleanup cancelled."
    fi
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    if [ -z "$1" ]; then
        log_error "Please provide your domain name"
        echo "Usage: ./deploy.sh setup-ssl yourdomain.com"
        exit 1
    fi

    DOMAIN=$1
    log_info "Setting up SSL for ${DOMAIN}..."

    # Update nginx config with domain
    sed -i "s/yourdomain.com/${DOMAIN}/g" nginx/nginx.conf

    # Get initial certificate
    $DOCKER_COMPOSE --profile production run --rm certbot certonly \
        --webroot -w /var/www/certbot \
        --email admin@${DOMAIN} \
        --agree-tos \
        --no-eff-email \
        -d ${DOMAIN}

    # Restart with SSL
    $DOCKER_COMPOSE --profile production up -d

    log_success "SSL setup complete for ${DOMAIN}!"
}

# Show help
help() {
    echo "CloudCost MCP Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start the MCP server"
    echo "  stop        Stop the MCP server"
    echo "  restart     Restart the MCP server"
    echo "  logs        View container logs"
    echo "  update      Pull latest code and rebuild"
    echo "  status      Show server status"
    echo "  build       Build Docker image only"
    echo "  clean       Remove all containers and images"
    echo "  setup-ssl   Setup SSL with Let's Encrypt (requires domain)"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh start"
    echo "  ./deploy.sh update"
    echo "  ./deploy.sh setup-ssl mysite.example.com"
}

# Main
case "${1:-help}" in
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
        logs
        ;;
    update)
        update
        ;;
    status)
        status
        ;;
    build)
        build
        ;;
    clean)
        clean
        ;;
    setup-ssl)
        setup_ssl "$2"
        ;;
    help|--help|-h)
        help
        ;;
    *)
        log_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
