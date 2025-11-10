# IMPLEMENTATION_GUIDE.md - ENHANCEMENTS

## Instructions

Make these updates to IMPLEMENTATION_GUIDE.md:

1. **Section 5.4 - ADD:** Mock Mode Testing section
2. **Section 7 - ENHANCE:** Expand troubleshooting from 5 to 10 common issues

---

## NEW SECTION 5.4: Mock Mode Testing

*Add this as Section 5.4, right after "5.3 Integration Tests"*

---

### 5.4 Mock Mode Testing

**Purpose:** Test entire pipeline without spending money on Replicate API calls

Mock Mode is the **most important** testing feature. It allows you to verify your entire system works correctly before spending any money on real image generation.

---

#### 5.4.1 Enable Mock Mode

**For Development Environment:**

```bash
# Option 1: Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name rda-generator-worker-dev \
  --environment Variables={
    MOCK_MODE=true,
    DYNAMODB_TABLE=RDAImageJobs-dev,
    S3_BUCKET=rda-images-dev
  } \
  --region us-east-1

# Option 2: Deploy with mock mode parameter
sam deploy \
  --stack-name rda-generator-dev \
  --parameter-overrides Environment=dev MockMode=true

# Verify mock mode is enabled
aws lambda get-function-configuration \
  --function-name rda-generator-worker-dev \
  --query 'Environment.Variables.MOCK_MODE' \
  --output text
# Should output: true
```

---

#### 5.4.2 Mock Mode Test Suite

**Test 1: Single Image Generation (Free)**

```bash
# Create test input file
cat > test-mock-single.json <<EOF
{
  "customer_id": "test_customer_001",
  "user_prompt": "Generate a single RDA image for a tech startup",
  "openai_api_key": "sk-test-YOUR_KEY",
  "generation_config": {
    "max_images": 1
  }
}
EOF

# Generate image
JOB_ID=$(curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d @test-mock-single.json \
  | jq -r '.job_id')

echo "Job ID: $JOB_ID"

# Wait 5 seconds (mock mode is fast!)
sleep 5

# Check results
curl https://YOUR_API_URL/jobs/$JOB_ID | jq '{
  status: .status,
  total_images: .images | length,
  total_cost: .summary.total_cost,
  mock_mode: .images[0].metadata.mock_mode
}'

# Expected output:
# {
#   "status": "completed",
#   "total_images": 1,
#   "total_cost": 0,
#   "mock_mode": true
# }

# ✅ SUCCESS CRITERIA:
# - Job completes in <10 seconds
# - total_cost = 0
# - mock_mode = true
# - Image exists in S3
```

---

**Test 2: Batch Generation (10 Images - Free)**

```bash
# Generate 10 images
cat > test-mock-batch.json <<EOF
{
  "customer_id": "test_customer_001",
  "user_prompt": "Generate RDA images for AI event discovery app",
  "openai_api_key": "sk-test-YOUR_KEY"
}
EOF

# Start job
JOB_ID=$(curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d @test-mock-batch.json \
  | jq -r '.job_id')

# Poll for completion (should be fast with mock mode)
for i in {1..30}; do
  STATUS=$(curl -s https://YOUR_API_URL/jobs/$JOB_ID | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Job completed in $((i * 2)) seconds"
    break
  fi
  echo "Status: $STATUS, waiting..."
  sleep 2
done

# Verify results
curl https://YOUR_API_URL/jobs/$JOB_ID | jq '{
  status: .status,
  total_images: .images | length,
  total_cost: .summary.total_cost,
  landscape_count: [.images[] | select(.aspect_ratio == "1.91:1")] | length,
  square_count: [.images[] | select(.aspect_ratio == "1:1")] | length,
  all_free: [.images[].cost] | all(. == 0)
}'

# Expected output:
# {
#   "status": "completed",
#   "total_images": 10,
#   "total_cost": 0,
#   "landscape_count": 7,
#   "square_count": 3,
#   "all_free": true
# }

# ✅ SUCCESS CRITERIA:
# - Job completes in <20 seconds
# - 10 images generated
# - total_cost = 0
# - Mix of landscape (7) and square (3) images
```

