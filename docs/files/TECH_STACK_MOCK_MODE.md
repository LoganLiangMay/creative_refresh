# TECH_STACK.md - NEW SECTION TO ADD

## Instructions

Add this new subsection to TECH_STACK.md Section 3.3 (Worker Lambda):

**Location:** Insert as Section 3.3.1 - BEFORE the existing "Handler Logic" code  
**Why:** This is the MOST CRITICAL addition - it saves $50-100 during development

---

## ADD TO TECH_STACK.MD Section 3.3: Worker Lambda

*Insert this as Section 3.3.1, right after the configuration details and before the existing handler logic code*

---

### 3.3.1 Mock Mode for Testing

**Purpose:** Enable free, instant testing without calling external APIs

Mock Mode allows you to test the entire image generation pipeline without spending money on Replicate API calls. This is **critical** for development and integration testing.

**Benefits:**
- ✅ **Zero cost:** No Replicate API charges ($0 vs $0.045 per image)
- ✅ **Fast:** 0.5-1s per image instead of 30-60s
- ✅ **Reliable:** No external API dependencies
- ✅ **Deterministic:** Consistent test results
- ✅ **Full pipeline:** Tests validation, S3 upload, DynamoDB writes

---

#### Configuration

**Environment Variable:**
```yaml
Environment:
  MOCK_MODE: false  # Set to 'true' for testing, 'false' for production
```

**Deployment Commands:**

```bash
# Deploy with mock mode (for testing)
sam deploy \
  --stack-name rda-generator-dev \
  --parameter-overrides Environment=dev MockMode=true

# Deploy with real Replicate (for production)
sam deploy \
  --stack-name rda-generator-prod \
  --parameter-overrides Environment=prod MockMode=false
```

---

#### Implementation in Worker Lambda

**Updated `lambdas/worker/index.js`:**

```javascript
// lambdas/worker/index.js
const AWS = require('aws-sdk');
const Replicate = require('replicate');
const axios = require('axios');
const sharp = require('sharp');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const rekognition = new AWS.Rekognition();
const secretsmanager = new AWS.SecretsManager();

// Read Mock Mode from environment
const MOCK_MODE = process.env.MOCK_MODE === 'true';

exports.handler = async (event) => {
  console.log('Worker Lambda - Mock Mode:', MOCK_MODE);
  console.log('Event:', JSON.stringify(event));
  
  // Process SQS messages
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    
    try {
      await processImageGeneration(message, MOCK_MODE);
    } catch (error) {
      console.error('Error processing message:', error);
      throw error; // SQS will retry or move to DLQ
    }
  }
  
  return { statusCode: 200 };
};

/**
 * Process a single image generation
 * @param {Object} message - SQS message with generation parameters
 * @param {boolean} mockMode - Whether to use mock mode
 */
const processImageGeneration = async (message, mockMode) => {
  const startTime = Date.now();
  
  console.log(`Processing image ${message.image_index + 1} for job ${message.job_id}`);
  console.log(`Mock Mode: ${mockMode}`);
  
  // Step 1: Prepare input images (same for both modes)
  const inputImageUrls = await prepareInputImages(message.input_images);
  
  // Step 2: Generate image (MOCK or REAL)
  let output, imageBuffer;
  
  if (mockMode) {
    console.log('🎭 MOCK MODE: Using test image');
    output = await generateMockImage(message);
    imageBuffer = await downloadMockImage(output);
  } else {
    console.log('🚀 REAL MODE: Calling Replicate nano-banana');
    const replicateToken = await getReplicateToken();
    const replicate = new Replicate({ auth: replicateToken });
    
    output = await replicate.run('google-research/nano-banana', {
      input: {
        prompt: message.prompt,
        aspect_ratio: message.aspect_ratio,
        output_format: 'jpg',
        ...(inputImageUrls.length > 0 && { image_input: inputImageUrls })
      }
    });
    
    imageBuffer = await downloadImage(output);
  }
  
  // Step 3: Validate (same for both modes)
  console.log('Validating image...');
  const validation = await validateRDACompliance(imageBuffer, message.aspect_ratio);
  
  if (!validation.passed) {
    throw new ValidationError(
      `Validation failed: ${JSON.stringify(validation)}`,
      validation
    );
  }
  
  // Step 4: Resize to exact dimensions (same for both modes)
  console.log('Resizing image to exact dimensions...');
  const resized = await resizeToExactDimensions(imageBuffer, message.aspect_ratio);
  
  // Step 5: Upload to S3 (same for both modes)
  const s3Key = `${message.customer_id}/${message.job_id}/${message.image_id}_v1.jpg`;
  console.log(`Uploading to S3: ${s3Key}`);
  
  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: resized,
    ContentType: 'image/jpeg',
    Metadata: {
      'mock-mode': mockMode.toString(),
      'job-id': message.job_id,
      'image-id': message.image_id,
      'aspect-ratio': message.aspect_ratio,
      'prompt-hash': hashPrompt(message.prompt)
    }
  }).promise();
  
  const s3Url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
  const generationTime = Math.floor((Date.now() - startTime) / 1000);
  
  // Step 6: Write to DynamoDB (same for both modes, but cost differs)
  console.log('Writing to DynamoDB...');
  await dynamodb.put({
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      PK: message.job_id,
      SK: `IMAGE#${String(message.image_index + 1).padStart(3, '0')}`,
      image_id: message.image_id,
      image_index: message.image_index,
      version: 1,
      s3_url: s3Url,
      aspect_ratio: message.aspect_ratio,
      dimensions: message.aspect_ratio === '1.91:1' ? '1200x628' : '1200x1200',
      prompt: message.prompt,
      status: 'completed',
      validation: validation,
      metadata: {
        mock_mode: mockMode,
        replicate_id: mockMode ? `mock-${Date.now()}` : output,
        replicate_model: 'google-research/nano-banana',
        generation_time_seconds: generationTime,
        retries: message.retry_count || 0
      },
      cost: mockMode ? 0 : 0.045,  // Mock = free, Real = $0.045
      generated_at: new Date().toISOString(),
      created_at: message.created_at || new Date().toISOString()
    }
  }).promise();
  
  // Step 7: Update job progress
  await updateJobProgress(message.job_id, 'completed');
  
  console.log(`✅ Image ${message.image_index + 1} completed in ${generationTime}s`);
  console.log(`   Cost: $${mockMode ? '0.00' : '0.045'}`);
  console.log(`   Mode: ${mockMode ? 'MOCK' : 'REAL'}`);
};

