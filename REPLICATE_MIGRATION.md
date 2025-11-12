# Gemini to Replicate Migration Summary

## Migration Completed: 2025-11-10

### Overview
Successfully migrated the RDA Image Generation System from Google's Gemini Imagen API to Replicate's FLUX Schnell model.

---

## Changes Made

### 1. Dependencies (`lambdas/worker/package.json`)
- **Added**: `replicate` npm package (JavaScript client)
- **Kept**: `axios` (for downloading images from Replicate CDN)
- **Removed**: Direct Gemini API calls via axios

### 2. Worker Lambda (`lambdas/worker/index.js`)

#### Environment Variables
- **Before**: `GEMINI_SECRET_NAME` = `rda-generator/gemini-api-key-${ENVIRONMENT}`
- **After**: `REPLICATE_SECRET_NAME` = `rda-generator/replicate-token-${ENVIRONMENT}`

#### API Client Initialization
- **Before**: `initializeGemini()` - Retrieved API key from Secrets Manager
- **After**: `initializeReplicate()` - Creates Replicate client instance
  - Parses secret as JSON with `token` field
  - Validates token format (must start with `r8_`)
  - Caches client instance for reuse

#### Image Generation Function
**Before** (`generateRealImage` using Gemini):
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/images/generations`
- Model: `imagen-3.0-generate-002`
- Auth: Bearer token
- Response: Base64 encoded image in JSON
- Cost: ~$0.04 per image

**After** (`generateRealImage` using Replicate):
- Model: `black-forest-labs/flux-schnell`
- Method: `replicate.run()`
- Aspect Ratios:
  - `1.91:1` → `16:9` (closest match)
  - `1:1` → `1:1`
- Output: JPG format, quality 90
- Response: URL to image on Replicate CDN
- Downloads image via axios
- Cost: ~$0.003 per image (**87.5% cheaper!**)

#### Generation Times
- Gemini: ~2-4 seconds
- FLUX Schnell: ~1-3 seconds (similar or faster)

### 3. CloudFormation Template (`template.yaml`)
**Already configured correctly!** No changes needed:
- Secret name: `rda-generator/replicate-token-${Environment}` ✅
- Secret format: `{"token": "r8_PLACEHOLDER_UPDATE_ME"}` ✅
- IAM permissions reference: `!Ref ReplicateAPITokenSecret` ✅

---

## Deployment Steps

### 1. Update Secrets Manager
Replace the Replicate API token secret with your actual token:

```bash
# Get your token from: https://replicate.com/account/api-tokens

# Update dev environment
aws secretsmanager update-secret \
  --secret-id "rda-generator/replicate-token-dev" \
  --secret-string '{"token":"r8_YOUR_ACTUAL_TOKEN_HERE"}'

# Update staging environment (if applicable)
aws secretsmanager update-secret \
  --secret-id "rda-generator/replicate-token-staging" \
  --secret-string '{"token":"r8_YOUR_ACTUAL_TOKEN_HERE"}'

# Update prod environment (if applicable)
aws secretsmanager update-secret \
  --secret-id "rda-generator/replicate-token-prod" \
  --secret-string '{"token":"r8_YOUR_ACTUAL_TOKEN_HERE"}'
```

### 2. Deploy Lambda Functions
```bash
cd lambdas/worker
npm install  # Installs replicate package
cd ../..

# Deploy using SAM or your deployment method
sam build
sam deploy --parameter-overrides Environment=dev MockMode=false
```

### 3. Test the Migration

#### Test in Mock Mode (Free)
```bash
# Mock mode doesn't use Replicate API
./test-real-mode.sh  # If MOCK_MODE=true in env
```

#### Test with Real Replicate API
```bash
# Ensure MOCK_MODE=false
# Send a test job through the API
curl -X POST https://your-api-endpoint.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test-customer",
    "images": [{
      "aspect_ratio": "1:1",
      "prompt": "A beautiful sunset over mountains"
    }]
  }'
