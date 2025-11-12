# RDA Image Generation System - Team Setup Guide

Quick setup guide for the team working on the RDA Image Generation project.

---

## 🎯 Project Overview

**What is this?**
An AWS Lambda-based system that generates high-quality advertising images using AI (Replicate FLUX Schnell + OpenAI prompt enhancement).

**Key Stats:**
- **Cost:** $0.003 per image (91% cheaper than previous Gemini solution)
- **Speed:** 1-3 seconds per image
- **Quality:** High-quality, photorealistic images
- **Region:** US-EAST-1 (N. Virginia)

---

## 🚀 Quick Start for Developers

### Prerequisites
- AWS CLI installed and configured
- Node.js 20.x
- Access to AWS account: **273144884273**
- Replicate API token
- OpenAI API key (optional)

### 1. Clone and Install

```bash
git clone <repository-url>
cd creative_refresh_replicate

# Install dependencies
npm install
cd lambdas/worker
npm install
cd ../..
```

### 2. Set Up Local Environment

```bash
# Run automated setup
./setup-env.sh

# Edit .env.local and add your API keys
nano .env.local
```

**Required API Keys:**
- Replicate: https://replicate.com/account/api-tokens
- OpenAI: https://platform.openai.com/api-keys

### 3. Test Locally (Free)

```bash
cd lambdas/worker

# Test in mock mode (no API calls, completely free)
export MOCK_MODE=true
node -e "require('./index').handler({Records:[]})"

# Expected output:
# ✅ Mock image generated successfully!
# ✅ Prompt enhancement working!
```

---

## 🏗️ Architecture

```
User Request
    ↓
Controller Lambda
    ↓
Prompt Builder Lambda (enhances prompt with OpenAI)
    ↓
SQS Queue
    ↓
Worker Lambda (generates image with Replicate FLUX)
    ↓
S3 (stores image) + DynamoDB (stores metadata)
```

**AWS Resources (us-east-1):**
- **S3 Bucket:** `rda-images-dev-273144884273`
- **DynamoDB:** `RDAImageJobs-dev`
- **SQS Queue:** `image-generation-queue-dev`
- **Lambda:** `rda-worker-dev`

---

## 📁 Project Structure

```
creative_refresh_replicate/
├── lambdas/
│   └── worker/                    # Image generation worker
│       ├── index.js              # Main Lambda handler
│       ├── utils/
│       │   ├── config.js         # Config for local/Lambda
│       │   ├── promptEnhancer.js # OpenAI integration
│       │   └── mockGenerator.js  # Mock image generation
│       └── package.json          # Dependencies
├── template.yaml                  # CloudFormation template
├── .env.local.example            # Environment template
├── setup-env.sh                  # Automated setup script
└── docs/                         # Documentation
    ├── QUICK_START.md
    ├── SETUP_GUIDE.md
    ├── SETUP_US_EAST_1.md
    └── DEPLOYMENT_STEPS.md
```

---

## 🔧 Development Workflow

### Local Development

```bash
# 1. Make changes to code
vim lambdas/worker/index.js

# 2. Test locally (free)
cd lambdas/worker
export MOCK_MODE=true
node -e "require('./index').handler({Records:[]})"

# 3. Test with real APIs (costs money!)
export MOCK_MODE=false
node -e "require('./index').handler({Records:[...]})"
```

### Testing Modes

| Mode | Cost | Use Case |
|------|------|----------|
| **Mock Mode** | $0 | Free testing, no API calls |
| **Real Mode (dev)** | ~$0.003/image | Testing with actual APIs |
| **Production** | ~$0.003/image | Live traffic |

---

## 📦 Deployment

### Deploy to Dev (us-east-1)

```bash
# 1. Install SAM CLI
brew install aws-sam-cli

# 2. Build
sam build

# 3. Deploy
sam deploy --region us-east-1 --parameter-overrides Environment=dev

# 4. Test
aws lambda invoke \
  --function-name rda-worker-dev \
  --region us-east-1 \
  --payload '{"Records":[...]}' \
  response.json
```

See `DEPLOYMENT_STEPS.md` for complete deployment instructions.

---

## 🔐 Secrets Management

### Local Development
Secrets are stored in `.env.local` (never commit this file!)

### AWS Lambda
Secrets are stored in AWS Secrets Manager:
- `rda-generator/replicate-token-dev`
- `rda-generator/openai-api-key-dev`

### Access Secrets

```bash
# View secret
aws secretsmanager get-secret-value \
  --secret-id "rda-generator/replicate-token-dev" \
  --region us-east-1

# Update secret
aws secretsmanager update-secret \
  --secret-id "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"r8_new_token"}' \
  --region us-east-1
```

