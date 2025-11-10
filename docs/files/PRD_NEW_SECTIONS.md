# PRD.md - NEW SECTIONS TO ADD

## Instructions

Add these two new sections to your PRD.md:

1. **Section 2: Implementation Roadmap** - Insert AFTER "1. Executive Summary" and BEFORE "2. Product Vision"
   - This will renumber all subsequent sections (Product Vision becomes section 3, etc.)
   - Update Table of Contents accordingly

2. **Section 11: Integration Guide** - Insert AFTER "10. Technical Requirements" and BEFORE "Out of Scope"
   - This becomes the new section 11
   - Update Table of Contents accordingly

---

## NEW SECTION 2: Implementation Roadmap

*Insert this AFTER Section 1 (Executive Summary) and BEFORE current Section 2 (Product Vision)*

---

## 2. Implementation Roadmap

### 2.1 Overview

This system will be built in **3 phases** over 4-6 weeks:
- **Phase 1 (Weeks 1-2):** Core MVP - Image generation pipeline ✅ **IMPLEMENT NOW**
- **Phase 2 (Week 3):** Production hardening & optimization 📋 **NICE TO HAVE**
- **Phase 3 (Weeks 4-6):** Advanced features & enhancements 🌟 **FUTURE**

This roadmap is optimized for a solo developer handing specifications to Claude Code. Each phase has clear deliverables and success criteria.

---

### 2.2 Phase 1: Core Image Generation Pipeline (WEEKS 1-2)

**Status:** 🚀 **IMPLEMENT IMMEDIATELY**  
**Goal:** Working end-to-end RDA image generation  
**Deadline:** 2 weeks from start  
**Build Approach:** Infrastructure first → Controller → Prompt Builder → Worker (with Mock Mode)

#### Build Order for Claude Code:

**Day 1-2: Infrastructure Setup**
```markdown
Task 1.1: Create AWS Infrastructure (2 hours)
├─ DynamoDB table (single-table design, see TECH_STACK.md 4.1)
│  • Table: RDAImageJobs
│  • PK: job_id or customer_id
│  • SK: JOB#metadata, IMAGE#001, INPUT#001
│  • GSI 1: customer_id + created_at
│  • GSI 2: status + created_at
├─ S3 bucket (see TECH_STACK.md 4.2)
│  • Bucket: rda-images-{env}
│  • Encryption: SSE-S3
│  • Lifecycle: 30-day cleanup
│  • Folders: {customer_id}/{job_id}/{image_id}_v{version}.jpg
├─ SQS queue (see TECH_STACK.md 2.1)
│  • Queue: image-generation-queue
│  • Visibility timeout: 120 seconds
│  • Dead letter queue: image-generation-dlq
│  • Max receives: 3
└─ Success Criteria: All resources created, can verify with AWS CLI

Task 1.2: Store Secrets (30 min)
├─ Store Replicate API token in Secrets Manager
│  • Secret name: rda-generator/replicate-token-{env}
│  • Value: {"token": "r8_..."}
├─ Document secret ARN in .env file
└─ Success Criteria: Lambda can retrieve token
```

**Day 3-4: Controller Lambda**
```markdown
Task 1.3: Implement Controller Lambda (4 hours)
├─ Create lambdas/controller/index.js (see TECH_STACK.md 3.1)
│  • Handler: exports.handler
│  • Routes: POST /generate, GET /jobs/{id}, POST /regenerate
│  • Validation: customer_id, user_prompt, openai_api_key required
│  • Response: 202 Accepted with job_id
├─ Request Validation
│  • Check required fields
│  • Validate openai_api_key format (starts with "sk-")
│  • Validate generation_config (if provided)
├─ DynamoDB Operations
│  • Create job record with PK=job_id, SK="JOB#metadata"
│  • Set status: "queued"
│  • Store user_prompt, input_images, config
├─ Async Lambda Invocation
│  • Invoke Prompt Builder Lambda with InvocationType='Event'
│  • Pass job details in payload
└─ Success Criteria: Validates requests, creates jobs, returns 202

Task 1.4: Deploy Controller (1 hour)
├─ Create SAM template for Controller
├─ sam build
├─ sam deploy --guided
│  • Stack name: rda-generator-dev
│  • Environment: dev
│  • Confirm IAM role creation
└─ Success Criteria: Can invoke Controller, job appears in DynamoDB
```

