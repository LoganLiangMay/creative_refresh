# Gemini API Integration - Quick Reference Guide

## TL;DR - Key Facts

| Aspect | Value |
|--------|-------|
| **API Endpoint** | `https://generativelanguage.googleapis.com/v1beta/openai/images/generations` |
| **Model** | `imagen-3.0-generate-002` |
| **Secret Name** | `rda-generator/gemini-api-key-${ENVIRONMENT}` |
| **Auth Format** | Bearer token (`Authorization: Bearer AIza_...`) |
| **Image Format** | Base64 JSON (b64_json) |
| **Cost** | $0.04 per image |
| **Timeout** | 120 seconds |
| **Supported Ratios** | 1.91:1 (1200x628) and 1:1 (1200x1200) |

---

## Code Locations - Quick Links

### Main API Integration
- **Worker Lambda:** `/lambdas/worker/index.js` (lines 218-291)
- **Function:** `generateRealImage(aspectRatio, prompt, inputImages)`

### Key Functions
- **Initialize API:** `initializeGemini()` (lines 37-63)
- **Process Image:** `processImageBuffer()` (lines 298-335)
- **Validate Image:** `validateImage()` (lines 340-417)

### Configuration
- **Environment Variables:** Lines 21-28
- **Secret Retrieval:** Lines 37-63
- **API Call:** Lines 244-261
- **Response Handling:** Lines 263-280

### Testing
- **Unit Tests:** `/lambdas/worker/tests/unit/worker-final.test.js`
- **Integration Test:** `/test-real-mode.sh`
- **Mock Generator:** `/lambdas/worker/utils/mockGenerator.js`

---

## API Request Structure

```javascript
POST https://generativelanguage.googleapis.com/v1beta/openai/images/generations
Authorization: Bearer AIza_YOUR_API_KEY
Content-Type: application/json

{
    "model": "imagen-3.0-generate-002",
    "prompt": "User prompt + dimension hints",
    "response_format": "b64_json",
    "n": 1
}
```

---

## API Response Structure

```javascript
{
    "data": [
        {
            "b64_json": "base64_encoded_jpeg_data..."
        }
    ]
}
```

---

## Secrets Manager Configuration

### Creation
```bash
aws secretsmanager create-secret \
    --name "rda-generator/gemini-api-key-dev" \
    --secret-string "AIza_actual_key_here"
```

### Environment Variable
```bash
GEMINI_SECRET_NAME=rda-generator/gemini-api-key-dev
```

### Retrieval Code
```javascript
const secretResult = await secretsManager.getSecretValue({
    SecretId: GEMINI_SECRET_NAME
}).promise();
const apiKey = secretResult.SecretString;
```

---

## Request Flow Diagram

```
Message from SQS
    |
    v
parseMessage(image_id, prompt, aspect_ratio)
    |
    v
Check MOCK_MODE
    |
    +--[TRUE]--> MockGenerator.generateImage() --> $0.00
    |
    +--[FALSE]--> generateRealImage()
                    |
                    v
                initializeGemini() [Get API key from Secrets Manager]
                    |
                    v
                enhancePrompt() [Add dimension hints]
                    |
                    v
                axios.post() --> Gemini API (2 min timeout)
                    |
                    v
                validateResponse() [Check structure]
                    |
                    v
                Buffer.from(b64_json, 'base64') [Decode]
                    |
                    v
                processImageBuffer() [Resize, optimize]
                    |
                    v
                validateImage() [Rekognition checks]
                    |
                    v
                uploadToS3() [Store image]
                    |
                    v
                updateDynamoDB() [Record metadata + $0.04 cost]
```

---

## Error Handling

### Common Errors & Fixes

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid Gemini API key format` | Key doesn't start with `AIza` | Verify key from Google AI Studio |
| `Gemini API returned no images` | API response malformed | Check API status, retry |
| `Gemini API response missing b64_json` | Wrong response format | Verify `response_format: "b64_json"` |
| `timeout of 120000ms exceeded` | API taking > 2 minutes | Retry, or increase timeout |

### Error Logging
```javascript
console.error(`Gemini API generation failed after ${generationTime}ms:`, 
              error.response?.data || error.message);
