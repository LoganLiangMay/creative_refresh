#!/bin/bash

##############################################################################
# Deploy Viewer - Deployment script for RDA Image Viewer
#
# This script:
# 1. Deploys/updates the CloudFormation stack (including viewer Lambda & API Gateway)
# 2. Retrieves the API Gateway URL from stack outputs
# 3. Updates the viewer HTML/JS with the correct API endpoint
# 4. Uploads the static viewer files to S3
##############################################################################

set -e  # Exit on error

# Configuration
ENVIRONMENT=${1:-dev}
STACK_NAME="rda-image-generator-${ENVIRONMENT}"
REGION=${AWS_REGION:-us-east-1}

echo "========================================"
echo "RDA Image Viewer Deployment"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Stack Name:  $STACK_NAME"
echo "Region:      $REGION"
echo ""

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "❌ SAM CLI is required but not installed. Aborting." >&2; exit 1; }

# Step 1: Build and deploy the SAM application
echo "Step 1: Building SAM application..."
sam build --template-file template.yaml

echo ""
echo "Step 2: Deploying CloudFormation stack..."
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        MockMode="true" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

echo ""
echo "✅ Stack deployed successfully!"

# Step 3: Get the API Gateway URL from stack outputs
echo ""
echo "Step 3: Retrieving API Gateway URL..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ViewerApiUrl'].OutputValue" \
    --output text)

if [ -z "$API_URL" ]; then
    echo "❌ Failed to retrieve API Gateway URL from stack outputs"
    exit 1
fi

echo "API Gateway URL: $API_URL"

# Step 4: Get the viewer website bucket name
VIEWER_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ViewerWebsiteBucketName'].OutputValue" \
    --output text)

if [ -z "$VIEWER_BUCKET" ]; then
    echo "❌ Failed to retrieve viewer bucket name from stack outputs"
    exit 1
fi

echo "Viewer Bucket: $VIEWER_BUCKET"

# Step 5: Update the viewer app.js with the correct API endpoint
echo ""
echo "Step 4: Updating viewer configuration..."
TEMP_DIR=$(mktemp -d)
cp -r viewer/public/* "$TEMP_DIR/"

# Replace the placeholder with the actual API URL
sed -i.bak "s|API_GATEWAY_URL_PLACEHOLDER|$API_URL|g" "$TEMP_DIR/app.js"
rm "$TEMP_DIR/app.js.bak" 2>/dev/null || true

echo "✅ Configuration updated with API endpoint: $API_URL"

# Step 6: Upload static files to S3
echo ""
echo "Step 5: Uploading viewer files to S3..."
aws s3 sync "$TEMP_DIR/" "s3://$VIEWER_BUCKET/" \
    --region "$REGION" \
    --delete \
    --cache-control "public, max-age=300" \
    --metadata-directive REPLACE

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo "✅ Viewer files uploaded successfully!"

# Step 7: Get the viewer website URL
WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ViewerWebsiteUrl'].OutputValue" \
    --output text)

echo ""
echo "========================================"
echo "Deployment Complete! 🎉"
echo "========================================"
echo ""
echo "📊 Viewer Website: $WEBSITE_URL"
echo "🔌 API Gateway:    $API_URL"
echo ""
echo "You can now access the viewer at:"
echo "👉 $WEBSITE_URL"
echo ""
echo "To test the API directly:"
echo "curl $API_URL/health"
echo ""
echo "To view recent jobs:"
echo "curl $API_URL/jobs"
echo ""