---

**Test 3: Validation Testing (Free)**

```bash
# Test that validation still runs in mock mode
# This verifies the full pipeline works

# Generate test images
JOB_ID=$(curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test_validation",
    "user_prompt": "Test validation pipeline",
    "openai_api_key": "sk-test-YOUR_KEY",
    "generation_config": {"max_images": 3}
  }' | jq -r '.job_id')

# Wait for completion
sleep 10

# Check validation results
curl https://YOUR_API_URL/jobs/$JOB_ID | jq '.images[] | {
  image_id: .image_id,
  validation_passed: .validation.passed,
  dimensions_ok: .validation.checks.dimensions,
  file_size_ok: .validation.checks.file_size,
  nsfw_ok: .validation.checks.nsfw,
  text_ok: .validation.checks.text_amount
}'

# Expected output (for each image):
# {
#   "image_id": "img_001",
#   "validation_passed": true,
#   "dimensions_ok": true,
#   "file_size_ok": true,
#   "nsfw_ok": true,
#   "text_ok": true
# }

# ✅ SUCCESS CRITERIA:
# - All images pass validation
# - All validation checks return true
# - Cost is still $0
```

---

**Test 4: Cost Tracking Verification (Free)**

```bash
# Verify cost tracking works correctly in mock mode

# Generate multiple batches
for i in {1..3}; do
  curl -X POST https://YOUR_API_URL/generate \
    -H "Content-Type: application/json" \
    -d "{
      \"customer_id\": \"test_cost_tracking\",
      \"user_prompt\": \"Batch $i\",
      \"openai_api_key\": \"sk-test-YOUR_KEY\",
      \"generation_config\": {\"max_images\": 5}
    }"
  sleep 15
done

# Check total costs for customer
aws dynamodb query \
  --table-name RDAImageJobs-dev \
  --index-name CustomerIndex \
  --key-condition-expression "customer_id = :cid" \
  --expression-attribute-values '{":cid":{"S":"test_cost_tracking"}}' \
  --projection-expression "job_id,#s,images,summary" \
  --expression-attribute-names '{"#s":"status"}' \
  | jq '.Items[] | {
      job_id: .job_id.S,
      status: .status.S,
      total_cost: .summary.M.total_cost.N
    }'

# Expected output (3 jobs):
# {
#   "job_id": "job_001",
#   "status": "completed",
#   "total_cost": "0"
# }
# {
#   "job_id": "job_002",
#   "status": "completed",
#   "total_cost": "0"
# }
# {
#   "job_id": "job_003",
#   "status": "completed",
#   "total_cost": "0"
# }

# ✅ SUCCESS CRITERIA:
# - 3 jobs completed
# - All costs are 0
# - Cost tracking is working (even though cost is $0)
```

---

**Test 5: Load Testing with Mock Mode (Free)**

