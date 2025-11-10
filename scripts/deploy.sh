#!/bin/bash

set -e

ENVIRONMENT=${1:-dev}
MOCK_MODE=${2:-true}

echo "========================================="
echo "Deploying RDA Image Generator"
echo "Environment: $ENVIRONMENT"
echo "Mock Mode: $MOCK_MODE"
echo "========================================="

echo "Installing dependencies..."
cd lambdas/controller && npm install && cd ../..
cd lambdas/prompt-builder && npm install && cd ../..
cd lambdas/worker && npm install && cd ../..

echo "Building SAM application..."
sam build

echo "Deploying to AWS..."
sam deploy \
    --stack-name "rda-generator-${ENVIRONMENT}" \
    --parameter-overrides \
        Environment="${ENVIRONMENT}" \
        MockMode="${MOCK_MODE}" \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset

echo "========================================="
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update Replicate API token in Secrets Manager"
echo "2. Test with: npm run test:integration"
echo "3. View logs: sam logs --stack-name rda-generator-${ENVIRONMENT}"
echo "========================================="