**Day 5-7: Prompt Builder Lambda**
```markdown
Task 1.5: Implement Prompt Builder (6 hours)
├─ Create lambdas/prompt-builder/index.js (see TECH_STACK.md 3.2)
│  • Handler: exports.handler
│  • Dependencies: openai, aws-sdk
├─ OpenAI Integration
│  • Initialize client with customer's API key
│  • Call GPT-4 to analyze user_prompt
│  • Determine: num_images, landscape_count, square_count
│  • Example response: {num_images: 10, landscape: 7, square: 3}
├─ Prompt Generation
│  • Generate refined prompts for each image
│  • Landscape prompts: "Professional product photography... 1.91:1 landscape..."
│  • Square prompts: "Professional product photography... 1:1 square..."
│  • Add RDA-specific instructions (no text overlays, high contrast, etc.)
├─ SQS Message Creation
│  • Create one message per image
│  • Include: job_id, customer_id, image_index, image_id, prompt, aspect_ratio
│  • Batch send to SQS (up to 10 messages at once)
└─ Success Criteria: Receives job, creates SQS messages

Task 1.6: Test Prompt Builder (2 hours)
├─ Unit test with mock OpenAI API
│  • Mock response: {num_images: 3, landscape: 2, square: 1}
│  • Verify 3 SQS messages created
├─ Integration test with real OpenAI (spend $0.05)
│  • Use test API key
│  • Verify prompts are well-formatted
│  • Verify SQS messages contain all required fields
└─ Success Criteria: 10 SQS messages for 10 images, well-formed prompts
```

**Day 8-12: Worker Lambda (MOST IMPORTANT)**
```markdown
Task 1.7: Implement Worker Lambda with Mock Mode FIRST (8 hours)
├─ Create lambdas/worker/index.js (see TECH_STACK.md 3.3)
│  • Handler: exports.handler
│  • Environment variable: MOCK_MODE (true/false)
│  • Dependencies: replicate, aws-sdk, axios, sharp
├─ STEP 1: Implement Mock Mode (SAVES MONEY)
│  • Read MOCK_MODE environment variable
│  • If true: generate instant test images using placeholder service
│  • Mock images: 1200x628 or 1200x1200 colored rectangles with text
│  • Simulate 0.5-1s delay (instead of 30-60s real generation)
│  • Set cost: $0
├─ STEP 2: Image Generation Logic
│  • Parse SQS message
│  • If MOCK_MODE: call generateMockImage()
│  • If !MOCK_MODE: call Replicate nano-banana
│  • Download image to Buffer
├─ STEP 3: Validation
│  • Check dimensions (must match aspect ratio)
│  • AWS Rekognition NSFW check
│  • AWS Rekognition text detection (<10% coverage)
│  • File size check (<5MB)
├─ STEP 4: Resize & Upload
│  • Use sharp to resize to exact dimensions (1200x628 or 1200x1200)
│  • Upload to S3: {customer_id}/{job_id}/{image_id}_v1.jpg
│  • Set metadata: mock-mode, job-id, image-id
├─ STEP 5: DynamoDB Update
│  • Write image record: PK=job_id, SK=IMAGE#{image_index}
│  • Include: s3_url, prompt, validation results, cost (0 or 0.045)
│  • Update job progress count
├─ STEP 6: Cleanup
│  • Delete SQS message
│  • Log completion
└─ Success Criteria: Generates mock images, validates, stores

Task 1.8: Add Real Replicate Integration (4 hours)
├─ Add Replicate client initialization
│  • Retrieve token from Secrets Manager
│  • Initialize: const replicate = new Replicate({auth: token})
├─ Implement real image generation
│  • Call: replicate.run("google/nano-banana", {input: {...}})
│  • Handle input_images if provided (S3 URLs)
│  • Wait for completion (30-60s)
│  • Download output image
├─ Set MOCK_MODE=false for testing
├─ Test with 1-2 images only (costs ~$0.10)
└─ Success Criteria: Generates real images, validation passes

Task 1.9: End-to-End Testing (4 hours)
├─ Test full pipeline with MOCK MODE (free)
│  • Generate 10 images
│  • Verify all images in S3
│  • Verify DynamoDB records
│  • Verify costs are $0
│  • Time: should be <10 seconds total
├─ Test full pipeline with REAL MODE (costs $0.45)
│  • Generate 2 images only
│  • Verify real Replicate images
│  • Verify validation passes
│  • Verify costs are tracked (~$0.09)
│  • Time: should be <90 seconds
└─ Success Criteria: Both modes work, mock is free and fast
```

