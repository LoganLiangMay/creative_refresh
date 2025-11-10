# Integration Guide for External Dispatcher

## Quick Start

This guide provides complete, production-ready code examples for integrating with the RDA Image Generation API.

## Node.js Integration

### Installation

```bash
npm install aws-sdk
```

### Complete Integration Code

```javascript
// dispatcher-integration.js
const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({ region: 'us-east-1' });
const FUNCTION_NAME = 'rda-generator-controller-dev'; // Change to -prod for production

/**
 * Generate RDA images
 */
async function generateRDAImages(input) {
    const payload = {
        httpMethod: 'POST',
        path: '/generate',
        body: JSON.stringify(input)
    };

    const response = await lambda.invoke({
        FunctionName: FUNCTION_NAME,
        Payload: JSON.stringify(payload)
    }).promise();

    const result = JSON.parse(response.Payload);

    if (result.statusCode !== 202) {
        throw new Error(`API Error: ${result.statusCode} - ${result.body}`);
    }

    return JSON.parse(result.body);
}

/**
 * Get job status
 */
async function getJobStatus(jobId) {
    const payload = {
        httpMethod: 'GET',
        path: `/jobs/${jobId}`,
        pathParameters: { id: jobId }
    };

    const response = await lambda.invoke({
        FunctionName: FUNCTION_NAME,
        Payload: JSON.stringify(payload)
    }).promise();

    const result = JSON.parse(response.Payload);
    return JSON.parse(result.body);
}

/**
 * Poll for job completion
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

        console.log(`Job ${jobId}: ${job.progress.completed}/${job.progress.total} images done`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

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
        console.log(`  Cost: $${img.cost}`);
    });

    console.log(`Total cost: $${job.summary.total_cost}`);
}

// Export functions
module.exports = {
    generateRDAImages,
    getJobStatus,
    waitForJobCompletion
};
```

## Python Integration

### Installation

```bash
pip install boto3
```

### Complete Integration Code

```python
# dispatcher_integration.py
import boto3
import json
import time

lambda_client = boto3.client('lambda', region_name='us-east-1')
FUNCTION_NAME = 'rda-generator-controller-dev'  # Change to -prod for production

def generate_rda_images(input_data):
    """Generate RDA images"""
    payload = {
        'httpMethod': 'POST',
        'path': '/generate',
        'body': json.dumps(input_data)
    }

    response = lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        Payload=json.dumps(payload)
    )

    result = json.loads(response['Payload'].read())

    if result['statusCode'] != 202:
        raise Exception(f"API Error: {result['statusCode']} - {result['body']}")

    return json.loads(result['body'])

def get_job_status(job_id):
    """Get job status"""
    payload = {
        'httpMethod': 'GET',
        'path': f'/jobs/{job_id}',
        'pathParameters': {'id': job_id}
    }

    response = lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        Payload=json.dumps(payload)
    )

    result = json.loads(response['Payload'].read())
    return json.loads(result['body'])

def wait_for_job_completion(job_id, max_wait_seconds=180):
    """Poll for job completion"""
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

        progress = job.get('progress', {})
        print(f"Job {job_id}: {progress.get('completed', 0)}/{progress.get('total', 0)} images done")
        time.sleep(poll_interval)

# ============================================================
# USAGE EXAMPLE
# ============================================================

def example_basic_generation():
    """Example: Basic text-only generation"""
    print("Example: Basic text-only generation")

    result = generate_rda_images({
        'customer_id': 'dispatcher_customer_001',
        'user_prompt': 'Generate RDA images for AI event app',
        'openai_api_key': 'sk-YOUR-KEY'
    })

    print(f"Job created: {result['job_id']}")

    # Wait for completion
    job = wait_for_job_completion(result['job_id'])

    print(f"Generated {len(job['images'])} images")
    for i, img in enumerate(job['images']):
        print(f"Image {i+1}: {img['s3_url']}")
        print(f"  Aspect ratio: {img['aspect_ratio']}")
        print(f"  Cost: ${img['cost']}")

    print(f"Total cost: ${job['summary']['total_cost']}")

if __name__ == '__main__':
    example_basic_generation()
```

## Testing Guide

### 1. Test with Mock Mode (FREE)

```bash
# Verify mock mode is enabled
aws lambda get-function-configuration \
  --function-name rda-generator-worker-dev \
  --query 'Environment.Variables.MOCK_MODE'
# Should return: "true"

# Generate test images (cost = $0)
node your-integration-script.js

# Verify costs are zero
# All image costs should be 0
```

### 2. Test with Real Mode (COSTS MONEY)

```bash
# Switch to real mode (only if needed)
aws lambda update-function-configuration \
  --function-name rda-generator-worker-dev \
  --environment Variables={MOCK_MODE=false}

# Generate 1-2 test images only (cost ~$0.10)
# Update your script to use generation_config: { max_images: 2 }
```

## API Reference

### POST /generate

Request:
```json
{
  "customer_id": "string (required)",
  "user_prompt": "string (required)",
  "openai_api_key": "string (required, starts with sk-)",
  "input_images": [
    {
      "s3_url": "string",
      "usage": "product|logo"
    }
  ],
  "generation_config": {
    "max_images": 10
  }
}
```

Response (202 Accepted):
```json
{
  "job_id": "job_abc123",
  "status": "queued",
  "status_url": "/jobs/job_abc123",
  "estimated_completion_seconds": 90
}
```

### GET /jobs/{job_id}

Response (200 OK):
```json
{
  "job_id": "job_abc123",
  "customer_id": "customer_001",
  "status": "completed|generating|failed",
  "progress": {
    "total": 10,
    "completed": 10,
    "failed": 0
  },
  "images": [
    {
      "image_id": "img_001",
      "s3_url": "https://...",
      "aspect_ratio": "1.91:1|1:1",
      "cost": 0.045,
      "metadata": {
        "mock_mode": false
      }
    }
  ],
  "summary": {
    "total_cost": 0.45,
    "total_images": 10
  }
}
```

## Error Handling

### Common Errors

1. **Invalid OpenAI Key**
```json
{
  "error": "Validation Error",
  "details": ["openai_api_key must be a valid OpenAI API key"]
}
```

2. **Rate Limiting**
```json
{
  "statusCode": 429,
  "error": "rate_limit_exceeded"
}
```
Solution: Implement exponential backoff

3. **Job Not Found**
```json
{
  "statusCode": 404,
  "error": "Job not found"
}
```

### Retry Strategy

```javascript
async function generateWithRetry(input, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await generateRDAImages(input);
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = Math.pow(2, i) * 1000;
            console.log(`Retry ${i + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

## Integration Checklist

Before going live:

- [ ] Test with mock mode (generates images, cost=$0)
- [ ] Verify OpenAI API key validation
- [ ] Implement polling logic (10s intervals)
- [ ] Add error handling and retries
- [ ] Test with 1-2 real images if needed
- [ ] Monitor CloudWatch logs
- [ ] Set up cost alerts

## Support

For integration issues:
1. Check CloudWatch logs for the Lambda functions
2. Verify your AWS credentials
3. Ensure correct function names
4. Test with mock mode first

## Cost Estimation

- Mock Mode: $0 per image
- Real Mode: $0.045 per image
- 10 images = $0.45
- 100 images = $4.50
- 1000 images = $45.00

Always use Mock Mode for development and testing!