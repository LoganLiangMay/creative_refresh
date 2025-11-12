#!/bin/bash
# RDA Image Generator - Environment Setup Script
# Region: us-east-1 (N. Virginia)

set -e  # Exit on error

echo "🚀 RDA Image Generator - Environment Setup"
echo "==========================================="
echo "Region: us-east-1 (N. Virginia)"
echo ""

# Force us-east-1 region
REGION="us-east-1"

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Get AWS Account ID
echo "🔍 Checking AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ AWS CLI not configured. Please run:"
    echo "   aws configure"
    echo ""
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region: us-east-1"
    exit 1
fi

echo "✅ AWS Account ID: $ACCOUNT_ID"
echo "✅ AWS Region: $REGION"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    if [ ! -f .env.local.example ]; then
        echo "❌ .env.local.example not found!"
        exit 1
    fi
    cp .env.local.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "⚠️  .env.local already exists, backing up to .env.local.backup"
    cp .env.local .env.local.backup
fi

echo ""
echo "📝 Updating .env.local with your AWS configuration..."

# Get AWS credentials from CLI config
ACCESS_KEY=$(aws configure get aws_access_key_id 2>/dev/null || echo "")
SECRET_KEY=$(aws configure get aws_secret_access_key 2>/dev/null || echo "")

# Update AWS credentials
if [ -n "$ACCESS_KEY" ] && [ -n "$SECRET_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$ACCESS_KEY|" .env.local
        sed -i '' "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$SECRET_KEY|" .env.local
    else
        # Linux
        sed -i "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$ACCESS_KEY|" .env.local
        sed -i "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$SECRET_KEY|" .env.local
    fi
    echo "✅ Set AWS credentials from CLI config"
else
    echo "⚠️  Could not find AWS credentials in CLI config"
    echo "   You'll need to manually add them to .env.local"
fi

# Update AWS Region to us-east-1
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|AWS_REGION=.*|AWS_REGION=$REGION|" .env.local
else
    sed -i "s|AWS_REGION=.*|AWS_REGION=$REGION|" .env.local
fi
echo "✅ Set AWS region: $REGION"

# Set bucket name
BUCKET_NAME="rda-images-dev-${ACCOUNT_ID}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|AWS_S3_BUCKET_NAME=.*|AWS_S3_BUCKET_NAME=$BUCKET_NAME|" .env.local
else
    sed -i "s|AWS_S3_BUCKET_NAME=.*|AWS_S3_BUCKET_NAME=$BUCKET_NAME|" .env.local
fi
echo "✅ Set S3 bucket: $BUCKET_NAME"

# Set DynamoDB table
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DYNAMODB_TABLE=.*|DYNAMODB_TABLE=RDAImageJobs-dev|" .env.local
else
    sed -i "s|DYNAMODB_TABLE=.*|DYNAMODB_TABLE=RDAImageJobs-dev|" .env.local
fi
echo "✅ Set DynamoDB table: RDAImageJobs-dev"

# Set SQS Queue URL
SQS_URL="https://sqs.${REGION}.amazonaws.com/${ACCOUNT_ID}/image-generation-queue-dev"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|SQS_QUEUE_URL=.*|SQS_QUEUE_URL=$SQS_URL|" .env.local
else
    sed -i "s|SQS_QUEUE_URL=.*|SQS_QUEUE_URL=$SQS_URL|" .env.local
fi
echo "✅ Set SQS queue URL"

# Set IS_LOCAL_DEV to true
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|IS_LOCAL_DEV=.*|IS_LOCAL_DEV=true|" .env.local
else
    sed -i "s|IS_LOCAL_DEV=.*|IS_LOCAL_DEV=true|" .env.local
fi
echo "✅ Set IS_LOCAL_DEV=true"

echo ""
echo "✅ AWS configuration complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANT: You still need to add API keys manually!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Get your NEW Replicate token:"
echo "   → https://replicate.com/account/api-tokens"
echo ""
echo "2️⃣  Get your NEW OpenAI key (optional):"
echo "   → https://platform.openai.com/api-keys"
echo ""
echo "3️⃣  Edit .env.local and add them:"
echo "   nano .env.local"
echo ""
echo "   Find these lines and replace with your actual keys:"
echo "   REPLICATE_API_TOKEN=r8_your_NEW_token_here"
echo "   OPENAI_API_KEY=sk_your_NEW_key_here"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test your setup (after adding API keys):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# Test in mock mode (FREE - no API calls):"
echo "cd lambdas/worker"
echo "export MOCK_MODE=true"
echo "node -e \"require('./index').handler({Records:[]})\""
echo ""
echo "# Test with real APIs (COSTS MONEY):"
echo "export MOCK_MODE=false"
echo "node -e \"require('./index').handler({Records:[]})\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