**Day 13-14: Integration & Documentation**
```markdown
Task 1.10: Dispatcher Integration (2 days)
├─ Provide integration examples (see Section 11 below)
│  • Node.js example
│  • Python example
│  • Error handling patterns
├─ Create test scenarios
│  • Basic text-only generation
│  • Generation with input images
│  • Regeneration workflow
├─ Integration testing with dispatcher team
│  • Share API Gateway URL
│  • Share test customer_id
│  • Share OpenAI test key (optional)
├─ Fix any issues found
└─ Success Criteria: Dispatcher can generate images successfully
```

#### Phase 1 Deliverables:

**Functionality:**
- ✅ Generate 1-20 RDA-compliant images per request
- ✅ Text-only workflow (no user images required yet)
- ✅ Mock mode for testing (free, fast, instant results)
- ✅ Real mode for production (Replicate nano-banana)
- ✅ Async job processing with status polling
- ✅ Cost tracking per customer/job (mock=$0, real=~$0.045/image)

**Infrastructure:**
- ✅ DynamoDB table with 2 GSIs
- ✅ S3 bucket for images
- ✅ SQS queue for worker tasks
- ✅ 3 Lambda functions deployed
- ✅ CloudWatch monitoring

**Documentation:**
- ✅ Integration examples for dispatcher (Node.js + Python)
- ✅ Testing guide (mock + real modes)
- ✅ Deployment scripts

#### Phase 1 Success Criteria:

- [ ] Generate 10 images in <90 seconds (real mode)
- [ ] Generate 10 images in <10 seconds (mock mode)
- [ ] >95% RDA compliance rate
- [ ] <5% failure rate
- [ ] Cost tracking accurate (mock=$0, real=~$0.45/batch of 10)
- [ ] Dispatcher team successfully integrated
- [ ] All tests passing

#### Phase 1 Out of Scope:

❌ User-provided images (no S3 URL input yet)  
❌ Regeneration endpoint (will add in Phase 2)  
❌ Advanced retry logic (basic only: max 3 retries)  
❌ Advanced validation (basic checks only)  
❌ Performance optimization (focus on working first)  
❌ Production hardening (will add in Phase 2)  

---

### 2.3 Phase 2: Production Hardening (WEEK 3)

**Status:** 📋 **NICE TO HAVE - Document for Future**  
**Goal:** Make system production-ready  
**Effort:** 1 week  
**Priority:** Implement only after Phase 1 is complete and tested

#### Features to Add:

**Task 2.1: User-Provided Images (6 hours)**
```markdown
Purpose: Allow users to provide product photos and logos
Implementation:
├─ Update POST /generate to accept input_images array
│  • Schema: [{s3_url: "s3://...", usage: "product"|"logo"}]
├─ Worker Lambda: Download input images from S3
│  • Validate images exist and are accessible
│  • Validate file types (jpg, png)
│  • Validate file sizes (<10MB)
├─ Pass input images to nano-banana
│  • Use image_input parameter
│  • Support img2img workflow
└─ Test with product photos + logos
  • Example: Product photo + brand logo → 10 variations
```

**Task 2.2: Regeneration Endpoint (4 hours)**
```markdown
Purpose: Allow users to edit prompts and regenerate specific images
Implementation:
├─ Implement POST /regenerate (see TECH_STACK.md 3.1)
│  • Input: image_id, new_prompt, openai_api_key
│  • Retrieve original image record from DynamoDB
│  • Extract input_images from original job
│  • Create new Worker SQS message with edited prompt
├─ Version tracking
│  • Original: image_id_v1
│  • Regenerated: image_id_v2, image_id_v3, etc.
│  • Store parent_id in DynamoDB
└─ Test iterative editing workflow
  • Generate image → Edit prompt → Regenerate → Edit again
```

**Task 2.3: Advanced Retry Logic (3 hours)**
```markdown
Purpose: Improve reliability with smarter retries
Implementation:
├─ Exponential backoff (2s, 4s, 8s delays)
├─ Max 3 retries per image
├─ Dead letter queue for permanent failures
├─ Adjust prompts based on validation failures
│  • If NSFW detected: add "family-friendly, safe-for-work" to prompt
│  • If text detected: add "NO text overlays, NO typography" to prompt
└─ Test with intentionally bad prompts
  • Verify retries happen
  • Verify prompt adjustments work
```

**Task 2.4: Rate Limiting (2 hours)**
```markdown
Purpose: Prevent abuse and control costs
Implementation:
├─ Per-customer rate limits (100 requests/minute)
├─ DynamoDB-based tracking
│  • Table: CustomerRateLimits
│  • Track: requests per minute, requests per hour
├─ Return 429 Too Many Requests when exceeded
├─ Add retry-after header
└─ Test with burst traffic
  • Send 150 requests in 1 minute
  • Verify first 100 succeed, rest get 429
```

