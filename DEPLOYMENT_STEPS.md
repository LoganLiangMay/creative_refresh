# Deployment Steps - US-EAST-1

## ✅ Pre-Deployment Checklist

Your setup is complete and tested:
- ✅ AWS Account ID: **273144884273**
- ✅ Region: **us-east-1**
- ✅ Mock mode test: **PASSED**
- ✅ Prompt enhancement: **WORKING** (OpenAI configured)
- ✅ S3 upload bug: **FIXED**

---

## 📦 Step 1: Install AWS SAM CLI

SAM CLI is required for deployment. Install it:

### macOS (using Homebrew):
```bash
brew tap aws/tap
brew install aws-sam-cli

# Verify installation
sam --version
```

### macOS (manual install):
```bash
# Download the installer
curl -L "https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-macos-arm64.pkg" -o sam-cli.pkg

# Install
sudo installer -pkg sam-cli.pkg -target /

# Verify
sam --version
```

### Alternative: Use AWS CloudFormation Directly
If you prefer not to install SAM, see "Alternative Deployment" below.

---

## 🚀 Step 2: Store API Keys in AWS Secrets Manager

Before deploying, store your API keys:

```bash
# Replicate token (REQUIRED)
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --description "Replicate API token for RDA image generation" \
  --secret-string '{"token":"YOUR_REPLICATE_TOKEN_FROM_ENV_LOCAL"}' \
  --region us-east-1

# OpenAI key (OPTIONAL but recommended for prompt enhancement)
aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-dev" \
  --description "OpenAI API key for prompt enhancement" \
  --secret-string '{"api_key":"YOUR_OPENAI_KEY_FROM_ENV_LOCAL"}' \
  --region us-east-1
```

### Verify secrets were created:
```bash
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query 'SecretList[?starts_with(Name, `rda-generator/`)].{Name:Name,Description:Description}'
```

---

## 🏗️ Step 3: Build and Deploy with SAM

```bash
cd /Applications/Gauntlet/creative_refresh_replicate

# Build the application
sam build

# Deploy to us-east-1
sam deploy \
  --stack-name rda-image-generator-dev \
  --region us-east-1 \
  --parameter-overrides \
    Environment=dev \
    MockMode=false \
  --capabilities CAPABILITY_NAMED_IAM \
  --resolve-s3

# Or use guided deployment (recommended for first time)
sam deploy --guided --region us-east-1
```

### During guided deployment, use these values:
```
Stack Name: rda-image-generator-dev
AWS Region: us-east-1
Parameter Environment: dev
Parameter MockMode: false
Confirm changes before deploy: Y
Allow SAM CLI IAM role creation: Y
Save arguments to configuration file: Y
SAM configuration file: samconfig.toml
SAM configuration environment: dev
```

---

## ✅ Step 4: Verify Deployment

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name rda-image-generator-dev \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'

# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name rda-image-generator-dev \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table

# Verify DynamoDB table exists
aws dynamodb describe-table \
  --table-name RDAImageJobs-dev \
  --region us-east-1 \
  --query 'Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}'

# Verify S3 bucket exists
aws s3 ls s3://rda-images-dev-273144884273 --region us-east-1

# Verify Lambda function exists
aws lambda get-function \
  --function-name rda-worker-dev \
  --region us-east-1 \
  --query '{Name:Configuration.FunctionName,Runtime:Configuration.Runtime,State:Configuration.State}'

# Verify SQS queue exists
aws sqs get-queue-url \
  --queue-name image-generation-queue-dev \
  --region us-east-1
```

---

## 🧪 Step 5: Test the Deployment

### Test Lambda directly:
```bash
aws lambda invoke \
  --function-name rda-worker-dev \
  --region us-east-1 \
  --payload '{
    "Records": [{
      "body": "{\"job_id\":\"deploy-test-1\",\"customer_id\":\"test-customer\",\"image_id\":\"img-001\",\"image_index\":0,\"aspect_ratio\":\"1:1\",\"prompt\":\"A beautiful sunset over mountains\"}"
    }]
  }' \
  --log-type Tail \
  response.json

# View response
cat response.json

# View logs
aws logs tail /aws/lambda/rda-worker-dev \
  --region us-east-1 \
  --since 5m \
  --follow
```

### Test via SQS (end-to-end):
```bash
# Send message to queue
aws sqs send-message \
  --region us-east-1 \
  --queue-url "https://sqs.us-east-1.amazonaws.com/273144884273/image-generation-queue-dev" \
  --message-body '{
    "job_id": "e2e-test-1",
    "customer_id": "test-customer",
    "image_id": "img-e2e-001",
    "image_index": 0,
    "aspect_ratio": "1:1",
    "prompt": "Professional office workspace with natural lighting"
  }'

# Monitor Lambda logs
aws logs tail /aws/lambda/rda-worker-dev \
  --region us-east-1 \
  --follow

# Check S3 for generated image
aws s3 ls s3://rda-images-dev-273144884273/test-customer/e2e-test-1/ \
  --region us-east-1

# Check DynamoDB for job record
aws dynamodb get-item \
  --table-name RDAImageJobs-dev \
  --region us-east-1 \
  --key '{"PK":{"S":"e2e-test-1"},"SK":{"S":"IMAGE#001"}}'
```

---

## 🔄 Alternative Deployment (Without SAM CLI)

If you don't want to install SAM CLI, you can deploy using CloudFormation directly:

```bash
cd /Applications/Gauntlet/creative_refresh_replicate

# Package the Lambda function
cd lambdas/worker
zip -r ../../worker-lambda.zip . -x "*.git*" "node_modules/aws-sdk/*"
cd ../..

