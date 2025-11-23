
#!/bin/bash

# Startup script for VCTT-AGI Engine

echo "Starting VCTT-AGI Engine..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your API keys."
    exit 1
fi

# Check for OPENAI_API_KEY
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_key_here" ]; then
    echo "Warning: OPENAI_API_KEY not configured in .env file"
    echo "The service will start but analysis will fail without a valid API key."
fi

# Start with Docker Compose
echo "Starting services with Docker Compose..."
docker-compose up --build