```bash
# Test system handles concurrent requests
# This would cost $45 in real mode, but $0 in mock mode!

# Create load test script
cat > load-test-mock.sh <<'EOF'
#!/bin/bash

# Number of concurrent requests
CONCURRENT=10

# Function to generate images
generate() {
  curl -X POST https://YOUR_API_URL/generate \
    -H "Content-Type: application/json" \
    -d "{
      \"customer_id\": \"load_test_${1}\",
      \"user_prompt\": \"Load test batch ${1}\",
      \"openai_api_key\": \"sk-test-YOUR_KEY\",
      \"generation_config\": {\"max_images\": 10}
    }" > /dev/null 2>&1
  echo "Batch ${1} started"
}

# Launch concurrent requests
for i in $(seq 1 $CONCURRENT); do
  generate $i &
done

# Wait for all to complete
wait

echo "✅ All $CONCURRENT batches started"
echo "Total images requested: $((CONCURRENT * 10))"
echo "Cost: \$0 (mock mode)"
EOF

chmod +x load-test-mock.sh

# Run load test
./load-test-mock.sh

# Wait for processing
sleep 30

# Check results
echo "Checking completion status..."
aws dynamodb scan \
  --table-name RDAImageJobs-dev \
  --filter-expression "begins_with(customer_id, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"load_test_"}}' \
  --projection-expression "job_id,#s,summary" \
  --expression-attribute-names '{"#s":"status"}' \
  | jq '[.Items[] | {
      status: .status.S,
      total_cost: .summary.M.total_cost.N
    }] | {
      total_jobs: length,
      completed: [.[] | select(.status == "completed")] | length,
      total_cost: [.[].total_cost | tonumber] | add
    }'

# Expected output:
# {
#   "total_jobs": 10,
#   "completed": 10,
#   "total_cost": 0
# }

# ✅ SUCCESS CRITERIA:
# - All 10 jobs completed
# - 100 images generated
# - Total cost: $0
# - No errors in CloudWatch logs
```

---

#### 5.4.3 Switch to Real Mode

**Only after ALL mock mode tests pass!**

```bash
# Step 1: Disable mock mode
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --environment Variables={MOCK_MODE=false} \
  --region us-east-1

# Step 2: Test with ONLY 1-2 real images (costs ~$0.10)
cat > test-real-validation.json <<EOF
{
  "customer_id": "real_test",
  "user_prompt": "Generate a single high-quality RDA image for validation",
  "openai_api_key": "sk-REAL_KEY",
  "generation_config": {
    "max_images": 2
  }
}
EOF

JOB_ID=$(curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d @test-real-validation.json \
  | jq -r '.job_id')

# Wait for real generation (takes longer: 30-60s per image)
echo "Waiting for real image generation..."
for i in {1..60}; do
  STATUS=$(curl -s https://YOUR_API_URL/jobs/$JOB_ID | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Real images generated in $((i * 2)) seconds"
    break
  fi
  echo "[$i/60] Status: $STATUS, waiting..."
  sleep 2
done

# Verify real mode results
curl https://YOUR_API_URL/jobs/$JOB_ID | jq '{
  status: .status,
  total_images: .images | length,
  total_cost: .summary.total_cost,
  mock_mode: .images[0].metadata.mock_mode,
  replicate_id: .images[0].metadata.replicate_id
}'

# Expected output:
# {
#   "status": "completed",
#   "total_images": 2,
#   "total_cost": 0.09,  # ← Real cost!
#   "mock_mode": false,
#   "replicate_id": "pred_abc123..."  # ← Real Replicate ID
# }

# Download and verify image quality
aws s3 cp s3://rda-images-prod/real_test/$JOB_ID/$(curl -s https://YOUR_API_URL/jobs/$JOB_ID | jq -r '.images[0].image_id')_v1.jpg test-real-image.jpg

# Open image to verify quality
open test-real-image.jpg  # macOS
# or
xdg-open test-real-image.jpg  # Linux

# ✅ SUCCESS CRITERIA:
# - Images look professional and high-quality
# - Dimensions are correct (1200x628 or 1200x1200)
# - No text overlays
# - File size <5MB
# - Cost is accurately tracked (~$0.045 per image)
```

---

#### 5.4.4 Cost Comparison

**Development Testing (2 weeks):**

| Test Scenario | Mock Mode | Real Mode | Savings |
|--------------|-----------|-----------|---------|
| Integration testing (100 images) | $0 | $4.50 | $4.50 |
| Bug fixes & retesting (200 images) | $0 | $9.00 | $9.00 |
| Load testing (300 images) | $0 | $13.50 | $13.50 |
| Validation testing (10 images) | $0 | $0.45 | $0.45 |
| Final real validation (2 images) | — | $0.09 | — |
| **TOTAL** | **$0** | **$27.45** | **$27.36** |