# Upload to S3 (create a bucket first if needed)
aws s3 mb s3://rda-deployment-artifacts-273144884273 --region us-east-1

aws s3 cp worker-lambda.zip \
  s3://rda-deployment-artifacts-273144884273/worker-lambda.zip \
  --region us-east-1

# Deploy CloudFormation (requires manual Lambda upload)
# Note: You'll need to modify template.yaml to add Lambda function definitions
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name rda-image-generator-dev \
  --region us-east-1 \
  --parameter-overrides \
    Environment=dev \
    MockMode=false \
  --capabilities CAPABILITY_NAMED_IAM
```

---

## 📊 Post-Deployment Monitoring

### Set up CloudWatch Alarms:
```bash
# Lambda errors alarm
aws cloudwatch put-metric-alarm \
  --alarm-name rda-worker-errors-dev \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=rda-worker-dev \
  --region us-east-1

# DLQ messages alarm
aws cloudwatch put-metric-alarm \
  --alarm-name rda-dlq-messages-dev \
  --alarm-description "Alert on messages in DLQ" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=QueueName,Value=image-generation-dlq-dev \
  --region us-east-1
```

### View CloudWatch Dashboards:
```bash
# Open Lambda metrics
open "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2:graph=~(metrics~(~(~'AWS*2fLambda~'Invocations~(stat~'Sum)~(region~'us-east-1)~(dimensions~(FunctionName~'rda-worker-dev)))))"

# Open Lambda logs
open "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Frda-worker-dev"
```

---

## 💰 Cost Monitoring

```bash
# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +"%Y-%m-01"),End=$(date -u +"%Y-%m-%d") \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1 \
  --output table

# Set up budget alert
aws budgets create-budget \
  --account-id 273144884273 \
  --budget file://budget.json

# budget.json:
cat > budget.json <<EOF
{
  "BudgetName": "RDA-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "50",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF
```

---

## 🔧 Troubleshooting

### Issue: "Secret not found"
```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1

# Create missing secret
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"YOUR_TOKEN"}' \
  --region us-east-1
```

### Issue: "Stack already exists"
```bash
# Update existing stack
sam deploy --region us-east-1

# Or delete and recreate
aws cloudformation delete-stack \
  --stack-name rda-image-generator-dev \
  --region us-east-1

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name rda-image-generator-dev \
  --region us-east-1
```

### Issue: "Insufficient permissions"
```bash
# Check your IAM permissions
aws iam get-user

# You need these permissions:
# - cloudformation:*
# - lambda:*
# - dynamodb:*
# - s3:*
# - sqs:*
# - iam:CreateRole
# - iam:AttachRolePolicy
```

### Issue: "Lambda deployment package too large"
```bash
# Remove unnecessary files
cd lambdas/worker
rm -rf node_modules/aws-sdk  # Already available in Lambda runtime
npm prune --production  # Remove dev dependencies
cd ../..
sam build
```

---

## 📝 Deployment Checklist

- [ ] AWS SAM CLI installed (or using alternative method)
- [ ] API keys stored in Secrets Manager (us-east-1)
- [ ] Secrets verified with `list-secrets` command
- [ ] SAM build completed successfully
- [ ] SAM deploy completed successfully
- [ ] Stack status is `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- [ ] DynamoDB table exists and is `ACTIVE`
- [ ] S3 bucket exists and is accessible
- [ ] SQS queue exists
- [ ] Lambda function exists and state is `Active`
- [ ] Lambda test successful
- [ ] End-to-end test via SQS successful
- [ ] CloudWatch logs show successful image generation
- [ ] Image appears in S3 bucket
- [ ] DynamoDB record created correctly
- [ ] CloudWatch alarms configured
- [ ] Billing alerts configured

---

## 🎯 Expected Results

After successful deployment, you should see:

**CloudFormation Outputs:**
```
DynamoDBTableName: RDAImageJobs-dev
S3BucketName: rda-images-dev-273144884273
SQSQueueURL: https://sqs.us-east-1.amazonaws.com/273144884273/image-generation-queue-dev
ReplicateSecretArn: arn:aws:secretsmanager:us-east-1:273144884273:secret:rda-generator/replicate-token-dev-xxxxx
OpenAISecretArn: arn:aws:secretsmanager:us-east-1:273144884273:secret:rda-generator/openai-api-key-dev-xxxxx
WorkerRoleArn: arn:aws:iam::273144884273:role/rda-worker-role-dev
```

**Lambda Logs (successful image generation):**
```
Worker Lambda starting in REAL mode
Processing 1 messages in REAL mode
Processing image img-001 for job test-job-1
Prompt enhanced: "A sunset" -> "A breathtaking sunset over a tranquil beach..."
Initializing Replicate client for FLUX Schnell model...
Replicate client initialized successfully
Calling Replicate API with params: {...}
Replicate API generation completed in 2341ms
Downloaded image: 425678 bytes
Real image generated in 2341ms using Replicate API
Processing image...
Validating image with Rekognition...
Uploading to S3...
Successfully processed img-001 in 3456ms (cost: $0.003)
```

---

**Ready to deploy? Run these commands:**

```bash
# 1. Install SAM CLI (if not already installed)
brew install aws-sam-cli

# 2. Store secrets
# Copy the commands from Step 2 above

# 3. Deploy
cd /Applications/Gauntlet/creative_refresh_replicate
sam build
sam deploy --guided --region us-east-1

# 4. Test
# Copy the test commands from Step 5 above
```

**Need help?** Check the troubleshooting section or reach out to the team!
