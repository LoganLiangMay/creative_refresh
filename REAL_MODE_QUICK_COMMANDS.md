# Real Mode Test - Quick Commands

## ⚠️ **COST WARNING: ~$0.08 for 2 images with Gemini API**

## Prerequisites

```bash
# Ensure you have a Gemini API key in Secrets Manager
aws secretsmanager create-secret \
  --name "rda-generator/gemini-api-key" \
  --secret-string "AIza_your_gemini_api_key_here"
```

## Option 1: Automated Test Script (Recommended)

```bash
# Run the complete automated test
./test-real-mode.sh
```

## Option 2: Manual Step-by-Step Commands

### 1. Setup Variables
```bash
export STACK_NAME="rda-image-generator-dev"
export WORKER_FUNCTION=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WorkerFunctionName`].OutputValue' --output text)
export API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
export S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
export DYNAMODB_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' --output text)
```

### 2. Switch to Real Mode
```bash
aws lambda update-function-configuration \
  --function-name "$WORKER_FUNCTION" \
  --environment Variables="{MOCK_MODE=false,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev,GEMINI_SECRET_NAME=rda-generator/gemini-api-key}"

sleep 15
```

### 3. Generate 2 Real Images
```bash
REAL_JOB=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "real_test",
    "images": [
      {"prompt": "Mountain landscape at sunset", "aspect_ratio": "1.91:1"},
      {"prompt": "Modern coffee shop interior", "aspect_ratio": "1:1"}
    ]
  }' | jq -r '.job_id')

echo "Job ID: $REAL_JOB"
```

### 4. Monitor Progress
```bash
# Check job status (repeat until completed)
curl -s "$API_GATEWAY_URL/jobs/$REAL_JOB" | jq '{status: .status, cost: .total_cost, progress: .progress}'
```

### 5. Verify Results
```bash
# Get final results
curl -s "$API_GATEWAY_URL/jobs/$REAL_JOB" | jq '{
  status: .status,
  total_cost: .total_cost,
  completed_images: [.images[] | select(.status == "completed")] | length,
  images: .images[].s3_key
}'
```

### 6. Download Sample Image
```bash
SAMPLE_S3_KEY=$(curl -s "$API_GATEWAY_URL/jobs/$REAL_JOB" | jq -r '.images[0].s3_key')
aws s3 cp "s3://$S3_BUCKET/$SAMPLE_S3_KEY" ./real_sample.jpg
```

### 7. Switch Back to Mock Mode
```bash
aws lambda update-function-configuration \
  --function-name "$WORKER_FUNCTION" \
  --environment Variables="{MOCK_MODE=true,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev}"

sleep 10

# Verify restoration
aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text
```

## Expected Results

- ✅ 2 real AI images generated
- ✅ Total cost: ~$0.08 (2 × $0.04 with Gemini API)
- ✅ Generation time: 2-3 minutes
- ✅ Images stored in S3 (larger than mock images)
- ✅ DynamoDB record shows mock_mode=false
- ✅ Sample image downloaded for quality verification
- ✅ System automatically restored to Mock Mode

## Safety Features

- Automatic Mock Mode restoration on script exit
- Cost limited to exactly 2 images
- Timeout protection (5 minutes max)
- Error handling with cleanup
- Verification tests after restoration

## Troubleshooting

```bash
# Check CloudWatch logs for errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
  --start-time $(date -d '10 minutes ago' +%s)000 \
  --filter-pattern "ERROR"

# Force restore Mock Mode if needed
aws lambda update-function-configuration \
  --function-name "$WORKER_FUNCTION" \
  --environment Variables="{MOCK_MODE=true,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev}"
```

## Cost Verification

```bash
# Check total cost in DynamoDB
aws dynamodb get-item \
  --table-name "$DYNAMODB_TABLE" \
  --key "{\"job_id\":{\"S\":\"$REAL_JOB\"}}" \
  --query 'Item.total_cost.N' \
  --output text
```