**Bottom Line:** Mock mode saves ~$27 during development! 🎉

---

#### 5.4.5 CI/CD Integration

**Add mock mode testing to your CI/CD pipeline:**

```yaml
# .github/workflows/test.yml (GitHub Actions example)

name: Test RDA Generator

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd lambdas/controller && npm install
          cd ../prompt-builder && npm install
          cd ../worker && npm install
      
      - name: Run unit tests
        run: npm test
      
      - name: Deploy to test environment with Mock Mode
        run: |
          sam deploy \
            --stack-name rda-generator-test \
            --parameter-overrides Environment=test MockMode=true \
            --no-confirm-changeset
      
      - name: Run integration tests (Mock Mode - Free!)
        run: |
          ./tests/integration/test-mock-mode.sh
      
      - name: Verify costs are zero
        run: |
          TOTAL_COST=$(aws dynamodb scan \
            --table-name RDAImageJobs-test \
            --projection-expression "summary" \
            | jq '[.Items[].summary.M.total_cost.N | tonumber] | add')
          
          if [ "$TOTAL_COST" != "0" ]; then
            echo "❌ Expected cost to be 0, got $TOTAL_COST"
            exit 1
          fi
          
          echo "✅ All tests passed with zero cost"
```

---

---

## ENHANCED SECTION 7: Troubleshooting

*Replace existing Section 7 with this enhanced version (10 issues instead of 5)*

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

---

#### Issue 1: "Unable to retrieve Replicate API token from Secrets Manager"

**Error Message:**
```
Error: SecretNotFoundException: Secrets Manager can't find the specified secret.
```

**Cause:** Replicate API token not stored or wrong secret name

**Solution:**
```bash
# Verify secret exists
aws secretsmanager list-secrets \
  --query 'SecretList[?contains(Name, `replicate`)].Name' \
  --output text

# If not found, create it
aws secretsmanager create-secret \
  --name rda-generator/replicate-token-prod \
  --description "Replicate API token for RDA Generator" \
  --secret-string '{"token":"r8_YOUR_REPLICATE_TOKEN"}' \
  --region us-east-1

# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --environment Variables={
    REPLICATE_API_TOKEN_SECRET=rda-generator/replicate-token-prod
  }

# Grant Lambda permission to read secret
aws secretsmanager put-resource-policy \
  --secret-id rda-generator/replicate-token-prod \
  --resource-policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/rda-generator-worker-role"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*"
    }]
  }'
```

---

#### Issue 2: "ValidationError: Dimensions do not match expected aspect ratio"

**Error Message:**
```json
{
  "status": "failed",
  "error": {
    "code": "validation_error",
    "validation": {
      "passed": false,
      "checks": {
        "dimensions": false
      }
    }
  }
}
```

**Cause:** Generated image doesn't match requested aspect ratio (1.91:1 or 1:1)

**Solution:**
```javascript
// This should be caught by the retry logic in Worker Lambda
// If it persists, check:

// 1. Verify nano-banana aspect_ratio parameter is correct
console.log('Requested aspect ratio:', message.aspect_ratio);  // Should be "1.91:1" or "1:1"

// 2. Check resize function
const resizeToExactDimensions = async (imageBuffer, aspectRatio) => {
  const dimensions = aspectRatio === '1.91:1' 
    ? { width: 1200, height: 628 }
    : { width: 1200, height: 1200 };
  
  return sharp(imageBuffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'cover',  // ← Important: 'cover' maintains aspect ratio
      position: 'center'
    })
    .jpeg({ quality: 90 })
    .toBuffer();
};

// 3. If validation still fails, relax tolerance in validation
const dimensionCheck = 
  Math.abs(metadata.width - expectedDimensions.width) <= 10 &&  // ← Increase from 5 to 10 pixels
  Math.abs(metadata.height - expectedDimensions.height) <= 10;
```