/**
 * Generate mock image URL
 * Returns a placeholder image URL based on aspect ratio
 */
const generateMockImage = async (message) => {
  // Return appropriate placeholder based on aspect ratio
  const mockUrls = {
    '1.91:1': 'https://via.placeholder.com/1200x628/4A90E2/FFFFFF?text=Mock+RDA+Image+1.91:1',
    '1:1': 'https://via.placeholder.com/1200x1200/4A90E2/FFFFFF?text=Mock+RDA+Image+1:1'
  };
  
  // Simulate some processing time (0.5-1s instead of 30-60s)
  await sleep(500 + Math.random() * 500);
  
  return mockUrls[message.aspect_ratio] || mockUrls['1:1'];
};

/**
 * Download mock image from URL
 */
const downloadMockImage = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
};

/**
 * Utility: Sleep for specified milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Prepare input images (convert S3 URLs to HTTP URLs)
 */
const prepareInputImages = async (inputImages) => {
  if (!inputImages || inputImages.length === 0) {
    return [];
  }
  
  // Convert S3 URLs to signed URLs or direct URLs
  const urls = [];
  for (const img of inputImages) {
    if (img.s3_url.startsWith('s3://')) {
      // Generate signed URL
      const bucket = img.s3_url.split('/')[2];
      const key = img.s3_url.split('/').slice(3).join('/');
      
      const signedUrl = await s3.getSignedUrlPromise('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: 3600 // 1 hour
      });
      
      urls.push(signedUrl);
    } else {
      urls.push(img.s3_url);
    }
  }
  
  return urls;
};

/**
 * Get Replicate API token from Secrets Manager
 */
const getReplicateToken = async () => {
  const secretName = process.env.REPLICATE_API_TOKEN_SECRET;
  
  const response = await secretsmanager.getSecretValue({
    SecretId: secretName
  }).promise();
  
  const secret = JSON.parse(response.SecretString);
  return secret.token;
};