**Task 2.5: Load Testing (4 hours)**
```markdown
Purpose: Verify system handles concurrent load
Implementation:
├─ Use Artillery or similar tool
├─ Test with Mock Mode first (free)
│  • 100 concurrent requests
│  • 300 total images
│  • Verify: no errors, <10s total time
├─ Test with Real Mode (costs ~$30)
│  • 10 concurrent requests
│  • 30 total images
│  • Verify: <5% error rate, <120s total time
├─ Identify bottlenecks
│  • Check Lambda concurrency limits
│  • Check SQS throughput
│  • Check DynamoDB throttling
└─ Optimize based on results
  • Increase Lambda memory if needed
  • Increase Lambda timeout if needed
  • Enable DynamoDB auto-scaling
```

**Task 2.6: Production Deployment (2 hours)**
```markdown
Purpose: Deploy to production environment
Implementation:
├─ Deploy to prod environment
│  • sam deploy --parameter-overrides Environment=prod
│  • Create separate prod DynamoDB table
│  • Create separate prod S3 bucket
│  • Set MOCK_MODE=false
├─ Configure CloudWatch alarms
│  • Lambda error rate >5%
│  • Replicate API failure >10%
│  • Average generation time >120s
│  • Daily cost >$50
├─ Set up monitoring dashboard
│  • Jobs per hour
│  • Images per hour
│  • Cost per hour
│  • Error rate
└─ Success Criteria: Production system operational, monitoring working
```

#### Phase 2 Success Criteria:

- [ ] Support user-provided images (product photos + logos)
- [ ] Regeneration workflow working
- [ ] <2% failure rate (after retries)
- [ ] Handle 100 concurrent requests
- [ ] Rate limiting prevents abuse
- [ ] Production monitoring operational
- [ ] Load testing shows acceptable performance

---

### 2.4 Phase 3: Advanced Features (WEEKS 4-6)

**Status:** 🌟 **FUTURE - Scope for Later**  
**Goal:** Enhanced capabilities  
**Effort:** 2-3 weeks  
**Priority:** Implement based on user feedback and business needs

#### Features to Consider:

**3.1 Prompt Optimization Engine (1 week)**
```markdown
Purpose: Learn from regenerations, improve prompts over time
Implementation:
├─ Track which prompts get regenerated
│  • Store regeneration rate per prompt pattern
│  • Store user edits to prompts
├─ A/B test prompt variations
│  • Generate same image with 2 different prompts
│  • Track which gets regenerated less
├─ Use reinforcement learning to optimize
│  • Reward: low regeneration rate
│  • Penalty: high regeneration rate
│  • Continuously improve prompt templates
└─ Measure success: Lower regeneration rate (<10%)
```

**3.2 Smart Caching (3 days)**
```markdown
Purpose: Detect similar prompts, reuse images, reduce costs
Implementation:
├─ Hash prompts for similarity
│  • Use embedding models (OpenAI embeddings)
│  • Calculate cosine similarity
│  • Threshold: >0.95 = same prompt
├─ Cache results for 7 days
│  • Store: prompt_hash → [image_ids]
│  • DynamoDB table: PromptCache
├─ Return cached images for near-duplicates
│  • If prompt is >95% similar to cached
│  • Return cached images instead of generating new
│  • Update metadata: is_cached=true
└─ Measure success: 15-20% cost reduction
```

**3.3 Batch Operations (2 days)**
```markdown
Purpose: Edit multiple images at once
Implementation:
├─ POST /bulk-regenerate endpoint
│  • Input: array of {image_id, new_prompt}
│  • Process in parallel
├─ Accept array of edits
│  • Example: [{image_id: "img_1", new_prompt: "darker"}, ...]
├─ Create SQS messages in batch
│  • One message per image to edit
└─ Measure success: 5x faster than sequential regenerations
```

**3.4 Quality Scoring (1 week)**
```markdown
Purpose: Predict which images will perform best
Implementation:
├─ ML model to score images (0-100)
│  • Train on historical performance data
│  • Features: composition, color, contrast, clarity
├─ Factors to consider
│  • Visual composition (rule of thirds, balance)
│  • Color harmony (complementary colors)
│  • Contrast (high contrast = better visibility)
│  • Clarity (sharpness, focus)
├─ Return score with each image
│  • Add quality_score field to response
│  • Sort images by score (highest first)
└─ Measure success: Correlation with CTR >0.7
```