**Workaround:**
```bash
# If retries aren't working, adjust prompt to be more explicit
# Add this to the prompt:
"CRITICAL: Image must be exactly 1200x628 pixels. Landscape format. Do not crop or add borders."
```

---

#### Issue 3: "NSFW content detected in generated image"

**Error Message:**
```json
{
  "validation": {
    "passed": false,
    "checks": {
      "nsfw": false
    }
  }
}
```

**Cause:** Rekognition detected explicit content

**Solution:**
```javascript
// 1. Check CloudWatch logs for details
aws logs tail /aws/lambda/rda-generator-worker-prod --follow

// Look for:
// "NSFW check failed: ModerationLabels=[{Name: 'Explicit Nudity', Confidence: 85.3}]"

// 2. Adjust prompt to be more explicit about safe content
const adjustPromptForValidation = (prompt, validation) => {
  if (!validation.checks.nsfw) {
    prompt += "\n\nCRITICAL SAFETY REQUIREMENTS:\n";
    prompt += "- Family-friendly content only\n";
    prompt += "- Safe for work (SFW)\n";
    prompt += "- No nudity, violence, or explicit content\n";
    prompt += "- Professional business appropriate imagery\n";
  }
  return prompt;
};

// 3. Lower Rekognition confidence threshold if false positives
const checkNSFW = async (imageBuffer) => {
  const result = await rekognition.detectModerationLabels({
    Image: { Bytes: imageBuffer },
    MinConfidence: 75  // ← Lower from 60 if too many false positives
  }).promise();
  
  // Only flag truly explicit content
  const explicitLabels = result.ModerationLabels.filter(
    label => label.ParentName === 'Explicit Nudity' || label.Name === 'Graphic Violence'
  );
  
  return explicitLabels.length === 0;
};
```

---

#### Issue 4: "Too much text detected in image"

**Error Message:**
```json
{
  "validation": {
    "passed": false,
    "checks": {
      "text_amount": false
    }
  }
}
```

**Cause:** Image has >10% text coverage (Google RDA limit)

**Solution:**
```javascript
// 1. Add explicit "no text" instructions to prompt
const adjustPromptForValidation = (prompt, validation) => {
  if (!validation.checks.text_amount) {
    prompt += "\n\nCRITICAL TEXT REQUIREMENTS:\n";
    prompt += "- Absolutely NO text overlays\n";
    prompt += "- NO typography of any kind\n";
    prompt += "- NO letters, numbers, or symbols\n";
    prompt += "- NO watermarks or logos\n";
    prompt += "- Visual imagery only\n";
  }
  return prompt;
};

// 2. Check text detection details
const checkTextAmount = async (imageBuffer) => {
  const result = await rekognition.detectText({
    Image: { Bytes: imageBuffer }
  }).promise();
  
  // Log detected text for debugging
  console.log('Detected text:', result.TextDetections.map(t => ({
    text: t.DetectedText,
    type: t.Type,
    confidence: t.Confidence
  })));
  
  // ... rest of validation
};

// 3. If text is from product packaging (unavoidable), adjust threshold
const textCoverageThreshold = 0.15;  // ← Increase from 0.10 to 0.15 (15%)
return textCoverage < textCoverageThreshold;
```

---

#### Issue 5: "DynamoDB throttling / ProvisionedThroughputExceededException"

**Error Message:**
```
ProvisionedThroughputExceededException: The level of configured provisioned throughput for the table was exceeded
```

**Cause:** Too many concurrent writes to DynamoDB

**Solution:**
```bash
# 1. Check current capacity mode
aws dynamodb describe-table \
  --table-name RDAImageJobs-prod \
  --query 'Table.BillingModeSummary.BillingMode'

# If PAY_PER_REQUEST, no action needed (auto-scales)
# If PROVISIONED, switch to on-demand:

aws dynamodb update-table \
  --table-name RDAImageJobs-prod \
  --billing-mode PAY_PER_REQUEST

# 2. If you must use provisioned capacity, increase WCU:
aws dynamodb update-table \
  --table-name RDAImageJobs-prod \
  --provisioned-throughput ReadCapacityUnits=50,WriteCapacityUnits=100

# 3. Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/RDAImageJobs-prod \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --min-capacity 10 \
  --max-capacity 100

aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/RDAImageJobs-prod \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --policy-name WriteAutoScalingPolicy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
    }
  }'
```