/**
 * Download image from URL
 */
const downloadImage = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
};

/**
 * Validate RDA compliance
 */
const validateRDACompliance = async (imageBuffer, aspectRatio) => {
  const metadata = await sharp(imageBuffer).metadata();
  
  // Check dimensions
  const expectedDimensions = aspectRatio === '1.91:1' 
    ? { width: 1200, height: 628 }
    : { width: 1200, height: 1200 };
  
  const dimensionCheck = 
    Math.abs(metadata.width - expectedDimensions.width) <= 10 &&
    Math.abs(metadata.height - expectedDimensions.height) <= 10;
  
  // Check file size
  const fileSizeCheck = imageBuffer.length < 5 * 1024 * 1024; // <5MB
  
  // NSFW check (using Rekognition)
  const nsfwCheck = await checkNSFW(imageBuffer);
  
  // Text detection check
  const textCheck = await checkTextAmount(imageBuffer);
  
  return {
    passed: dimensionCheck && fileSizeCheck && nsfwCheck && textCheck,
    checks: {
      dimensions: dimensionCheck,
      file_size: fileSizeCheck,
      nsfw: nsfwCheck,
      text_amount: textCheck
    },
    metadata: {
      width: metadata.width,
      height: metadata.height,
      file_size: imageBuffer.length,
      format: metadata.format
    }
  };
};

/**
 * Check for NSFW content using AWS Rekognition
 */
const checkNSFW = async (imageBuffer) => {
  try {
    const result = await rekognition.detectModerationLabels({
      Image: { Bytes: imageBuffer },
      MinConfidence: 60
    }).promise();
    
    // Check for explicit content
    const explicitLabels = result.ModerationLabels.filter(
      label => label.ParentName === 'Explicit Nudity' || label.Name === 'Graphic Violence'
    );
    
    return explicitLabels.length === 0;
  } catch (error) {
    console.error('NSFW check failed:', error);
    return true; // Default to passing if check fails
  }
};

/**
 * Check text amount using AWS Rekognition
 */
const checkTextAmount = async (imageBuffer) => {
  try {
    const result = await rekognition.detectText({
      Image: { Bytes: imageBuffer }
    }).promise();
    
    // Calculate total text coverage
    const imageArea = 1200 * (aspectRatio === '1.91:1' ? 628 : 1200);
    const textArea = result.TextDetections.reduce((sum, detection) => {
      if (detection.Type === 'LINE' && detection.Geometry.BoundingBox) {
        const box = detection.Geometry.BoundingBox;
        return sum + (box.Width * box.Height * imageArea);
      }
      return sum;
    }, 0);
    
    const textCoverage = textArea / imageArea;
    
    // Google RDA requires <10% text coverage
    return textCoverage < 0.10;
  } catch (error) {
    console.error('Text detection failed:', error);
    return true; // Default to passing if check fails
  }
};

/**
 * Resize image to exact dimensions
 */
const resizeToExactDimensions = async (imageBuffer, aspectRatio) => {
  const dimensions = aspectRatio === '1.91:1' 
    ? { width: 1200, height: 628 }
    : { width: 1200, height: 1200 };
  
  return sharp(imageBuffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 90 })
    .toBuffer();
};

/**
 * Update job progress in DynamoDB
 */
const updateJobProgress = async (jobId, status) => {
  // This would increment completed count and check if job is done
  // Implementation details in TECH_STACK.md section 3.3
  console.log(`Updated job ${jobId} progress: ${status}`);
};

/**
 * Hash prompt for similarity detection (future use)
 */
const hashPrompt = (prompt) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
};

/**
 * Custom error for validation failures
 */
class ValidationError extends Error {
  constructor(message, validation) {
    super(message);
    this.name = 'ValidationError';
    this.validation = validation;
  }
}
```

---

#### Alternative: Mock Image Generator Module

For better organization, you can create a separate module:

**File: `lambdas/worker/utils/mockGenerator.js`**

```javascript
// lambdas/worker/utils/mockGenerator.js
const sharp = require('sharp');

/**
 * Mock Image Generator
 * Creates RDA-compliant test images without calling Replicate
 */
