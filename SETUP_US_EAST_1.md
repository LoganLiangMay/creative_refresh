# Quick Setup Guide - US-EAST-1 (N. Virginia)

Complete setup instructions for deploying to **us-east-1** to match your team's infrastructure.

---

## 🚀 Automated Setup (Recommended)

The fastest way to get started:

```bash
# 1. Run the automated setup script
./setup-env.sh

# 2. Edit .env.local and add your API keys
nano .env.local

# Add these lines:
REPLICATE_API_TOKEN=r8_your_NEW_token_here
OPENAI_API_KEY=sk_your_NEW_key_here

# 3. Test locally (free)
cd lambdas/worker
export MOCK_MODE=true
node -e "require('./index').handler({Records:[]})"
```

---

## 📝 Manual Setup

If you prefer to set up manually:

### Step 1: Get Your AWS Account ID

```bash
aws sts get-caller-identity --query Account --output text
```

This will return something like: `123456789012`

### Step 2: Create `.env.local`

```bash
cp .env.local.example .env.local
```

### Step 3: Fill in AWS Configuration

Edit `.env.local`:

```env
# ============================================================================
# AWS Configuration - US-EAST-1
# ============================================================================

# Your AWS credentials (get from: aws configure get aws_access_key_id)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# AWS Resources (replace YOUR_ACCOUNT_ID with actual account ID)
AWS_S3_BUCKET_NAME=rda-images-dev-YOUR_ACCOUNT_ID
DYNAMODB_TABLE=RDAImageJobs-dev
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/image-generation-queue-dev

# ============================================================================
# API Keys (REQUIRED - rotate the exposed keys first!)
# ============================================================================

# Get from: https://replicate.com/account/api-tokens
REPLICATE_API_TOKEN=r8_your_NEW_token_here

# Get from: https://platform.openai.com/api-keys (optional)
OPENAI_API_KEY=sk_your_NEW_key_here

# ============================================================================
# Application Settings
# ============================================================================

ENVIRONMENT=dev
MOCK_MODE=true
ENABLE_PROMPT_ENHANCEMENT=true
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=debug
IS_LOCAL_DEV=true
```

**Example with real values:**

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1

# AWS Resources (Account ID: YOUR_ACCOUNT_ID)
AWS_S3_BUCKET_NAME=rda-images-dev-YOUR_ACCOUNT_ID
DYNAMODB_TABLE=RDAImageJobs-dev
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/image-generation-queue-dev

# API Keys
REPLICATE_API_TOKEN=r8_YOUR_REPLICATE_TOKEN
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_API_KEY...

# App Settings
ENVIRONMENT=dev
MOCK_MODE=true
ENABLE_PROMPT_ENHANCEMENT=true
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=debug
IS_LOCAL_DEV=true
```

---

## 🔐 AWS Lambda Deployment (US-EAST-1)

For AWS Lambda, store secrets in Secrets Manager in **us-east-1**:

### Step 1: Create Secrets

```bash
# Replicate token
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --description "Replicate API token for RDA image generation" \
  --secret-string '{"token":"r8_YOUR_NEW_TOKEN_HERE"}' \
  --region us-east-1

# OpenAI key
aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-dev" \
  --description "OpenAI API key for prompt enhancement" \
  --secret-string '{"api_key":"sk-YOUR_NEW_KEY_HERE"}' \
  --region us-east-1
```

### Step 2: Verify Secrets

```bash
# List secrets in us-east-1
aws secretsmanager list-secrets --region us-east-1

# Test retrieval
aws secretsmanager get-secret-value \
  --secret-id "rda-generator/replicate-token-dev" \
  --region us-east-1
```

### Step 3: Deploy CloudFormation Stack

```bash
# Build
sam build

# Deploy to us-east-1
sam deploy \
  --region us-east-1 \
  --parameter-overrides \
    Environment=dev \
    MockMode=false

# Or use guided deployment
sam deploy --guided --region us-east-1
```

**During guided deployment, make sure to set:**
- Stack Name: `rda-image-generator-dev`
- Region: `us-east-1`
- Parameter Environment: `dev`
- Parameter MockMode: `false`

### Step 4: Verify Deployment

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name rda-image-generator-dev \
  --region us-east-1

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name rda-image-generator-dev \
  --query 'Stacks[0].Outputs' \
  --region us-east-1 \
  --output table
```

---

## 🧪 Testing

### Local Testing (Free with Mock Mode)

```bash
cd lambdas/worker

# Test with mock mode (no API calls)
export MOCK_MODE=true
export IS_LOCAL_DEV=true

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
}).then(result => console.log('✅ Success:', result))
  .catch(err => console.error('❌ Error:', err));
"
```

### Local Testing with Real APIs

```bash
# ⚠️ This will cost money!
export MOCK_MODE=false
export IS_LOCAL_DEV=true

# Make sure .env.local has your API keys
node -e "
require('dotenv').config({ path: '../../.env.local' });
const handler = require('./index').handler;
handler({
  Records: [{
    body: JSON.stringify({
      job_id: 'real-test-1',
      customer_id: 'test-customer',
      image_id: 'img-real-001',
      image_index: 0,
      aspect_ratio: '1:1',
      prompt: 'Professional photo of a modern office workspace'
    })
  }]
}).then(result => console.log('✅ Success:', result))
  .catch(err => console.error('❌ Error:', err));
"
```

### Lambda Testing

```bash
# Invoke Lambda in us-east-1
aws lambda invoke \
  --function-name rda-worker-dev \
  --region us-east-1 \
  --payload '{
    "Records": [{
      "body": "{\"job_id\":\"lambda-test-1\",\"customer_id\":\"test\",\"image_id\":\"img-001\",\"image_index\":0,\"aspect_ratio\":\"1:1\",\"prompt\":\"A beautiful sunset\"}"
    }]
  }' \
  response.json

cat response.json
```