```

---

## Response Validation Checklist

- [ ] `response.data` exists
- [ ] `response.data.data` is an array
- [ ] `response.data.data[0]` has at least one element
- [ ] `response.data.data[0].b64_json` is a string
- [ ] String is valid base64
- [ ] Decoded image is valid JPEG

---

## Cost Tracking

### Per-Image Cost
```javascript
cost = MOCK_MODE ? 0 : 0.04;
```

### DynamoDB Record
```javascript
{
    cost: 0.04,
    generation_time: 1234,      // API response time in ms
    processing_time: 1567,      // Total time including validation
    mock_mode: false,
    total_cost: 0.08            // Job-level sum
}
```

---

## Testing

### Mock Mode (Zero Cost)
```bash
MOCK_MODE=true npm test
```
- Generates SVG-based placeholder images
- Simulates 500-1000ms processing
- Returns $0.00 cost
- No API calls made

### Real Mode (Actual Cost)
```bash
./test-real-mode.sh
```
- Generates 2 real images (~$0.08)
- Auto-restores mock mode after test
- Validates responses
- Downloads sample image

---

## Dependencies

```json
{
  "aws-sdk": "^2.1497.0",      // AWS services
  "axios": "^1.6.0",           // HTTP client for API calls
  "sharp": "^0.33.0",          // Image processing
  "uuid": "^9.0.1"             // ID generation
}
```

---

## Important Notes for Replicate Migration

### Changes Required
1. Update API endpoint URL
2. Change request payload structure
3. Update response parsing (may not be base64)
4. Change secret name pattern
5. Update cost per image
6. Update validation logic if needed

### What Can Stay The Same
- Secrets Manager integration pattern
- Image processing with Sharp
- DynamoDB schema
- S3 storage structure
- Mock mode infrastructure
- Error handling approach

---

## CloudFormation Configuration

### Template File
- **Location:** `/template.yaml`
- **Secret Definition:** Lines 205-220
- **IAM Permissions:** Lines 379-386
- **Worker Role:** Lines 341-413

### Environment Variables at Deploy
```yaml
Globals:
  Function:
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment
        GEMINI_SECRET_NAME: 'rda-generator/gemini-api-key-${ENVIRONMENT}'
        MOCK_MODE: !Ref MockMode
```

---

## Debugging Tips

### Check CloudWatch Logs
```bash
aws logs tail /aws/lambda/rda-worker-dev --follow
```

### Filter for Gemini Errors
```bash
aws logs filter-log-events \
  --log-group-name "/aws/lambda/rda-worker-dev" \
  --filter-pattern "Gemini"
```

### Test API Key
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/openai/images/generations" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"imagen-3.0-generate-002","prompt":"test","response_format":"b64_json","n":1}'
```

### View DynamoDB Records
```bash
aws dynamodb get-item \
  --table-name RDAImageJobs-dev \
  --key '{"PK":{"S":"job_id"},"SK":{"S":"IMAGE#001"}}'
```

---

## Files to Update for Replicate Migration

### Priority 1 (Critical)
1. `/lambdas/worker/index.js` - Replace generateRealImage() function
2. `/template.yaml` - Update secret definitions and IAM
3. `/lambdas/worker/package.json` - Update dependencies if using SDK

### Priority 2 (Important)
4. `/test-real-mode.sh` - Update test parameters
5. `/lambdas/worker/tests/unit/worker-final.test.js` - Update mocks

### Priority 3 (Documentation)
6. `GEMINI_API_MIGRATION_SUMMARY.md` - Document Replicate changes
7. `REAL_MODE_QUICK_COMMANDS.md` - Update with Replicate commands
8. `REAL_MODE_TEST.md` - Update test procedures

---

**Last Updated:** 2024-11-10
**Status:** Ready for Replicate Migration
**Reference:** See GEMINI_API_EXPLORATION_REPORT.md for detailed information