**3.5 Multi-Platform Expansion (2 weeks)**
```markdown
Purpose: Support Meta, TikTok, LinkedIn ads
Implementation:
├─ Add platform-specific image specs
│  • Meta: 1.91:1, 1:1, 4:5, 9:16
│  • TikTok: 9:16 (vertical only)
│  • LinkedIn: 1.91:1, 1:1
├─ Platform-specific prompt templates
│  • Meta: More visual, lifestyle-focused
│  • TikTok: Vertical, mobile-first, dynamic
│  • LinkedIn: Professional, B2B-focused
├─ Platform-specific validation
│  • Different text coverage limits
│  • Different NSFW thresholds
└─ Measure success: Support 3+ platforms
```

**3.6 Style Transfer (1 week)**
```markdown
Purpose: Maintain consistent style across batch
Implementation:
├─ Extract style from reference image
│  • User provides reference image
│  • Extract: color palette, lighting, composition
├─ Apply style to all generated images
│  • Use nano-banana style transfer features
│  • Maintain consistency across 10 images
├─ Style parameters
│  • Color palette (hex codes)
│  • Lighting (soft/dramatic/natural)
│  • Composition (centered/rule-of-thirds)
└─ Measure success: >90% style consistency across batch
```

**3.7 Advanced Analytics (4 days)**
```markdown
Purpose: Track performance, costs, usage patterns
Implementation:
├─ Daily/weekly/monthly reports
│  • Total images generated
│  • Cost breakdown by customer
│  • Most common prompts
│  • Failure analysis
├─ Cost breakdown by customer
│  • DynamoDB table: CustomerUsage
│  • Track: monthly spend, image count
│  • Alerts when customer exceeds budget
├─ Most common prompts
│  • Track prompt patterns
│  • Identify which industries/use cases are popular
├─ Failure analysis
│  • Which prompts fail most often
│  • Which validation checks fail most
│  • Root cause analysis
└─ Dashboard in CloudWatch or Grafana
  • Real-time metrics
  • Historical trends
  • Cost forecasting
```

#### Phase 3 Prioritization:

**High Value, Low Effort (do first):**
1. Smart Caching (saves money immediately)
2. Batch Operations (saves time for users)

**High Value, High Effort (do next):**
3. Prompt Optimization Engine (improves quality over time)
4. Quality Scoring (helps users pick best images)

**Medium Value:**
5. Advanced Analytics (nice insights for business)
6. Style Transfer (niche use case, but powerful)

**Low Priority (only if demand exists):**
7. Multi-Platform (only if customers request it)

---

### 2.5 Timeline Summary

```
Week 1-2:  Phase 1 - Core Pipeline ✅ IMPLEMENT NOW
           • Infrastructure + 3 Lambdas + Mock Mode + Integration
           • Deliverable: Working end-to-end system
           • Cost: $0 (mock mode) + $0.10 (validation)

Week 3:    Phase 2 - Production Hardening 📋 NICE TO HAVE
           • User images + Regeneration + Retry logic + Rate limiting
           • Deliverable: Production-ready system
           • Cost: ~$30 (load testing)

Week 4-6:  Phase 3 - Advanced Features 🌟 FUTURE SCOPE
           • Pick features based on user feedback
           • Deliverable: Enhanced capabilities
           • Cost: Varies by feature

Total MVP: 2 weeks
Total Production-Ready: 3 weeks
Total All Features: 6 weeks
```

### 2.6 How to Use This Roadmap with Claude Code

**Step 1: Implement Phase 1 Only (Start Here)**
```
You: "Implement Phase 1 from PRD.md section 2. 
     Follow the build order exactly:
     Start with Task 1.1 (Infrastructure).
     Reference TECH_STACK.md for implementation details.
     CRITICAL: Implement Mock Mode in Worker Lambda (Task 1.7) 
     BEFORE adding real Replicate integration (Task 1.8)."
```

**Step 2: After Phase 1 Works**
```
You: "Phase 1 is complete and tested. 
     Now implement Phase 2, Task 2.1 (User-Provided Images).
     Reference PRD.md section 4.2 for requirements."
```

**Step 3: Pick Phase 3 Features as Needed**
```
You: "Implement Phase 3, Task 3.1 (Prompt Optimization).
     This is a new feature, create new Lambda function."
```

**Step 4: Always Verify**
```
After each task:
1. Test with Mock Mode (free)
2. Test with Real Mode (1-2 images only)
3. Verify costs are tracked correctly
4. Check CloudWatch logs for errors
```

---

[Continue with current Section 2 (Product Vision) as new Section 3...]

---

---

## NEW SECTION 11: Integration Guide for External Dispatcher