```

---

## Key Benefits

### Cost Savings
- **Before**: $0.04 per image (Gemini)
- **After**: $0.003 per image (Replicate FLUX Schnell)
- **Savings**: 87.5% reduction
- **For 10,000 images/month**: Save $370/month!

### Quality
- FLUX Schnell produces high-quality, photorealistic images
- Better prompt adherence
- More artistic control

### Speed
- FLUX Schnell: 1-3 seconds per image
- Similar or faster than Gemini Imagen

### Flexibility
- Easy to switch between models (FLUX Pro, Stable Diffusion, etc.)
- More model options on Replicate platform
- Active model ecosystem

---

## Model Information

### FLUX Schnell
- **Provider**: Black Forest Labs
- **Model ID**: `black-forest-labs/flux-schnell`
- **Type**: Text-to-image generation
- **Supported Aspect Ratios**: 1:1, 16:9, 21:9, 3:2, 2:3, 4:5, 5:4, 3:4, 4:3, 9:16, 9:21
- **Output Formats**: PNG, JPG, WEBP
- **Quality Range**: 0-100
- **Average Generation Time**: 1-3 seconds
- **Cost**: ~$0.003 per generation

### Alternative Models (Future Options)
- **FLUX Pro**: Higher quality, slower (~$0.05/image)
- **Stable Diffusion XL**: Budget option (~$0.001/image)
- **SDXL Lightning**: Ultra-fast (~$0.0005/image)

---

## Testing Checklist

- [ ] Verify Replicate API token is set in Secrets Manager
- [ ] Deploy updated Lambda function with new dependencies
- [ ] Test mock mode (should still work)
- [ ] Test real mode with simple prompt
- [ ] Test both aspect ratios (1:1 and 1.91:1)
- [ ] Verify images are uploaded to S3
- [ ] Check CloudWatch logs for errors
- [ ] Monitor DynamoDB for job completion
- [ ] Verify cost metrics in AWS Cost Explorer

---

## Rollback Plan

If issues occur, rollback is straightforward:

1. **Revert Lambda code**:
   ```bash
   git revert HEAD
   sam build && sam deploy
   ```

2. **Switch back to Gemini secret**:
   - Update environment variable to point to old secret
   - Or rename secrets in Secrets Manager

3. **Restore previous package.json**:
   ```bash
   cd lambdas/worker
   npm uninstall replicate
   npm install  # Restores from package-lock.json
   ```

---

## Configuration Reference

### Environment Variables
```javascript
// Worker Lambda environment variables
ENVIRONMENT=dev|staging|prod
MOCK_MODE=true|false
REPLICATE_SECRET_NAME=rda-generator/replicate-token-${ENVIRONMENT}
DYNAMODB_TABLE=RDAImageJobs-${ENVIRONMENT}
S3_BUCKET=rda-images-${ENVIRONMENT}-${AWS::AccountId}
```

### Replicate API Token Format
- Starts with `r8_`
- Example: `r8_abc123def456ghi789jkl012mno345pqr678`
- Get yours at: https://replicate.com/account/api-tokens

### Secrets Manager JSON Format
```json
{
  "token": "r8_YOUR_TOKEN_HERE"
}
```

---

## Monitoring

### CloudWatch Metrics to Watch
- Lambda execution duration (should be similar or faster)
- Lambda error rate (should remain low)
- SQS message age (should not increase)
- DynamoDB read/write capacity

### CloudWatch Logs - Success Patterns
```
Worker Lambda starting in REAL mode
Initializing Replicate client for FLUX Schnell model...
Replicate client initialized successfully
Calling Replicate API with params: {...}
Replicate API generation completed in XXXXms
Downloading image from: https://replicate.delivery/...
Downloaded image: XXXXXX bytes
Real image generated in XXXXms using Replicate API
Successfully processed image-xxx in XXXXms (cost: $0.003)
```

### CloudWatch Logs - Error Patterns to Watch
```
Failed to initialize Replicate client
Invalid Replicate API token format
Replicate API returned no images
Replicate API failed: [error message]
```

---

## Support & Resources

### Replicate Documentation
- Main Docs: https://replicate.com/docs
- JavaScript Client: https://github.com/replicate/replicate-javascript
- FLUX Schnell Model: https://replicate.com/black-forest-labs/flux-schnell
- API Reference: https://replicate.com/docs/reference/http

### Getting Help
- Replicate Support: support@replicate.com
- Replicate Discord: https://discord.gg/replicate
- GitHub Issues: https://github.com/replicate/replicate-javascript/issues

---

## Next Steps

1. ✅ Code migration complete
2. ⏳ Update Secrets Manager with real Replicate token
3. ⏳ Deploy to dev environment
4. ⏳ Run integration tests
5. ⏳ Monitor for 24-48 hours
6. ⏳ Deploy to staging/prod
7. ⏳ Update cost projections and monitoring dashboards

---

## Files Modified

1. `/lambdas/worker/index.js` - Main worker Lambda logic
2. `/lambdas/worker/package.json` - Added replicate dependency
3. ~~`/template.yaml`~~ - Already configured correctly!

## Migration Status: ✅ COMPLETE

Ready for deployment after updating Secrets Manager with real Replicate API token.
