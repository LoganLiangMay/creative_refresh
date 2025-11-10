#!/bin/bash

##############################################################################
# Real Mode Test Script - COST LIMITED TO 2 IMAGES (~$0.09)
#
# This script safely tests Real Mode with exactly 2 images and automatically
# restores Mock Mode to prevent accidental additional costs.
##############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}⚠️  REAL MODE TEST - LIMITED TO 2 IMAGES${NC}"
echo -e "${YELLOW}💰 Expected cost: ~\$0.08 (2 × \$0.04 per image with Gemini API)${NC}"
echo "=============================================="

# Cost confirmation
echo -e "\n${RED}⚠️  COST WARNING:${NC}"
echo "This test will generate 2 real AI images using Google's Gemini API"
echo "Estimated cost: ~\$0.08"
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel..."
read -r

# Setup variables
STACK_NAME="rda-image-generator-dev"

echo -e "\n${BLUE}📋 Setting up test environment...${NC}"

if ! aws cloudformation describe-stacks --stack-name $STACK_NAME &>/dev/null; then
    echo -e "${RED}❌ Stack $STACK_NAME not found. Please deploy first.${NC}"
    exit 1
fi

API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
WORKER_FUNCTION=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WorkerFunctionName`].OutputValue' --output text)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
DYNAMODB_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' --output text)
SECRET_NAME="rda-generator/gemini-api-key"

echo "✅ API Gateway: $API_GATEWAY_URL"
echo "✅ Worker Function: $WORKER_FUNCTION"
echo "✅ S3 Bucket: $S3_BUCKET"

# Verify Gemini API key secret
echo -e "\n${BLUE}🔑 Verifying Gemini API key...${NC}"
if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" &>/dev/null; then
    echo -e "${RED}❌ Gemini API key secret not found: $SECRET_NAME${NC}"
    echo "Create it with: aws secretsmanager create-secret --name '$SECRET_NAME' --secret-string 'AIza_your_api_key'"
    exit 1
fi
echo "✅ Gemini API key secret found"

# Error handler to restore Mock Mode
restore_mock_mode() {
    echo -e "\n${YELLOW}🔄 Emergency: Restoring Mock Mode...${NC}"
    aws lambda update-function-configuration \
        --function-name "$WORKER_FUNCTION" \
        --environment Variables="{MOCK_MODE=true,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev}" \
        >/dev/null 2>&1 || true
    echo -e "${GREEN}✅ Mock Mode restored for safety${NC}"
}

# Trap to ensure we restore Mock Mode on any exit
trap restore_mock_mode EXIT

# Switch to Real Mode
echo -e "\n${BLUE}🔄 Switching to Real Mode...${NC}"
aws lambda update-function-configuration \
    --function-name "$WORKER_FUNCTION" \
    --environment Variables="{MOCK_MODE=false,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev,GEMINI_SECRET_NAME=$SECRET_NAME}" \
    >/dev/null

echo "Waiting for configuration to propagate..."
sleep 15

# Verify Real Mode
new_mock_mode=$(aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text)
if [[ "$new_mock_mode" != "false" ]]; then
    echo -e "${RED}❌ Failed to switch to Real Mode${NC}"
    exit 1
fi
echo "✅ Real Mode activated"

# Create 2-image job
echo -e "\n${BLUE}🎨 Creating 2-image Real Mode job...${NC}"
REAL_TEST_JOB=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
    -H "Content-Type: application/json" \
    -d '{
        "customer_id": "real_mode_test",
        "images": [
            {
                "prompt": "A beautiful mountain landscape at sunset with crystal clear lake",
                "aspect_ratio": "1.91:1"
            },
            {
                "prompt": "Modern coffee shop interior with warm lighting",
                "aspect_ratio": "1:1"
            }
        ]
    }' | jq -r '.job_id')

if [[ "$REAL_TEST_JOB" == "null" || -z "$REAL_TEST_JOB" ]]; then
    echo -e "${RED}❌ Failed to create job${NC}"
    exit 1
fi

echo "✅ Job created: $REAL_TEST_JOB"
echo -e "${BLUE}🕐 Generating real images... (may take 2-3 minutes)${NC}"

# Monitor progress
start_time=$(date +%s)
timeout_seconds=300  # 5 minutes max

while true; do
    job_data=$(curl -s "$API_GATEWAY_URL/jobs/$REAL_TEST_JOB")
    status=$(echo "$job_data" | jq -r '.status')

    elapsed=$(($(date +%s) - start_time))

    if [[ "$status" == "completed" ]]; then
        echo -e "\n${GREEN}✅ Job completed in ${elapsed}s!${NC}"
        break
    elif [[ "$status" == "failed" ]]; then
        echo -e "\n${RED}❌ Job failed after ${elapsed}s${NC}"
        exit 1
    fi

    if [[ $elapsed -gt $timeout_seconds ]]; then
        echo -e "\n${RED}❌ Job timed out after ${elapsed}s${NC}"
        exit 1
    fi

    # Progress indicator
    if [[ $((elapsed % 30)) -eq 0 && $elapsed -gt 0 ]]; then
        echo "$(date '+%H:%M:%S') - Still processing... (${elapsed}s elapsed, status: $status)"
    fi

    sleep 10
done

# Verify results
echo -e "\n${BLUE}🔍 Verifying results...${NC}"

final_job_data=$(curl -s "$API_GATEWAY_URL/jobs/$REAL_TEST_JOB")
completed_images=$(echo "$final_job_data" | jq '[.images[] | select(.status == "completed")] | length')
actual_cost=$(echo "$final_job_data" | jq -r '.total_cost // 0')

echo "Images completed: $completed_images/2"
echo "Actual cost: \$${actual_cost}"

# Verify cost range
cost_ok=$(echo "$actual_cost >= 0.06 && $actual_cost <= 0.10" | bc -l 2>/dev/null || echo "0")

if [[ $completed_images -eq 2 ]]; then
    echo -e "${GREEN}✅ All 2 images generated successfully${NC}"
else
    echo -e "${RED}❌ Expected 2 images, got $completed_images${NC}"
fi

if [[ "$cost_ok" == "1" ]]; then
    echo -e "${GREEN}✅ Cost \$${actual_cost} within expected range (\$0.06-\$0.10)${NC}"
else
    echo -e "${YELLOW}⚠️  Cost \$${actual_cost} outside expected range${NC}"
fi

# Download sample image
echo -e "\n${BLUE}📥 Downloading sample image...${NC}"
sample_s3_key=$(echo "$final_job_data" | jq -r '.images[0].s3_key')
sample_image_id=$(echo "$final_job_data" | jq -r '.images[0].image_id')

if [[ "$sample_s3_key" != "null" ]]; then
    aws s3 cp "s3://$S3_BUCKET/$sample_s3_key" "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null

    if [[ -f "./real_mode_sample_${sample_image_id}.jpg" ]]; then
        file_size=$(stat -f%z "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null || stat -c%s "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null || echo "unknown")
        echo "✅ Downloaded: real_mode_sample_${sample_image_id}.jpg (${file_size} bytes)"
    else
        echo -e "${YELLOW}⚠️  Could not download sample image${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No sample image available${NC}"
fi

# Check S3 storage
echo -e "\n${BLUE}🪣 Verifying S3 storage...${NC}"
s3_images=$(aws s3 ls s3://$S3_BUCKET/ --recursive | grep -c ".jpg" || echo "0")
echo "Total images in S3: $s3_images"

# Check DynamoDB
echo -e "\n${BLUE}🗄️  Checking DynamoDB record...${NC}"
dynamo_record=$(aws dynamodb get-item \
    --table-name "$DYNAMODB_TABLE" \
    --key "{\"job_id\":{\"S\":\"$REAL_TEST_JOB\"}}" \
    --query 'Item.mock_mode.BOOL' \
    --output text 2>/dev/null || echo "null")

if [[ "$dynamo_record" == "false" ]]; then
    echo "✅ DynamoDB correctly shows mock_mode=false"
else
    echo -e "${YELLOW}⚠️  DynamoDB mock_mode: $dynamo_record${NC}"
fi

# Restore Mock Mode (this also happens in trap)
echo -e "\n${BLUE}🔄 Restoring Mock Mode...${NC}"
aws lambda update-function-configuration \
    --function-name "$WORKER_FUNCTION" \
    --environment Variables="{MOCK_MODE=true,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev}" \
    >/dev/null

sleep 10

restored_mode=$(aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text)
if [[ "$restored_mode" == "true" ]]; then
    echo -e "${GREEN}✅ Mock Mode restored successfully${NC}"
else
    echo -e "${RED}❌ Failed to restore Mock Mode!${NC}"
    exit 1
fi

# Quick mock test to verify
echo -e "\n${BLUE}🧪 Quick Mock Mode verification...${NC}"
mock_job=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
    -H "Content-Type: application/json" \
    -d '{"customer_id": "verification", "images": [{"prompt": "Mock test", "aspect_ratio": "1:1"}]}' \
    | jq -r '.job_id')

sleep 10
mock_status=$(curl -s "$API_GATEWAY_URL/jobs/$mock_job" | jq -r '.status')
mock_cost=$(curl -s "$API_GATEWAY_URL/jobs/$mock_job" | jq -r '.total_cost // 0')

if [[ "$mock_status" == "completed" && ("$mock_cost" == "0" || "$mock_cost" == "0.00") ]]; then
    echo -e "${GREEN}✅ Mock Mode working correctly (cost: \$${mock_cost})${NC}"
else
    echo -e "${YELLOW}⚠️  Mock verification: status=$mock_status, cost=\$${mock_cost}${NC}"
fi

# Final summary
echo -e "\n${BOLD}🎉 REAL MODE TEST COMPLETED${NC}"
echo "=================================="
echo -e "${GREEN}✅ Real images generated: $completed_images/2${NC}"
echo -e "${GREEN}✅ Total cost: \$${actual_cost}${NC}"
echo -e "${GREEN}✅ Sample downloaded: real_mode_sample_${sample_image_id}.jpg${NC}"
echo -e "${GREEN}✅ Mock Mode restored: System safe${NC}"

if [[ -f "./real_mode_sample_${sample_image_id}.jpg" ]]; then
    echo -e "\n${BLUE}📝 Next: Open ./real_mode_sample_${sample_image_id}.jpg to verify image quality${NC}"
fi

# Disable the trap since we completed successfully
trap - EXIT