### End-to-End Testing via SQS

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Send message to SQS in us-east-1
aws sqs send-message \
  --region us-east-1 \
  --queue-url "https://sqs.us-east-1.amazonaws.com/${ACCOUNT_ID}/image-generation-queue-dev" \
  --message-body '{
    "job_id": "e2e-test-1",
    "customer_id": "test-customer",
    "image_id": "img-e2e-001",
    "image_index": 0,
    "aspect_ratio": "1:1",
    "prompt": "Modern minimalist interior design"
  }'

# Check Lambda logs
aws logs tail /aws/lambda/rda-worker-dev \
  --region us-east-1 \
  --follow
```

---

## 📊 Resource Locations in US-EAST-1

After deployment, your resources will be in **us-east-1**:

| Resource | Name/URL Pattern |
|----------|-----------------|
| **DynamoDB** | `RDAImageJobs-dev` |
| **S3 Bucket** | `rda-images-dev-{ACCOUNT_ID}` |
| **SQS Queue** | `image-generation-queue-dev` |
| **SQS DLQ** | `image-generation-dlq-dev` |
| **Lambda** | `rda-worker-dev` |
| **Secrets** | `rda-generator/replicate-token-dev`<br>`rda-generator/openai-api-key-dev` |
| **CloudWatch Logs** | `/aws/lambda/rda-worker-dev` |

All in region: **us-east-1**

---

## 🔍 Verification Commands

```bash
# Set region variable
export AWS_REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Check DynamoDB table
aws dynamodb describe-table \
  --table-name RDAImageJobs-dev \
  --region $AWS_REGION

# Check S3 bucket
aws s3 ls s3://rda-images-dev-${ACCOUNT_ID} --region $AWS_REGION

# Check SQS queue
aws sqs get-queue-url \
  --queue-name image-generation-queue-dev \
  --region $AWS_REGION

# Check Lambda function
aws lambda get-function \
  --function-name rda-worker-dev \
  --region $AWS_REGION

# Check secrets
aws secretsmanager list-secrets \
  --region $AWS_REGION \
  --query 'SecretList[?starts_with(Name, `rda-generator/`)].Name'
```

---

## 🌍 Why US-EAST-1?

**Advantages of us-east-1 (N. Virginia):**
- ✅ Most AWS services launch here first
- ✅ Lowest pricing for most services
- ✅ Best availability zone coverage (6 AZs)
- ✅ Matches your team's existing infrastructure
- ✅ Lowest latency for US East Coast

**Trade-offs:**
- ⚠️ Occasional service outages affect more customers
- ⚠️ Slightly higher competition for resources

---

## 🚨 Security Checklist for US-EAST-1

Before deploying to production:

- [ ] **Rotate ALL exposed credentials** (Replicate, OpenAI, AWS)
- [ ] **Enable CloudTrail** in us-east-1 for audit logging
- [ ] **Set up billing alerts** for us-east-1 resources
- [ ] **Enable S3 bucket encryption** (already configured in template)
- [ ] **Enable DynamoDB Point-in-Time Recovery** (optional)
- [ ] **Configure VPC** for Lambda (optional, for enhanced security)
- [ ] **Set up AWS Config** to monitor compliance
- [ ] **Enable GuardDuty** in us-east-1
- [ ] **Use separate AWS accounts** for dev/staging/prod (best practice)

---

## 💰 Cost Monitoring for US-EAST-1

```bash
# Check current month costs for us-east-1
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +"%Y-%m-01"),End=$(date -u +"%Y-%m-%d") \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter file://filter.json \
  --region us-east-1

# Create filter.json:
cat > filter.json <<EOF
{
  "Dimensions": {
    "Key": "REGION",
    "Values": ["us-east-1"]
  }
}
EOF
```

**Set up billing alerts:**
```bash
# Create SNS topic for billing alerts
aws sns create-topic \
  --name rda-billing-alerts \
  --region us-east-1

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:${ACCOUNT_ID}:rda-billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-1
```

---

## 🔄 Migrating Between Regions

If you need to move to a different region later:

```bash
# 1. Update .env.local
sed -i '' 's/us-east-1/us-east-2/g' .env.local

# 2. Recreate secrets in new region
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"r8_TOKEN"}' \
  --region us-east-2

# 3. Deploy to new region
sam deploy --region us-east-2

# 4. Migrate S3 data (if needed)
aws s3 sync \
  s3://rda-images-dev-${ACCOUNT_ID} \
  s3://rda-images-dev-${ACCOUNT_ID} \
  --source-region us-east-1 \
  --region us-east-2
```

---

## 📞 Support

**AWS Support:**
- Service Health Dashboard: https://health.aws.amazon.com/health/status
- US-EAST-1 Status: https://health.aws.amazon.com/health/status?region=us-east-1

**API Services:**
- Replicate Status: https://status.replicate.com/
- OpenAI Status: https://status.openai.com/

---

## ✅ Quick Start Checklist

- [ ] Run `./setup-env.sh`
- [ ] Add Replicate token to `.env.local`
- [ ] Add OpenAI key to `.env.local` (optional)
- [ ] Test locally with `MOCK_MODE=true`
- [ ] Create secrets in AWS Secrets Manager (us-east-1)
- [ ] Deploy with `sam deploy --region us-east-1`
- [ ] Test Lambda function
- [ ] Monitor CloudWatch logs
- [ ] Set up billing alerts
- [ ] Document for team

---

**You're all set for us-east-1!** 🚀