class MockGenerator {
  /**
   * Generate a mock image
   * @param {string} aspectRatio - "1.91:1" or "1:1"
   * @param {string} prompt - Generation prompt (for display purposes)
   * @param {number} imageIndex - Image number in batch
   * @returns {Promise<Buffer>} - Image buffer (JPEG)
   */
  static async generateImage(aspectRatio, prompt, imageIndex) {
    const dimensions = aspectRatio === '1.91:1' 
      ? { width: 1200, height: 628 }
      : { width: 1200, height: 1200 };
    
    // Create a simple colored rectangle with text overlay
    const svg = `
      <svg width="${dimensions.width}" height="${dimensions.height}">
        <rect width="100%" height="100%" fill="#4A90E2"/>
        <text x="50%" y="30%" text-anchor="middle" font-size="48" fill="white" font-family="Arial, sans-serif" font-weight="bold">
          Mock RDA Image
        </text>
        <text x="50%" y="45%" text-anchor="middle" font-size="36" fill="white" font-family="Arial, sans-serif">
          ${aspectRatio}
        </text>
        <text x="50%" y="55%" text-anchor="middle" font-size="28" fill="white" font-family="Arial, sans-serif">
          Image #${imageIndex + 1}
        </text>
        <text x="50%" y="65%" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif">
          ${dimensions.width}×${dimensions.height}
        </text>
        <text x="50%" y="75%" text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif">
          ${new Date().toISOString()}
        </text>
        <text x="50%" y="85%" text-anchor="middle" font-size="14" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif">
          ${prompt.substring(0, 60)}...
        </text>
      </svg>
    `;
    
    // Convert SVG to JPEG
    return sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toBuffer();
  }
  
  /**
   * Simulate processing delay (like real API call)
   * @param {number} minMs - Minimum delay in milliseconds
   * @param {number} maxMs - Maximum delay in milliseconds
   */
  static async simulateDelay(minMs = 500, maxMs = 1000) {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = MockGenerator;
```

**Usage in Worker Lambda:**

```javascript
const MockGenerator = require('./utils/mockGenerator');

// In processImageGeneration function:
if (mockMode) {
  console.log('🎭 MOCK MODE: Generating test image');
  
  // Simulate API delay
  await MockGenerator.simulateDelay(500, 1000);
  
  // Generate mock image
  imageBuffer = await MockGenerator.generateImage(
    message.aspect_ratio,
    message.prompt,
    message.image_index
  );
} else {
  // ... real Replicate code
}
```

---

#### Testing Mock Mode

**1. Deploy with Mock Mode Enabled:**

```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name rda-generator-worker-dev \
  --environment Variables={MOCK_MODE=true} \
  --region us-east-1
```

**2. Test Image Generation:**

```bash
# Generate 10 test images (cost = $0)
curl -X POST https://your-api-gateway-url/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test_customer",
    "user_prompt": "Generate RDA images for tech startup",
    "openai_api_key": "sk-test-YOUR_KEY_HERE"
  }'

# Response:
{
  "job_id": "job_abc123",
  "status": "queued",
  "status_url": "/jobs/job_abc123",
  "estimated_completion_seconds": 10  # Much faster than 90s!
}
```

**3. Check Job Status:**

```bash
# Poll for completion
curl https://your-api-gateway-url/jobs/job_abc123 | jq

# Response will show:
{
  "job_id": "job_abc123",
  "status": "completed",
  "images": [
    {
      "image_id": "img_001",
      "s3_url": "https://...",
      "cost": 0,  # ← FREE!
      "metadata": {
        "mock_mode": true
      }
    }
    # ... 9 more images, all with cost: 0
  ],
  "summary": {
    "total_cost": 0,  # ← TOTAL COST: $0
    "total_images": 10,
    "avg_generation_time": 0.7
  }
}
```

**4. Verify Costs Are Zero:**

```bash
# Check individual image costs
aws s3 ls s3://rda-images-dev/test_customer/job_abc123/ --recursive

# Query DynamoDB for cost tracking
aws dynamodb query \
  --table-name RDAImageJobs-dev \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"job_abc123"}}' \
  --projection-expression "image_id,cost" \
  | jq '.Items[].cost.N'
# Should show: "0", "0", "0", ... (all zeros)
```

**5. Switch to Real Mode When Ready:**

```bash
# Enable real Replicate calls
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --environment Variables={MOCK_MODE=false} \
  --region us-east-1

