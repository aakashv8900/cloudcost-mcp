#!/bin/bash
# setup-ssl.sh - Generate self-signed SSL certificates for CloudCost MCP

set -e

SSL_DIR="./nginx/ssl"
CERT_FILE="$SSL_DIR/selfsigned.crt"
KEY_FILE="$SSL_DIR/selfsigned.key"

echo "Setting up SSL certificates..."

# Create directory
if [ ! -d "$SSL_DIR" ]; then
    echo "Creating $SSL_DIR directory..."
    mkdir -p "$SSL_DIR"
fi

# Generate certificate if it doesn't exist
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Generating self-signed certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"
    echo "Certificate generated."
else
    echo "Certificate already exists. Skipping generation."
fi

# Set permissions (Critical for Nginx to read them)
echo "Setting permissions to 644..."
chmod 644 "$CERT_FILE" "$KEY_FILE"

echo "SSL setup complete."