---

#### Issue 6: "SQS message visibility timeout exceeded"

**Error Message:**
```
Message processing exceeded visibility timeout of 120 seconds
```

**Cause:** Worker Lambda takes longer than 120s to process image

**Solution:**
```bash
# 1. Increase SQS visibility timeout
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/image-generation-queue \
  --attributes VisibilityTimeout=300

# 2. Increase Lambda timeout
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --timeout 300

# 3. Monitor generation times
aws logs tail /aws/lambda/rda-generator-worker-prod --follow \
  | grep "generation_time_seconds"

# If consistently >180s, investigate:
# - Replicate API slow? Check their status page
# - Large input images? Resize before sending to Replicate
# - Complex prompts? Simplify or optimize
```

---

#### Issue 7: "Lambda cold start causing timeouts"

**Error Message:**
```
Task timed out after 15.00 seconds
```

**Cause:** Controller Lambda cold start takes >15s during initial request

**Solution:**
```bash
# Option 1: Increase Lambda timeout
aws lambda update-function-configuration \
  --function-name rda-generator-controller-prod \
  --timeout 30

# Option 2: Enable provisioned concurrency (costs more)
aws lambda put-provisioned-concurrency-config \
  --function-name rda-generator-controller-prod \
  --provisioned-concurrent-executions 2

# Option 3: Optimize Lambda package size
# Reduce dependencies in lambdas/controller/package.json
npm install --production  # Remove devDependencies
npm prune                 # Remove unused packages

# Option 4: Use Lambda SnapStart (for faster cold starts)
aws lambda update-function-configuration \
  --function-name rda-generator-controller-prod \
  --snap-start ApplyOn=PublishedVersions
```

---

#### Issue 8: "Invalid OpenAI API key"

**Error Message:**
```json
{
  "status": "failed",
  "error": {
    "code": "openai_error",
    "message": "Error code: 401 - Incorrect API key provided"
  }
}
```

**Cause:** Customer provided invalid or expired OpenAI API key

**Solution:**
```javascript
// 1. Validate API key format before using
const validateOpenAIKey = (apiKey) => {
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format. Must start with "sk-"');
  }
  if (apiKey.length < 40) {
    throw new Error('Invalid OpenAI API key length. Key is too short.');
  }
};

// 2. Test API key before starting generation
const testOpenAIKey = async (apiKey) => {
  try {
    const openai = new OpenAI({ apiKey });
    await openai.models.list();  // Simple API call to verify key
    return true;
  } catch (error) {
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your key and try again.');
    }
    throw error;
  }
};

// 3. Add validation to Controller Lambda
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  
  // Validate OpenAI key before creating job
  validateOpenAIKey(body.openai_api_key);
  
  try {
    await testOpenAIKey(body.openai_api_key);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'invalid_api_key',
        message: error.message,
        hint: 'Get your API key from https://platform.openai.com/api-keys'
      })
    };
  }
  
  // Continue with job creation...
};
```

**Tell user:**
```
❌ Error: Invalid OpenAI API key

To fix:
1. Get your API key from https://platform.openai.com/api-keys
2. Make sure it starts with "sk-"
3. Make sure you have GPT-4 access
4. Try again with the correct key
```

---

#### Issue 9: "S3 bucket not found or access denied"

**Error Message:**
```
NoSuchBucket: The specified bucket does not exist
Access Denied: Access to the specified resource is denied
```

**Cause:** S3 bucket not created or Lambda doesn't have permission

