# CloudCost MCP - Complete AWS Deployment Guide

## Prerequisites

- AWS Account (Free Tier eligible)
- AWS CLI installed
- Git installed

---

## Step 1: Install AWS CLI (if not installed)

```bash
# Ubuntu/WSL
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

---

## Step 2: Configure AWS CLI

```bash
# Run configure (you'll need Access Key ID and Secret from AWS Console)
aws configure
```

When prompted, enter:
- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Your User → Security credentials → Create access key
- **AWS Secret Access Key**: Same place as above
- **Default region name**: `ap-south-1` (Mumbai) or `us-east-1` (N. Virginia)
- **Default output format**: `json`

---

## Step 3: Create EC2 Key Pair

```bash
# Create key pair (replace 'cloudcost-key' with your preferred name)
aws ec2 create-key-pair \
  --key-name cloudcost-key \
  --query 'KeyMaterial' \
  --output text > cloudcost-key.pem

# Set correct permissions
chmod 400 cloudcost-key.pem

# Move to safe location
mv cloudcost-key.pem ~/.ssh/
```

---

## Step 4: Push Code to GitHub

```bash
# Navigate to project
cd /home/aakash/projects/cloudcost-mcp

# Initialize git if not done
git init

# Add remote (create repo on GitHub first)
git remote add origin https://github.com/YOUR_USERNAME/cloudcost-mcp.git

# Add all files
git add .

# Commit
git commit -m "CloudCost Intelligence MCP - Initial commit"

# Push
git push -u origin main
```

---

## Step 5: Deploy CloudFormation Stack

```bash
# Navigate to project directory
cd /home/aakash/projects/cloudcost-mcp

# Create the stack
aws cloudformation create-stack \
  --stack-name cloudcost-mcp \
  --template-body file://cloudformation.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=cloudcost-key \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/YOUR_USERNAME/cloudcost-mcp.git \
    ParameterKey=InstanceType,ParameterValue=t2.micro \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-south-1

# Wait for stack creation (takes 3-5 minutes)
echo "Waiting for stack creation..."
aws cloudformation wait stack-create-complete --stack-name cloudcost-mcp --region ap-south-1

echo "Stack created successfully!"
```

---

## Step 6: Get Your Server Details

```bash
# Get all outputs
aws cloudformation describe-stacks \
  --stack-name cloudcost-mcp \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs' \
  --output table

# Get just the MCP endpoint URL
aws cloudformation describe-stacks \
  --stack-name cloudcost-mcp \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`MCPEndpoint`].OutputValue' \
  --output text

# Get the public IP
aws cloudformation describe-stacks \
  --stack-name cloudcost-mcp \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text
```

---

## Step 7: Test Your Deployment

```bash
# Get the IP
IP=$(aws cloudformation describe-stacks --stack-name cloudcost-mcp --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' --output text)

# Test health endpoint
curl http://$IP:3000/health

# Test info endpoint
curl http://$IP:3000/
```

---

## Step 8: SSH Into Server (Optional)

```bash
# Get IP
IP=$(aws cloudformation describe-stacks --stack-name cloudcost-mcp --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' --output text)

# SSH into server
ssh -i ~/.ssh/cloudcost-key.pem ubuntu@$IP

# Once inside, check status
cd /home/ubuntu/cloudcost-mcp
./deploy.sh status
```

---

## Future Deployments (Updates)

### Option A: From your local machine
```bash
# SSH into server
ssh -i ~/.ssh/cloudcost-key.pem ubuntu@YOUR_IP

# Update
cd /home/ubuntu/cloudcost-mcp
git pull

# Run SSL setup (only needed once or if certs are missing)
chmod +x nginx/setup-ssl.sh
./nginx/setup-ssl.sh

# Update containers
./deploy.sh update
```

### Option B: Using a one-liner
```bash
IP=$(aws cloudformation describe-stacks --stack-name cloudcost-mcp --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' --output text)

ssh -i ~/.ssh/cloudcost-key.pem ubuntu@$IP "cd /home/ubuntu/cloudcost-mcp && git pull && ./deploy.sh update"
```

---

## CTX Protocol Registration

Your MCP endpoint URL:
```
http://YOUR_IP:3000/mcp
```

For CTX marketplace, use this format in your registration:
```yaml
name: cloudcost-intelligence
version: 1.0.0
endpoint: http://YOUR_IP:3000/mcp
transport: sse
```

---

## Useful Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name cloudcost-mcp --region ap-south-1 --query 'Stacks[0].StackStatus'

# View stack events (troubleshooting)
aws cloudformation describe-stack-events --stack-name cloudcost-mcp --region ap-south-1

# Delete stack (cleanup)
aws cloudformation delete-stack --stack-name cloudcost-mcp --region ap-south-1

# View EC2 instance logs (after SSH)
sudo cat /var/log/user-data.log
```

---

## Troubleshooting

### Stack creation failed
```bash
# Check what went wrong
aws cloudformation describe-stack-events --stack-name cloudcost-mcp --region ap-south-1 --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### Container not running
```bash
# SSH into server, then:
cd /home/ubuntu/cloudcost-mcp
docker compose logs
```

### Can't connect to port 3000
- Wait 2-3 minutes after stack creation for Docker build to complete
- Check security group allows port 3000