*Insert this AFTER current Section 10 (Technical Requirements) and BEFORE "Out of Scope"*

---

## 11. Integration Guide for External Dispatcher

### 11.1 Quick Start Integration

**Dispatcher team: Copy this code to get started**

This section provides complete, production-ready code examples for integrating with the RDA Image Generation API. The API is designed to be simple to integrate with any HTTP/JSON-capable system.

---

#### Node.js Integration

**File: `dispatcher-integration.js`**

```javascript
// dispatcher-integration.js
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });
const FUNCTION_NAME = 'rda-generator-controller-prod';

/**
 * Generate RDA images
 * @param {Object} input - Generation parameters
 * @returns {Promise<Object>} - Job details with job_id
 */
async function generateRDAImages(input) {
  const command = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: JSON.stringify(input),
  });

  const response = await lambda.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.Payload));
  
  // Parse the Lambda response
  if (payload.statusCode !== 202) {
    throw new Error(`API Error: ${payload.statusCode} - ${payload.body}`);
  }
  
  return JSON.parse(payload.body);
}

/**
 * Poll for job completion
 * @param {string} jobId - Job ID from generateRDAImages
 * @param {number} maxWaitSeconds - Maximum time to wait (default: 180s)
 * @returns {Promise<Object>} - Complete job with all images
 */
async function waitForJobCompletion(jobId, maxWaitSeconds = 180) {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds
  
  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > maxWaitSeconds) {
      throw new Error(`Timeout: Job ${jobId} did not complete in ${maxWaitSeconds}s`);
    }
    
    const job = await getJobStatus(jobId);
    
    if (job.status === 'completed') {
      return job;
    } else if (job.status === 'failed') {
      throw new Error(`Job failed: ${JSON.stringify(job.error)}`);
    }
    
    // Still processing, wait and poll again
    console.log(`Job ${jobId}: ${job.progress.completed}/${job.progress.total} images done`);
    await sleep(pollInterval);
  }
}

/**
 * Get job status
 * @param {string} jobId
 * @returns {Promise<Object>}
 */
async function getJobStatus(jobId) {
  const command = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: JSON.stringify({
      httpMethod: 'GET',
      path: `/jobs/${jobId}`,
    }),
  });

  const response = await lambda.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.Payload));
  return JSON.parse(payload.body);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// USAGE EXAMPLES
// ============================================================

// Example 1: Basic text-only generation
async function example1_basicGeneration() {
  console.log('Example 1: Basic text-only generation');
  
  const result = await generateRDAImages({
    customer_id: 'dispatcher_customer_001',
    user_prompt: 'Generate RDA images for AI-powered event discovery app called Local Clubhouse. Modern, clean, tech-forward style targeting young urban professionals.',
    openai_api_key: process.env.OPENAI_API_KEY
  });
  
  console.log(`Job created: ${result.job_id}`);
  console.log(`Status URL: ${result.status_url}`);
  
  // Wait for completion
  const job = await waitForJobCompletion(result.job_id);
  
  console.log(`Generated ${job.images.length} images`);
  job.images.forEach((img, i) => {
    console.log(`Image ${i + 1}: ${img.s3_url}`);
    console.log(`  Aspect ratio: ${img.aspect_ratio}`);
    console.log(`  Prompt: ${img.prompt.substring(0, 100)}...`);
  });
  
  console.log(`Total cost: $${job.summary.total_cost}`);
}

// Example 2: Generation with user-provided images
async function example2_withUserImages() {
  console.log('Example 2: Generation with product photo + logo');
  
  const result = await generateRDAImages({
    customer_id: 'dispatcher_customer_001',
    user_prompt: 'Generate 15 RDA images showcasing our sneaker product in dynamic athletic scenes',
    openai_api_key: process.env.OPENAI_API_KEY,
    input_images: [
      {
        s3_url: 's3://customer-uploads/dispatcher_customer_001/sneaker-photo.jpg',
        usage: 'product'
      },
      {
        s3_url: 's3://customer-uploads/dispatcher_customer_001/brand-logo.png',
        usage: 'logo'
      }
    ],
    generation_config: {
      max_images: 15
    }
  });
  
  const job = await waitForJobCompletion(result.job_id, 240); // Allow 4 minutes for 15 images
  console.log(`Generated ${job.images.length} images with product consistency`);
}

// Example 3: Regenerate specific image with edited prompt
async function example3_regeneration() {
  console.log('Example 3: Regenerate image with edited prompt');
  
  // First, generate initial batch
  const initialResult = await generateRDAImages({
    customer_id: 'dispatcher_customer_001',
    user_prompt: 'Generate RDA images for tech startup',
    openai_api_key: process.env.OPENAI_API_KEY
  });
  
  const job = await waitForJobCompletion(initialResult.job_id);
  
  // User wants to edit image #3
  const imageToEdit = job.images[2];
  console.log(`Original prompt: ${imageToEdit.prompt}`);
  
  // Regenerate with darker background
  const regenCommand = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: JSON.stringify({
      httpMethod: 'POST',
      path: '/regenerate',
      body: JSON.stringify({
        customer_id: 'dispatcher_customer_001',
        image_id: imageToEdit.image_id,
        new_prompt: imageToEdit.prompt.replace('light', 'DARK') + ' Moody lighting, dramatic shadows.',
        openai_api_key: process.env.OPENAI_API_KEY
      })
    }),
  });
  
  const regenResponse = await lambda.send(regenCommand);
  const regenPayload = JSON.parse(new TextDecoder().decode(regenResponse.Payload));
  const regenData = JSON.parse(regenPayload.body);
  
  console.log(`Regeneration started: ${regenData.regeneration_id}`);
  console.log(`New image will be: ${regenData.new_image_id}`);
}

// ============================================================
// ERROR HANDLING
// ============================================================

async function robustGeneration(input) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      const result = await generateRDAImages(input);
      const job = await waitForJobCompletion(result.job_id);
      return job;
      
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (error.message.includes('rate limit') || error.message.includes('throttle')) {
        // Rate limited - wait with exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
        
      } else if (error.message.includes('invalid') || error.message.includes('400')) {
        // Invalid input - don't retry, fix the input
        console.error('Invalid input. Please check request format.');
        throw error;
        
      } else if (attempt >= MAX_RETRIES) {
        // Max retries reached
        console.error('Max retries reached. Giving up.');
        throw error;
        
      } else {
        // Unknown error - wait and retry
        console.log(`Unknown error. Retrying in 5s...`);
        await sleep(5000);
      }
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

export {
  generateRDAImages,
  waitForJobCompletion,
  getJobStatus,
  robustGeneration
};
```