**Solution:**
```bash
# 1. Verify bucket exists
aws s3 ls | grep rda-images

# If not found, create it:
aws s3 mb s3://rda-images-prod --region us-east-1

aws s3api put-bucket-encryption \
  --bucket rda-images-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# 2. Check Lambda IAM role permissions
aws iam get-role-policy \
  --role-name rda-generator-worker-role \
  --policy-name S3AccessPolicy

# If not found, attach policy:
aws iam put-role-policy \
  --role-name rda-generator-worker-role \
  --policy-name S3AccessPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::rda-images-prod/*"
    }]
  }'

# 3. Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --environment Variables={S3_BUCKET=rda-images-prod}
```

---

#### Issue 10: "Mock mode not working / Still charging for images"

**Error Message:**
```
Cost tracking shows non-zero costs even though MOCK_MODE=true
```

**Cause:** Mock mode not properly enabled or code not checking flag

**Solution:**
```bash
# 1. Verify mock mode environment variable
aws lambda get-function-configuration \
  --function-name rda-generator-worker-dev \
  --query 'Environment.Variables' \
  | jq

# Should show: "MOCK_MODE": "true"

# 2. Check CloudWatch logs for mock mode confirmation
aws logs tail /aws/lambda/rda-generator-worker-dev --follow

# Look for: "🎭 MOCK MODE: Using test image"
# If you see: "🚀 REAL MODE: Calling Replicate nano-banana"
# Then mock mode is NOT enabled

# 3. Force update environment variable
aws lambda update-function-configuration \
  --function-name rda-generator-worker-dev \
  --environment Variables="{
    \"MOCK_MODE\":\"true\",
    \"DYNAMODB_TABLE\":\"RDAImageJobs-dev\",
    \"S3_BUCKET\":\"rda-images-dev\"
  }"

# 4. Wait 30 seconds for Lambda to update
sleep 30

# 5. Test again
curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test_mock_mode",
    "user_prompt": "Test mock mode",
    "openai_api_key": "sk-test",
    "generation_config": {"max_images": 1}
  }'

# 6. Verify cost is zero
sleep 10
curl https://YOUR_API_URL/jobs/$(LATEST_JOB_ID) | jq '.summary.total_cost'
# Should return: 0

# 7. If still showing costs, check code:
# In lambdas/worker/index.js, verify:
const MOCK_MODE = process.env.MOCK_MODE === 'true';  # ← Must use === 'true'
console.log('Mock Mode:', MOCK_MODE, '(type:', typeof MOCK_MODE, ')');

# Common bug: Using MOCK_MODE directly as boolean
# ❌ if (MOCK_MODE) { ... }  # This checks for string, always true!
# ✅ if (MOCK_MODE === 'true') { ... }  # Correct
```

---

### 7.2 Diagnostic Commands

**Check all Lambda functions:**
```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `rda-generator`)].{Name:FunctionName,Runtime:Runtime,MemorySize:MemorySize,Timeout:Timeout}' \
  --output table
```

**Check DynamoDB table status:**
```bash
aws dynamodb describe-table \
  --table-name RDAImageJobs-prod \
  --query 'Table.{Status:TableStatus,ItemCount:ItemCount,BillingMode:BillingModeSummary.BillingMode}' \
  --output json
```

**Check S3 bucket size:**
```bash
aws s3 ls s3://rda-images-prod --recursive --summarize | tail -2
```

**Check recent Lambda errors:**
```bash
aws logs tail /aws/lambda/rda-generator-worker-prod --since 1h \
  | grep ERROR
```

**Check SQS queue depth:**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/image-generation-queue \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible \
  | jq '.Attributes'
```

---

### 7.3 When to Contact Support

Contact Anthropic/Claude support if:
- Persistent validation failures despite prompt adjustments
- Unusual Replicate API behavior or errors
- Performance degradation over time
- Billing discrepancies

**Before contacting support, gather:**
- Job IDs of failed jobs
- CloudWatch log excerpts
- Error messages
- Timeline of issue occurrence
- Steps to reproduce

---

[Continue with Section 8: Appendix...]