# Test with just 1-2 real images (cost ~$0.10)
curl -X POST https://your-api-gateway-url/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test_customer",
    "user_prompt": "Generate RDA images for tech startup",
    "openai_api_key": "sk-REAL-KEY",
    "generation_config": {"max_images": 2}
  }'
```

---

#### Monitoring Mock vs Real Mode

**CloudWatch Logs:**

```
Mock Mode:
2025-11-09T12:00:00.123Z  🎭 MOCK MODE: Using test image
2025-11-09T12:00:00.456Z  Validating image...
2025-11-09T12:00:00.789Z  ✅ Image 1 completed in 0.7s
2025-11-09T12:00:00.790Z     Cost: $0.00
2025-11-09T12:00:00.791Z     Mode: MOCK

Real Mode:
2025-11-09T12:10:00.123Z  🚀 REAL MODE: Calling Replicate nano-banana
2025-11-09T12:10:00.234Z  Replicate request started: pred_abc123
2025-11-09T12:10:45.567Z  Image generated successfully
2025-11-09T12:10:45.789Z  Validating image...
2025-11-09T12:10:46.123Z  ✅ Image 1 completed in 46s
2025-11-09T12:10:46.124Z     Cost: $0.045
2025-11-09T12:10:46.125Z     Mode: REAL
```

---

#### Best Practices

**✅ DO:**
- Use mock mode for ALL development and integration testing
- Use mock mode for load testing (free, fast)
- Test full pipeline with mock mode before enabling real mode
- Switch to real mode only for final validation (1-2 images)
- Use mock mode in CI/CD pipelines
- Document mock mode in integration guide for dispatcher team

**❌ DON'T:**
- Don't use real mode during development (wastes money)
- Don't skip mock mode testing (catches bugs early)
- Don't forget to set MOCK_MODE=false in production
- Don't test with 100 real images (costs $4.50!)
- Don't commit MOCK_MODE=true to production config

---

#### Cost Comparison

**Development Phase (2 weeks):**

```
WITHOUT Mock Mode:
- Integration testing: 100 test images × $0.045 = $4.50
- Bug fixes & retesting: 200 test images × $0.045 = $9.00
- Load testing: 300 test images × $0.045 = $13.50
- Final validation: 10 real images × $0.045 = $0.45
- TOTAL: $27.45

WITH Mock Mode:
- Integration testing: 100 mock images × $0 = $0
- Bug fixes & retesting: 200 mock images × $0 = $0
- Load testing: 300 mock images × $0 = $0
- Final validation: 10 real images × $0.045 = $0.45
- TOTAL: $0.45

SAVINGS: $27.00 🎉
```

---

#### SAM Template Update

Add Mock Mode parameter to your `template.yaml`:

```yaml
Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
  
  MockMode:
    Type: String
    Default: 'true'
    AllowedValues:
      - 'true'
      - 'false'
    Description: Enable mock mode for testing (true) or real Replicate calls (false)

Resources:
  WorkerLambda:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub 'rda-generator-worker-${Environment}'
      Runtime: nodejs20.x
      Handler: index.handler
      Environment:
        Variables:
          MOCK_MODE: !Ref MockMode  # ← Add this
          DYNAMODB_TABLE: !Ref DynamoDBTable
          S3_BUCKET: !Ref S3Bucket
          # ... other environment variables
```

**Deploy Commands:**

```bash
# Development with mock mode
sam deploy \
  --parameter-overrides \
    Environment=dev \
    MockMode=true

# Production with real mode
sam deploy \
  --parameter-overrides \
    Environment=prod \
    MockMode=false
```

---

**Continue with existing Section 3.3 handler logic...**

---

## Summary

Mock Mode is a **critical** feature that:
- Saves $27+ during development
- Speeds up testing (10s vs 90s for 10 images)
- Enables free integration testing
- Reduces external API dependencies
- Maintains full pipeline validation

**Next Steps:**
1. Add this section to TECH_STACK.md Section 3.3 as subsection 3.3.1
2. Update SAM template with MockMode parameter
3. Implement mock mode in Worker Lambda
4. Test with mock mode before any real Replicate calls
5. Document mock mode for dispatcher team (see PRD.md Section 11)