---

#### Python Integration

**File: `dispatcher_integration.py`**

```python
# dispatcher_integration.py
import boto3
import json
import time
import os
from typing import Dict, List, Optional

lambda_client = boto3.client('lambda', region_name='us-east-1')
FUNCTION_NAME = 'rda-generator-controller-prod'

def generate_rda_images(input_data: Dict) -> Dict:
    """
    Generate RDA images
    
    Args:
        input_data: Generation parameters
        
    Returns:
        Job details with job_id
    """
    response = lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        Payload=json.dumps(input_data)
    )
    
    payload = json.loads(response['Payload'].read())
    
    if payload['statusCode'] != 202:
        raise Exception(f"API Error: {payload['statusCode']} - {payload['body']}")
    
    return json.loads(payload['body'])


def wait_for_job_completion(job_id: str, max_wait_seconds: int = 180) -> Dict:
    """
    Poll for job completion
    
    Args:
        job_id: Job ID from generate_rda_images
        max_wait_seconds: Maximum time to wait
        
    Returns:
        Complete job with all images
    """
    start_time = time.time()
    poll_interval = 10  # seconds
    
    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait_seconds:
            raise TimeoutError(f"Job {job_id} did not complete in {max_wait_seconds}s")
        
        job = get_job_status(job_id)
        
        if job['status'] == 'completed':
            return job
        elif job['status'] == 'failed':
            raise Exception(f"Job failed: {json.dumps(job.get('error'))}")
        
        # Still processing
        progress = job.get('progress', {})
        print(f"Job {job_id}: {progress.get('completed', 0)}/{progress.get('total', 0)} images done")
        time.sleep(poll_interval)


def get_job_status(job_id: str) -> Dict:
    """Get job status"""
    response = lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        Payload=json.dumps({
            'httpMethod': 'GET',
            'path': f'/jobs/{job_id}'
        })
    )
    
    payload = json.loads(response['Payload'].read())
    return json.loads(payload['body'])


# ============================================================
# USAGE EXAMPLES
# ============================================================

def example1_basic_generation():
    """Example 1: Basic text-only generation"""
    print("Example 1: Basic text-only generation")
    
    result = generate_rda_images({
        'customer_id': 'dispatcher_customer_001',
        'user_prompt': 'Generate RDA images for AI event app Local Clubhouse. Modern tech style.',
        'openai_api_key': os.environ['OPENAI_API_KEY']
    })
    
    print(f"Job created: {result['job_id']}")
    
    # Wait for completion
    job = wait_for_job_completion(result['job_id'])
    
    print(f"Generated {len(job['images'])} images")
    for i, img in enumerate(job['images']):
        print(f"Image {i+1}: {img['s3_url']}")
        print(f"  Aspect ratio: {img['aspect_ratio']}")
    
    print(f"Total cost: ${job['summary']['total_cost']}")


def example2_with_error_handling():
    """Example 2: Robust generation with error handling"""
    max_retries = 3
    attempt = 0
    
    while attempt < max_retries:
        try:
            result = generate_rda_images({
                'customer_id': 'dispatcher_customer_001',
                'user_prompt': 'Generate RDA images',
                'openai_api_key': os.environ['OPENAI_API_KEY']
            })
            
            job = wait_for_job_completion(result['job_id'])
            return job
            
        except Exception as error:
            attempt += 1
            print(f"Attempt {attempt} failed: {str(error)}")
            
            if 'rate limit' in str(error).lower():
                # Rate limited - exponential backoff
                backoff_seconds = 2 ** attempt
                print(f"Rate limited. Retrying in {backoff_seconds}s...")
                time.sleep(backoff_seconds)
                
            elif attempt >= max_retries:
                print("Max retries reached. Giving up.")
                raise
                
            else:
                time.sleep(5)


if __name__ == '__main__':
    # Run examples
    example1_basic_generation()
```

