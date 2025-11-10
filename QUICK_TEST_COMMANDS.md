# Quick Test Commands - Copy & Paste

## 1. Deploy with Mock Mode

```bash
./deploy.sh dev true
```

## 2. Run Complete Test Suite

```bash
./test-mock-mode.sh
```

## 3. Manual Single Test (if needed)

```bash
# Set variables
export STACK_NAME="rda-image-generator-dev"
export API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Single image test
curl -X POST "$API_GATEWAY_URL/jobs" -H "Content-Type: application/json" -d '{"customer_id": "quick_test", "images": [{"prompt": "Test image", "aspect_ratio": "1.91:1"}]}'
```

## 4. Check Logs for Mock Mode

```bash
export WORKER_FUNCTION=$(aws cloudformation describe-stacks --stack-name rda-image-generator-dev --query 'Stacks[0].Outputs[?OutputKey==`WorkerFunctionName`].OutputValue' --output text)

aws logs filter-log-events --log-group-name "/aws/lambda/$WORKER_FUNCTION" --start-time $(date -d '5 minutes ago' +%s)000 --filter-pattern "🎭 MOCK MODE"
```

## 5. Verify S3 Images

```bash
export S3_BUCKET=$(aws cloudformation describe-stacks --stack-name rda-image-generator-dev --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)

aws s3 ls s3://$S3_BUCKET/ --recursive
```

## 6. Check DynamoDB Records

```bash
export DYNAMODB_TABLE=$(aws cloudformation describe-stacks --stack-name rda-image-generator-dev --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' --output text)

aws dynamodb scan --table-name "$DYNAMODB_TABLE" --filter-expression "mock_mode = :mock" --expression-attribute-values '{":mock":{"BOOL":true}}' --query 'Items[].{JobId:job_id.S,Status:job_status.S,Cost:total_cost.N}' --output table
```

## 7. All-in-One Test Command

```bash
# Deploy and test in one command
./deploy.sh dev true && sleep 30 && ./test-mock-mode.sh
```

## Expected Results

- ✅ All 5 test scenarios should pass
- ✅ Total cost: $0 across all tests
- ✅ Images stored in S3
- ✅ DynamoDB records with mock_mode=true
- ✅ CloudWatch logs showing "🎭 MOCK MODE"
- ✅ Fast execution times (<10s single, <20s batch)