# Quick Start - RDA Image Generation

## 🚨 CRITICAL FIRST STEP - ROTATE ALL CREDENTIALS! 🚨

**You exposed production credentials in our conversation. You MUST rotate them immediately:**

### 1. Rotate Replicate Token
- Go to: https://replicate.com/account/api-tokens
- Delete the exposed token
- Create new token

### 2. Rotate OpenAI Key
- Go to: https://platform.openai.com/api-keys
- Revoke the exposed key
- Create new key

### 3. Rotate AWS Credentials (if from this project)
- Go to IAM Console → Security Credentials
- Delete exposed access key
- Create new key pair

### 4. Check for Unauthorized Usage
Monitor all services for any suspicious activity from the exposed credentials.

---

## ✅ What's Been Set Up

### Local Development
- ✅ `.env.local.example` - Template for your local config
- ✅ `.gitignore` - Already configured to exclude secrets
- ✅ Config helper - Works for both local and Lambda

### Dependencies Installed
- ✅ `replicate` - For image generation
- ✅ `openai` - For prompt enhancement
- ✅ `langchain` + `@langchain/openai` - For multi-asset processing
- ✅ `dotenv` - For local environment variables

### AWS Infrastructure
- ✅ Replicate secret placeholder in CloudFormation
- ✅ OpenAI secret placeholder in CloudFormation
- ✅ IAM permissions updated for both secrets
- ✅ Worker Lambda ready for deployment

### Features Implemented
- ✅ **Replicate Integration** - FLUX Schnell model for image generation
- ✅ **OpenAI Prompt Enhancement** - Automatic prompt optimization
- ✅ **Dual Environment Support** - Same code runs locally and in Lambda
- ✅ **Prompt Metadata Tracking** - Stores original and enhanced prompts in DynamoDB
- ✅ **Cost Tracking** - Logs costs per image

---

## 🚀 Quick Start (After Rotating Credentials)

### For Local Development

```bash
# 1. Copy environment template
cp .env.local.example .env.local

# 2. Edit with your NEW credentials
nano .env.local

# 3. Add your credentials:
REPLICATE_API_TOKEN=r8_YOUR_NEW_TOKEN
OPENAI_API_KEY=sk-YOUR_NEW_KEY
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# 4. Test in mock mode (free)
cd lambdas/worker
export MOCK_MODE=true
node -e "require('./index').handler({Records:[]})"
```

### For AWS Lambda Deployment

```bash
# 1. Store NEW credentials in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"r8_YOUR_NEW_TOKEN"}' \
  --region us-east-2

aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-dev" \
  --secret-string '{"api_key":"sk-YOUR_NEW_KEY"}' \
  --region us-east-2

# 2. Deploy
sam build
sam deploy --parameter-overrides Environment=dev MockMode=false

# 3. Test
aws lambda invoke \
  --function-name rda-worker-dev \
  --payload '{"Records":[{"body":"test"}]}' \
  response.json
```

---

## 📁 New Files Created

1. **`.env.local.example`** - Template for local configuration
2. **`lambdas/worker/utils/config.js`** - Config helper for local/Lambda
3. **`lambdas/worker/utils/promptEnhancer.js`** - OpenAI prompt enhancement
4. **`SETUP_GUIDE.md`** - Complete setup documentation
5. **`REPLICATE_MIGRATION.md`** - Migration from Gemini to Replicate
6. **`QUICK_START.md`** - This file

---

## 💰 Cost Breakdown

### Per Image (Real Mode)
- **Replicate (FLUX Schnell):** ~$0.003
- **OpenAI (gpt-4o-mini):** ~$0.0001 (if prompt enhancement enabled)
- **Total:** ~$0.0031 per image

### Monthly Estimate (10,000 images)
- **Replicate:** $30
- **OpenAI:** $1
- **AWS (S3, DynamoDB, Lambda):** ~$5-10
- **Total:** ~$36-41/month

### Compared to Previous (Gemini)
- **Before:** $400/month (10,000 images @ $0.04)
- **After:** $36/month (10,000 images @ $0.0031)
- **Savings:** $364/month (91% reduction!)

---

## 🧪 Testing Checklist

Before deploying to production:

