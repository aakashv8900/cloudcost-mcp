# CloudCost Intelligence MCP

AI-native cost intelligence for cloud, AI models, and SaaS infrastructure.

## Features

- **21 Intelligent Tools** across 4 categories:
  - AI Model Cost & Comparison (6 tools)
  - Cloud Infrastructure Cost (5 tools)
  - SaaS & Startup Burn (5 tools)
  - Advanced Optimization (5 tools)

- **Comprehensive Pricing Data**: 15+ JSON files covering:
  - AWS, Azure, GCP (compute, storage, databases, serverless)
  - AI Models (OpenAI, Anthropic, Google, Mistral, Cohere, Groq, etc.)
  - Databases (Supabase, MongoDB, Neon, PlanetScale, etc.)
  - SaaS (Vercel, Cloudflare, Railway, Render, Fly.io, etc.)

- **Intelligence Engine**: Returns actionable insights, not just raw data

## Quick Start

```bash
# Install dependencies
npm install

# Development (stdio mode)
npm run dev

# Build
npm run build

# Production (HTTP mode)
npm start

# Test with MCP inspector
npm run inspect
```

## Docker Deployment

```bash
# Start locally
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## AWS Deployment

### Prerequisites
1. AWS CLI configured
2. EC2 Key Pair created

### Deploy with CloudFormation

```bash
aws cloudformation create-stack \
  --stack-name cloudcost-mcp \
  --template-body file://cloudformation.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=your-key-pair \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/your-username/cloudcost-mcp.git \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name cloudcost-mcp

# Get outputs
aws cloudformation describe-stacks --stack-name cloudcost-mcp --query 'Stacks[0].Outputs'
```

### Update Deployment

SSH into the server and run:
```bash
cd /home/ubuntu/cloudcost-mcp
./deploy.sh update
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info |
| `/health` | GET | Health check |
| `/mcp` | GET | MCP SSE connection |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `MCP_MODE` | `http` | `stdio` or `http` |
| `NODE_ENV` | `development` | Environment |

## CTX Protocol Integration

Register with CTX marketplace:

```yaml
name: cloudcost-mcp
endpoint: https://your-domain.com/mcp
description: AI-native cost intelligence for cloud, AI models, and SaaS
pricing:
  free:
    requests_per_day: 100
  pro:
    price: 10
    requests_per_day: unlimited
```

## License

MIT