---

### 11.2 Common Integration Issues

#### Issue 1: Invalid OpenAI API Key

**Error:**
```json
{
  "status": "failed",
  "error": {
    "code": "openai_error",
    "message": "Error code: 401 - Invalid API key"
  }
}
```

**Solution:**
```javascript
// Validate OpenAI key before calling API
async function validateOpenAIKey(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Use in your code
if (!await validateOpenAIKey(openaiKey)) {
  throw new Error('Invalid OpenAI API key. Please check and try again.');
}
```

---

#### Issue 2: Lambda Invocation Timeout

**Error:**
```
Task timed out after 30 seconds
```

**Cause:** Trying to wait for job completion in single Lambda invocation

**Solution:** Use async pattern - don't wait in Lambda invocation
```javascript
// ❌ WRONG - Don't do this
const result = await generateRDAImages(input);
const job = await waitForJobCompletion(result.job_id); // This waits too long

// ✅ CORRECT - Return job_id, poll separately
const result = await generateRDAImages(input);
return result.job_id; // Return immediately

// Poll in a separate process/interval
setInterval(async () => {
  const job = await getJobStatus(jobId);
  if (job.status === 'completed') {
    processImages(job.images);
  }
}, 10000);
```

---

#### Issue 3: Rate Limiting

**Error:**
```json
{
  "statusCode": 429,
  "body": "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests\"}"
}
```

**Solution:** Implement exponential backoff
```javascript
async function generateWithBackoff(input, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateRDAImages(input);
    } catch (error) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s, 8s, 16s
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}
```

---

### 11.3 Testing Guide

#### Test with Mock Mode (Free)

```bash
# 1. Verify mock mode is enabled
aws lambda get-function-configuration \
  --function-name rda-generator-worker-dev \
  --query 'Environment.Variables.MOCK_MODE'
# Should return: "true"

# 2. Generate test images (cost = $0)
node test-integration.js

# 3. Verify images generated
aws s3 ls s3://rda-images-dev/test_customer/ --recursive

# 4. Check costs are zero
curl https://API_URL/jobs/job_test123 | jq '.images[].cost'
# Should return all zeros: 0, 0, 0, ...
```

#### Test with Real Mode (Costs Money)

```bash
# 1. Switch to real mode
aws lambda update-function-configuration \
  --function-name rda-generator-worker-prod \
  --environment Variables={MOCK_MODE=false}

# 2. Generate 1-2 test images only (cost ~$0.10)
node test-integration.js --images 2

# 3. Verify quality
open $(curl https://API_URL/jobs/job_test123 | jq -r '.images[0].s3_url')

# 4. Check actual costs
curl https://API_URL/jobs/job_test123 | jq '.summary.total_cost'
```

---

### 11.4 Integration Checklist

Before going live, verify:

- [ ] Mock mode working (generates images, cost=$0)
- [ ] Real mode working (generates real images)
- [ ] Error handling implemented (rate limits, timeouts)
- [ ] Polling logic correct (10s intervals)
- [ ] OpenAI key validation working
- [ ] Can handle 10+ concurrent requests
- [ ] Monitoring alerts configured
- [ ] Support contact established

---

[Continue with next section...]
