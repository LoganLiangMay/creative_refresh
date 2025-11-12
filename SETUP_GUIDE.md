# RDA Image Generation System - Setup Guide

Complete guide for setting up both local development and AWS Lambda deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [AWS Lambda Deployment](#aws-lambda-deployment)
4. [Configuration Reference](#configuration-reference)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & API Keys

1. **AWS Account**
   - Access to IAM, Lambda, S3, DynamoDB, Secrets Manager
   - AWS CLI installed and configured

2. **Replicate Account** (Required)
   - Sign up at: https://replicate.com
   - Get API token: https://replicate.com/account/api-tokens
   - Token format: `r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **OpenAI Account** (Optional - for prompt enhancement)
   - Sign up at: https://platform.openai.com
   - Get API key: https://platform.openai.com/api-keys
   - Token format: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Required Software

- Node.js 20.x
- AWS CLI v2
- AWS SAM CLI (for deployment)
- Git

---

## Local Development Setup

### Step 1: Clone & Install Dependencies

```bash
cd /Applications/Gauntlet/creative_refresh_replicate
npm install

# Install worker Lambda dependencies
cd lambdas/worker
npm install
cd ../..
```

### Step 2: Create Local Configuration

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Open and edit with your credentials
nano .env.local  # or use your preferred editor
```

### Step 3: Fill in Your Credentials

Edit `.env.local` with your actual values:

```env
# ============================================================================
# Local Development Configuration
# ============================================================================

# AWS Configuration (for local testing)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-2

# AWS Resources (must match deployed stack)
AWS_S3_BUCKET_NAME=rda-images-dev-YOUR_ACCOUNT_ID
DYNAMODB_TABLE=RDAImageJobs-dev

# Replicate (REQUIRED - after rotating the exposed key)
REPLICATE_API_TOKEN=r8_your_NEW_token_here

# OpenAI (OPTIONAL - for prompt enhancement)
OPENAI_API_KEY=sk-your_NEW_key_here
OPENAI_MODEL=gpt-4o-mini

# Application Settings
ENVIRONMENT=dev
MOCK_MODE=true
ENABLE_PROMPT_ENHANCEMENT=true
LOG_LEVEL=debug
IS_LOCAL_DEV=true
```

**⚠️ NEVER commit `.env.local` to git!** It's already in `.gitignore`.

### Step 4: Test Local Setup

```bash
# Test with mock mode (no API calls)
cd lambdas/worker
MOCK_MODE=true node -e "require('./index').handler({Records:[]})"

# Test with real APIs (costs money)
MOCK_MODE=false node index.js
```

---

## AWS Lambda Deployment

### Step 1: Create AWS Secrets

**IMPORTANT**: First, rotate all exposed credentials!

#### Create Replicate Secret

```bash
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --description "Replicate API token for RDA image generation" \
  --secret-string '{"token":"r8_YOUR_NEW_TOKEN_HERE"}' \
  --region us-east-2
```

#### Create OpenAI Secret (Optional)

```bash
aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-dev" \
  --description "OpenAI API key for prompt enhancement" \
  --secret-string '{"api_key":"sk-YOUR_NEW_KEY_HERE"}' \
  --region us-east-2
```

#### Verify Secrets

```bash
# List secrets
aws secretsmanager list-secrets --region us-east-2

# Test retrieval
aws secretsmanager get-secret-value \
  --secret-id "rda-generator/replicate-token-dev" \
  --region us-east-2
```

### Step 2: Deploy CloudFormation Stack

```bash
# Build the SAM application
sam build

# Deploy to dev environment
sam deploy \
  --parameter-overrides \
    Environment=dev \
    MockMode=false \
  --region us-east-2

# Or use guided deployment
sam deploy --guided
```

### Step 3: Verify Deployment

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name rda-image-generator \
  --region us-east-2

# View outputs
aws cloudformation describe-stacks \
  --stack-name rda-image-generator \
  --query 'Stacks[0].Outputs' \
  --region us-east-2
```

### Step 4: Update Environment-Specific Secrets

For **staging** and **prod** environments:

```bash
# Staging
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-staging" \
  --secret-string '{"token":"r8_STAGING_TOKEN"}' \
  --region us-east-2

aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-staging" \
  --secret-string '{"api_key":"sk-STAGING_KEY"}' \
  --region us-east-2

# Production
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-prod" \
  --secret-string '{"token":"r8_PROD_TOKEN"}' \
  --region us-east-2

aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-prod" \
  --secret-string '{"api_key":"sk-PROD_KEY"}' \
  --region us-east-2
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | No | `dev` | Environment name (dev/staging/prod) |
| `MOCK_MODE` | No | `true` | Enable mock mode for free testing |
| `REPLICATE_API_TOKEN` | Yes* | - | Replicate API token (local only) |
| `OPENAI_API_KEY` | No | - | OpenAI API key (local only) |
| `ENABLE_PROMPT_ENHANCEMENT` | No | `true` | Enable OpenAI prompt enhancement |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model for enhancements |
| `IS_LOCAL_DEV` | No | `false` | Running in local dev mode |
| `LOG_LEVEL` | No | `info` | Logging level (debug/info/warn/error) |
| `DYNAMODB_TABLE` | Yes | - | DynamoDB table name |
| `S3_BUCKET` | Yes | - | S3 bucket for images |

\* Required for real mode (MOCK_MODE=false)

### AWS Secrets Manager Format

**Replicate Token:**
```json
{
  "token": "r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**OpenAI Key:**
```json
{
  "api_key": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Feature Flags

**Mock Mode** (`MOCK_MODE=true`)
- ✅ Free testing
- ✅ No API calls
- ✅ Instant image generation
- ❌ Placeholder images only

**Prompt Enhancement** (`ENABLE_PROMPT_ENHANCEMENT=true`)
- ✅ Better image quality
- ✅ Optimized prompts
- 💰 Small OpenAI cost (~$0.0001 per prompt)
- ⚠️ Requires OpenAI API key

---

## Testing

### Test Locally with Mock Mode

```bash
cd lambdas/worker

# Set environment variables
export MOCK_MODE=true
export DYNAMODB_TABLE=RDAImageJobs-dev
export S3_BUCKET=rda-images-dev-123456789012
export ENVIRONMENT=dev

# Run test
node -e "
const handler = require('./index').handler;
handler({
  Records: [{
    body: JSON.stringify({
      job_id: 'test-job-1',
      customer_id: 'test-customer',
      image_id: 'img-001',
      image_index: 0,
      aspect_ratio: '1:1',
      prompt: 'A beautiful sunset over mountains'
    })
  }]
}).then(result => console.log('Success:', result))
  .catch(err => console.error('Error:', err));
"
```

### Test Locally with Real APIs

```bash
# Make sure you have .env.local configured with real credentials

cd lambdas/worker

# Set environment variables
export MOCK_MODE=false
export ENABLE_PROMPT_ENHANCEMENT=true
export IS_LOCAL_DEV=true

# Run test (this will cost money!)
node -e "
require('dotenv').config({ path: '../../.env.local' });
const handler = require('./index').handler;
handler({
  Records: [{
    body: JSON.stringify({
      job_id: 'test-real-job-1',
      customer_id: 'test-customer',
      image_id: 'img-real-001',
      image_index: 0,
      aspect_ratio: '1:1',
      prompt: 'Professional photo of a modern office workspace'
    })
  }]
}).then(result => console.log('Success:', result))
  .catch(err => console.error('Error:', err));
"
```

### Test in AWS Lambda

```bash
# Invoke Lambda function directly
aws lambda invoke \
  --function-name rda-worker-dev \
  --payload '{
    "Records": [{
      "body": "{\"job_id\":\"test-lambda-1\",\"customer_id\":\"test\",\"image_id\":\"img-001\",\"image_index\":0,\"aspect_ratio\":\"1:1\",\"prompt\":\"A beautiful sunset\"}"
    }]
  }' \
  --region us-east-2 \
  response.json

# View response
cat response.json
```

### Test Full Pipeline

```bash
# Send message to SQS (triggers Lambda automatically)
aws sqs send-message \
  --queue-url https://sqs.us-east-2.amazonaws.com/YOUR_ACCOUNT_ID/image-generation-queue-dev \
  --message-body '{
    "job_id": "pipeline-test-1",
    "customer_id": "test-customer",
    "image_id": "img-pipeline-001",
    "image_index": 0,
    "aspect_ratio": "1:1",
    "prompt": "Modern minimalist interior design"
  }' \
  --region us-east-2
```

---

## Troubleshooting

### Common Issues

#### 1. "REPLICATE_API_TOKEN not set in .env.local"

**Solution:**
```bash
# Make sure .env.local exists and has the token
cat .env.local | grep REPLICATE_API_TOKEN

# If missing, add it:
echo "REPLICATE_API_TOKEN=r8_your_token" >> .env.local
```

#### 2. "Invalid Replicate API token format"

**Solution:**
- Token must start with `r8_`
- Get a new token from: https://replicate.com/account/api-tokens
- Update both `.env.local` AND AWS Secrets Manager

#### 3. "Failed to retrieve secret"

**Solution:**
```bash
# Check if secret exists
aws secretsmanager describe-secret \
  --secret-id "rda-generator/replicate-token-dev" \
  --region us-east-2

# If doesn't exist, create it (see Step 1 above)
```

#### 4. "OpenAI not configured - prompt enhancement disabled"

**Solution:**
- This is a warning, not an error
- Prompt enhancement is optional
- To enable: add OPENAI_API_KEY to `.env.local` or AWS Secrets Manager

#### 5. Local dev not reading .env.local

**Solution:**
```bash
# Make sure IS_LOCAL_DEV is set
export IS_LOCAL_DEV=true

# Or explicitly load dotenv in your test
node -e "require('dotenv').config({ path: '.env.local' }); /* your test code */"
```

#### 6. "Cannot find module './utils/config'"

**Solution:**
```bash
# Make sure you're in the worker directory
cd lambdas/worker

# Reinstall dependencies
npm install
```

### Checking Logs

**Local Development:**
- Logs appear in console

**AWS Lambda:**
```bash
# View CloudWatch logs
aws logs tail /aws/lambda/rda-worker-dev \
  --follow \
  --region us-east-2

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/rda-worker-dev \
  --filter-pattern "ERROR" \
  --region us-east-2
```

### Cost Monitoring

**Check Replicate Usage:**
- Dashboard: https://replicate.com/account/billing

**Check OpenAI Usage:**
- Dashboard: https://platform.openai.com/usage

**Check AWS Costs:**
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +"%Y-%m-01"),End=$(date -u +"%Y-%m-%d") \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --region us-east-1
```

---

## Next Steps

1. ✅ Set up local development environment
2. ✅ Test with mock mode
3. ⏳ Rotate exposed credentials
4. ⏳ Deploy to AWS dev environment
5. ⏳ Test with real APIs
6. ⏳ Set up LangChain for multi-asset processing
7. ⏳ Deploy to staging/production

---

## Security Best Practices

1. **Never commit secrets to git**
   - Use `.env.local` for local dev
   - Use AWS Secrets Manager for Lambda
   - Check `.gitignore` includes `.env*`

2. **Rotate credentials regularly**
   - Rotate every 90 days minimum
   - Rotate immediately if exposed

3. **Use least privilege IAM roles**
   - Lambda roles already configured with minimal permissions
   - Don't add unnecessary permissions

4. **Monitor API usage**
   - Set up billing alerts
   - Review usage weekly
   - Set API rate limits

5. **Separate dev/staging/prod**
   - Use different AWS accounts if possible
   - Use different API tokens per environment
   - Never test with production credentials

---

## Support

- **Replicate:** https://replicate.com/docs
- **OpenAI:** https://platform.openai.com/docs
- **AWS Lambda:** https://docs.aws.amazon.com/lambda/
- **LangChain:** https://python.langchain.com/docs/

For project-specific issues, check:
- `REPLICATE_MIGRATION.md` - Migration details
- `PRD.md` - Product requirements
- CloudWatch Logs - Runtime errors
