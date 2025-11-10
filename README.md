# RDA Image Generator - Phase 1 Core MVP

Google Responsive Display Ad (RDA) image generation system using AWS Lambda and Replicate API.

## Phase 1 Implementation Status

- ✅ Infrastructure setup (DynamoDB, S3, SQS)
- ✅ Controller Lambda (API endpoints)
- ✅ Prompt Builder Lambda (GPT-4 integration)
- ✅ Worker Lambda with MOCK MODE
- 🔄 Integration testing
- ⏳ Real mode validation

## Quick Start

### Prerequisites

- AWS CLI configured
- SAM CLI installed
- Node.js 20.x
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Install Lambda dependencies
cd lambdas/controller && npm install && cd ../..
cd lambdas/prompt-builder && npm install && cd ../..
cd lambdas/worker && npm install && cd ../..
```

### Deployment

#### Deploy with Mock Mode (Development - FREE)

```bash
# Deploy to dev environment with mock mode
npm run deploy:dev

# OR manually
sam deploy --parameter-overrides Environment=dev MockMode=true
```

#### Deploy with Real Mode (Production - COSTS MONEY)

```bash
# Deploy to prod environment with real Replicate
npm run deploy:prod

# OR manually
sam deploy --parameter-overrides Environment=prod MockMode=false
```

### Configuration

1. **Update Replicate API Token** (for real mode only):

```bash
aws secretsmanager update-secret \
  --secret-id rda-generator/replicate-token-dev \
  --secret-string '{"token":"r8_YOUR_ACTUAL_TOKEN"}'
```

2. **Environment Variables**:
- `MOCK_MODE`: Set to "true" for free testing, "false" for real images
- `ENVIRONMENT`: "dev", "staging", or "prod"

## API Endpoints

### Generate Images

```bash
POST /generate
{
  "customer_id": "customer_001",
  "user_prompt": "Generate RDA images for AI tech startup",
  "openai_api_key": "sk-...",
  "generation_config": {
    "max_images": 10
  }
}
```

Response:
```json
{
  "job_id": "job_abc123",
  "status": "queued",
  "status_url": "/jobs/job_abc123",
  "estimated_completion_seconds": 90
}
```

### Check Job Status

```bash
GET /jobs/{job_id}
```

Response:
```json
{
  "job_id": "job_abc123",
  "status": "completed",
  "images": [
    {
      "image_id": "img_001",
      "s3_url": "https://...",
      "aspect_ratio": "1.91:1",
      "cost": 0
    }
  ],
  "summary": {
    "total_cost": 0,
    "total_images": 10
  }
}
```

## Testing

### Test with Mock Mode (FREE)

```bash
# Set environment variables
export OPENAI_API_KEY="sk-test-key"
export CONTROLLER_FUNCTION="rda-generator-controller-dev"

# Run integration test
node scripts/test-integration.js
```

Expected output:
- 10 mock images generated
- Total cost: $0.00
- Completion time: <10 seconds

### Test with Real Mode (COSTS ~$0.45)

```bash
# Switch to real mode
aws lambda update-function-configuration \
  --function-name rda-generator-worker-dev \
  --environment Variables={MOCK_MODE=false}

# Run test with only 2 images
node scripts/test-integration.js
```

## Cost Breakdown

### Mock Mode (Development)
- Image generation: $0.00
- AWS Lambda: ~$0.01
- DynamoDB: ~$0.01
- S3: ~$0.01
- **Total: ~$0.03 per 100 images**

### Real Mode (Production)
- Replicate API: $0.045 per image
- OpenAI GPT-4: ~$0.01 per batch
- AWS Lambda: ~$0.01
- DynamoDB: ~$0.01
- S3: ~$0.01
- **Total: ~$0.48 per 10 images**

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Controller │────▶│ Prompt       │────▶│     SQS       │
│   Lambda    │     │ Builder      │     │    Queue      │
└─────────────┘     └──────────────┘     └───────────────┘
                           │                      │
                           ▼                      ▼
                    ┌──────────────┐     ┌───────────────┐
                    │   DynamoDB   │◀────│    Worker     │
                    │    Table     │     │    Lambda     │
                    └──────────────┘     └───────────────┘
                                                 │
                                                 ▼
                                         ┌───────────────┐
                                         │   S3 Bucket   │
                                         │  (Images)     │
                                         └───────────────┘
```

## Monitoring

### View Logs

```bash
# Controller logs
sam logs -n ControllerLambda --stack-name rda-generator-dev --tail

# Prompt Builder logs
sam logs -n PromptBuilderLambda --stack-name rda-generator-dev --tail

# Worker logs
sam logs -n WorkerLambda --stack-name rda-generator-dev --tail
```

### CloudWatch Metrics

- Lambda invocations
- Lambda errors
- Lambda duration
- DynamoDB read/write capacity
- SQS messages sent/received
- S3 PUT requests

## Troubleshooting

### Common Issues

1. **Lambda timeout**: Increase timeout in template.yaml
2. **SQS visibility timeout**: Ensure it's longer than Lambda timeout
3. **Replicate token invalid**: Update secret in Secrets Manager
4. **OpenAI key invalid**: Verify key starts with "sk-"
5. **S3 access denied**: Check Lambda IAM role permissions

### Debug Mode

```bash
# Enable detailed logging
export DEBUG=true

# Check Lambda environment
aws lambda get-function-configuration \
  --function-name rda-generator-worker-dev
```

## Phase 2 Features (Coming Soon)

- User-provided images support
- Regeneration endpoint
- Advanced retry logic
- Rate limiting
- Load testing
- Production deployment

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review error messages in job status
3. Verify environment variables
4. Ensure Mock Mode is enabled for testing