- [ ] Rotated ALL exposed credentials
- [ ] Created `.env.local` with NEW credentials
- [ ] Tested locally with `MOCK_MODE=true` ✅ Free
- [ ] Tested locally with `MOCK_MODE=false` 💰 Costs money
- [ ] Created AWS Secrets with NEW credentials
- [ ] Deployed CloudFormation stack
- [ ] Tested Lambda with mock mode
- [ ] Tested Lambda with real APIs
- [ ] Verified images appear in S3
- [ ] Verified metadata in DynamoDB
- [ ] Checked prompt enhancement works
- [ ] Monitored costs in Replicate/OpenAI dashboards
- [ ] Set up AWS billing alerts

---

## 🎯 Feature Overview

### 1. Image Generation (Replicate)
- **Model:** FLUX Schnell by Black Forest Labs
- **Speed:** 1-3 seconds per image
- **Quality:** High-quality, photorealistic
- **Aspect Ratios:** 1:1 (square), 16:9 (landscape/banner)

### 2. Prompt Enhancement (OpenAI)
- **Model:** gpt-4o-mini (fast & cheap)
- **Purpose:** Optimize prompts for better image quality
- **Optional:** Can be disabled with `ENABLE_PROMPT_ENHANCEMENT=false`
- **Tracking:** Original and enhanced prompts stored in DynamoDB

### 3. Mock Mode
- **Purpose:** Free testing without API calls
- **Enable:** `MOCK_MODE=true`
- **Output:** Colored placeholder images with metadata

### 4. Dual Environment
- **Local:** Uses `.env.local` for credentials
- **Lambda:** Uses AWS Secrets Manager
- **Same Code:** No changes needed between environments

---

## 🔧 Configuration Files

### `.env.local` (Local Development)
```env
# Required
REPLICATE_API_TOKEN=r8_your_new_token
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Optional
OPENAI_API_KEY=sk_your_new_key
ENABLE_PROMPT_ENHANCEMENT=true
MOCK_MODE=true
```

### AWS Secrets Manager (Lambda)
```bash
# Replicate
aws secretsmanager create-secret \
  --name "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"r8_NEW_TOKEN"}'

# OpenAI
aws secretsmanager create-secret \
  --name "rda-generator/openai-api-key-dev" \
  --secret-string '{"api_key":"sk_NEW_KEY"}'
```

---

## 📚 Documentation

- **`SETUP_GUIDE.md`** - Complete setup guide for local and AWS
- **`REPLICATE_MIGRATION.md`** - Details on Gemini → Replicate migration
- **`.env.local.example`** - Template with all available options
- **`lambdas/worker/utils/config.js`** - Config system implementation
- **`lambdas/worker/utils/promptEnhancer.js`** - Prompt enhancement code

---

## 🆘 Common Issues

### "REPLICATE_API_TOKEN not set"
→ Create `.env.local` from `.env.local.example`

### "Invalid Replicate API token format"
→ Token must start with `r8_`

### "OpenAI not configured"
→ This is just a warning - prompt enhancement is optional

### "Failed to retrieve secret"
→ Create secret in AWS Secrets Manager (see commands above)

---

## 🔐 Security Reminders

1. ✅ **NEVER commit `.env.local` to git** (already in .gitignore)
2. ✅ **Rotate credentials every 90 days**
3. ✅ **Use different credentials for dev/staging/prod**
4. ✅ **Monitor API usage and costs**
5. ✅ **Set up billing alerts**

---

## ⏭️ Next Steps

1. **CRITICAL:** Rotate all exposed credentials ⚠️
2. Set up local development environment
3. Test with mock mode (free)
4. Deploy to AWS dev environment
5. Test with real APIs (costs money)
6. Set up LangChain for multi-asset processing
7. Deploy to staging/production
8. Set up monitoring and alerts

---

## 📞 Support Resources

- **Replicate Docs:** https://replicate.com/docs
- **OpenAI Docs:** https://platform.openai.com/docs
- **AWS Lambda:** https://docs.aws.amazon.com/lambda/
- **LangChain:** https://python.langchain.com/docs/

---

**Ready to start? Follow `SETUP_GUIDE.md` for detailed instructions!**