---

## 🧪 Testing

### Unit Tests (Coming Soon)
```bash
cd lambdas/worker
npm test
```

### Integration Tests

```bash
# Test full pipeline via SQS
aws sqs send-message \
  --region us-east-1 \
  --queue-url "https://sqs.us-east-1.amazonaws.com/273144884273/image-generation-queue-dev" \
  --message-body '{
    "job_id": "test-1",
    "customer_id": "test",
    "image_id": "img-001",
    "image_index": 0,
    "aspect_ratio": "1:1",
    "prompt": "A beautiful sunset"
  }'

# Monitor logs
aws logs tail /aws/lambda/rda-worker-dev --region us-east-1 --follow
```

---

## 📊 Monitoring

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/rda-worker-dev --region us-east-1 --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/rda-worker-dev \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### CloudWatch Metrics
- Lambda invocations
- Lambda errors
- Lambda duration
- SQS queue depth
- DynamoDB read/write capacity

### Cost Monitoring
```bash
# Check Replicate usage
open https://replicate.com/account/billing

# Check OpenAI usage
open https://platform.openai.com/usage

# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +"%Y-%m-01"),End=$(date -u +"%Y-%m-%d") \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --region us-east-1
```

---

## 🐛 Troubleshooting

### Common Issues

**"REPLICATE_API_TOKEN not set"**
- Solution: Add token to `.env.local`

**"ResourceNotFoundException" for DynamoDB**
- Solution: Deploy the stack first (`sam deploy`)

**"Access Denied" errors**
- Solution: Check IAM permissions, ensure you're using correct AWS profile

**"Secrets not found"**
- Solution: Create secrets in Secrets Manager (see DEPLOYMENT_STEPS.md)

**Lambda timeout**
- Solution: Check CloudWatch logs, verify Replicate API is responding

---

## 💰 Cost Breakdown

### Per Image
- **Replicate (FLUX Schnell):** $0.003
- **OpenAI (prompt enhancement):** $0.0001
- **AWS (Lambda, S3, DynamoDB):** < $0.0001
- **Total:** ~$0.0031 per image

### Monthly Estimate (10,000 images)
- **Replicate:** $30
- **OpenAI:** $1
- **AWS:** ~$5
- **Total:** ~$36/month

### Comparison
- **Before (Gemini):** $400/month
- **After (Replicate):** $36/month
- **Savings:** $364/month (91%)

---

## 📚 Documentation

- **QUICK_START.md** - Get started quickly
- **SETUP_GUIDE.md** - Complete setup instructions
- **SETUP_US_EAST_1.md** - US-EAST-1 specific guide
- **DEPLOYMENT_STEPS.md** - Deployment instructions
- **REPLICATE_MIGRATION.md** - Migration from Gemini

---

## 🤝 Team Collaboration

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "Add feature: description"

# 3. Push and create PR
git push origin feature/your-feature-name
```

### Code Review Checklist
- [ ] Tests pass locally
- [ ] No secrets committed
- [ ] CloudWatch logs clean
- [ ] Cost impact considered
- [ ] Documentation updated

---

## 🔒 Security Best Practices

1. **Never commit `.env.local`** - It's in .gitignore
2. **Rotate API keys regularly** - Every 90 days minimum
3. **Use least privilege** - Only request necessary permissions
4. **Monitor usage** - Set up billing alerts
5. **Separate environments** - Use different keys for dev/staging/prod

---

## 📞 Support & Resources

**Internal:**
- Team Slack: #rda-image-generation
- AWS Account: 273144884273
- Region: us-east-1

**External:**
- Replicate Docs: https://replicate.com/docs
- OpenAI Docs: https://platform.openai.com/docs
- AWS Lambda: https://docs.aws.amazon.com/lambda/

---

## 🎓 Onboarding Checklist

For new team members:

- [ ] AWS CLI installed and configured
- [ ] Access to AWS account 273144884273
- [ ] Replicate account created
- [ ] OpenAI account created (optional)
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] `.env.local` created and configured
- [ ] Local test passed (mock mode)
- [ ] Read all documentation
- [ ] Understand architecture
- [ ] Know where logs are
- [ ] Know how to deploy

---

## 🚀 Getting Help

1. **Check documentation first** - Most answers are in the docs
2. **Check CloudWatch logs** - Often shows the exact error
3. **Ask in Slack** - #rda-image-generation
4. **Check AWS console** - Verify resources exist
5. **Test in mock mode** - Isolate the issue

---

**Welcome to the team! Happy coding! 🎉**
