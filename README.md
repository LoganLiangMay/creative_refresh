# RDA Image Generator

Google Responsive Display Ad (RDA) image generation system using AWS Lambda, SQS, and Gemini Imagen API.

## What It Is

A serverless image generation pipeline that creates Google RDA-compliant images using AI. Supports mock mode for cost-free development and real mode for production image generation.

## Status

- ✅ Core infrastructure (DynamoDB, S3, SQS)  
- ✅ Controller Lambda (API endpoints)  
- ✅ Prompt Builder Lambda (OpenAI GPT-4 integration)  
- ✅ Worker Lambda with mock mode support  
- ✅ Unit tests for all components  
- ✅ Integration tests (mock mode, no AWS deployment needed)

## Quick Start

### Prerequisites

- **Node.js 22.x** (or 20.x minimum)
- **npm** or yarn
- **AWS CLI** configured with credentials
- **SAM CLI** installed ([install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd <repo-name>

# Install root dependencies
npm install

# Install Lambda function dependencies
cd lambdas/controller && npm install && cd ../..
cd lambdas/prompt-builder && npm install && cd ../..
cd lambdas/worker && npm install && cd ../..
```

### Run Tests

```bash
# Run all tests
cd lambdas/controller && npm test && cd ../..
cd lambdas/prompt-builder && npm test && cd ../..
cd lambdas/worker && npm test && cd ../..
```

All tests should pass. The worker tests focus on the mock image generator (100% coverage).

### Local Development

Build and validate the SAM template:

```bash
sam build
sam validate
```

### Deployment

#### Deploy with Mock Mode (Development - FREE)

```bash
# Build and deploy to dev environment
sam build
sam deploy --parameter-overrides Environment=dev MockMode=true --guided
```

The `--guided` flag walks you through configuration on first deploy. Subsequent deploys can use:

```bash
npm run deploy:dev
```

#### Deploy with Real Mode (Production - COSTS MONEY)

⚠️ **Warning**: Real mode incurs costs (~$0.045 per image via Gemini Imagen API).

```bash
sam build
sam deploy --parameter-overrides Environment=prod MockMode=false --guided
```

Or use:

```bash
npm run deploy:prod
```

### Configuration

After deploying, configure the Gemini API secret (real mode only):

```bash
# Update with your actual Gemini API key
aws secretsmanager update-secret \
  --secret-id rda-generator/replicate-token-dev \
  --secret-string '{"token":"YOUR_GEMINI_API_KEY"}'
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Controller │────▶│ Prompt       │────▶│     SQS       │
│   Lambda    │     │ Builder      │     │    Queue      │
└─────────────┘     └──────────────┘     └───────────────┘
       │                   │                      │
       │                   ▼                      ▼
       │            ┌──────────────┐     ┌───────────────┐
       └───────────▶│   DynamoDB   │◀────│    Worker     │
                    │    Table     │     │    Lambda     │
                    └──────────────┘     └───────────────┘
                                                 │
                                                 ▼
                                         ┌───────────────┐
                                         │   S3 Bucket   │
                                         │  (Images)     │
                                         └───────────────┘
```

**Flow:**
1. Controller receives POST /generate request
2. Validates input and creates job in DynamoDB
3. Invokes Prompt Builder Lambda asynchronously
4. Prompt Builder analyzes user prompt via OpenAI GPT-4
5. Generates optimized prompts and sends messages to SQS
6. Worker Lambda processes SQS messages
7. Generates images (mock or real via Gemini API)
8. Uploads images to S3 and updates DynamoDB
9. Client polls GET /jobs/{id} for completion

## API Endpoints

### POST /generate

Create a new image generation job.

**Request:**
```json
{
  "customer_id": "customer_001",
  "user_prompt": "Generate RDA images for AI tech startup",
  "openai_api_key": "sk-...",
  "generation_config": {
    "max_images": 10
  }
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "job_abc123",
  "status": "queued",
  "status_url": "/jobs/job_abc123",
  "estimated_completion_seconds": 10
}
```

### GET /jobs/{job_id}

Check job status and retrieve generated images.

**Response (200 OK):**
```json
{
  "job_id": "job_abc123",
  "status": "completed",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:01:00Z",
  "images": [
    {
      "image_id": "img_001",
      "s3_url": "https://s3.amazonaws.com/...",
      "aspect_ratio": "1.91:1",
      "dimensions": "1200x628",
      "cost": 0
    }
  ],
  "progress": {
    "total": 10,
    "completed": 10,
    "failed": 0
  },
  "summary": {
    "total_cost": 0,
    "total_images": 10
  }
}
```

## Development

### Mock Mode vs Real Mode

**Mock Mode** (`MOCK_MODE=true`):
- Generates placeholder images instantly
- Zero API costs
- Ideal for development and testing
- ~10 second completion time for 10 images

**Real Mode** (`MOCK_MODE=false`):
- Uses Gemini Imagen API for actual image generation
- Costs ~$0.045 per image
- Production-quality images
- ~90 second completion time for 10 images

### Environment Variables

Each Lambda function uses:
- `ENVIRONMENT`: Deployment environment (dev/staging/prod)
- `DYNAMODB_TABLE`: DynamoDB table name
- `MOCK_MODE`: Enable mock mode (true/false)
- `S3_BUCKET`: S3 bucket for image storage (Worker)
- `PROMPT_BUILDER_FUNCTION`: Prompt builder function name (Controller)
- `SQS_QUEUE_URL`: SQS queue URL (Prompt Builder)
- `REPLICATE_SECRET_ARN`: Secrets Manager ARN for API key (Worker)

## Troubleshooting

### Common Issues

1. **SAM build fails**: Ensure Node.js 22.x is installed (`node --version`)
2. **Tests fail with UUID errors**: Dependencies need reinstall (`npm install uuid@^9.0.1`)
3. **Deployment fails**: Check AWS credentials are configured (`aws sts get-caller-identity`)
4. **Lambda timeout**: Increase timeout in `template.yaml` (current: 120s for worker)
5. **S3 access denied**: Verify IAM roles in `template.yaml` have correct permissions

### Logs

View Lambda logs:

```bash
# Controller logs
sam logs -n ControllerLambda --stack-name rda-generator-dev --tail

# Prompt Builder logs
sam logs -n PromptBuilderLambda --stack-name rda-generator-dev --tail

# Worker logs
sam logs -n WorkerLambda --stack-name rda-generator-dev --tail
```

## Testing

### Local Verification

Run the complete test suite locally without any AWS or API credentials:

```bash
# Install dependencies first
npm install
cd lambdas/controller && npm install && cd ../..
cd lambdas/prompt-builder && npm install && cd ../..
cd lambdas/worker && npm install && cd ../..

# Run all tests (no AWS/API keys required - uses mocks)
cd lambdas/controller && npm test   # 17/17 tests ✅
cd ../prompt-builder && npm test    # 12/12 tests ✅
cd ../worker && npm test             # 16/16 tests ✅

# Expected: 45/45 tests pass
```

### Integration Testing

The project includes a mock-mode integration test that exercises the complete pipeline:
- **Controller** → **Prompt Builder** → **Worker**
- All AWS services (DynamoDB, S3, SQS, Lambda) are mocked
- Verifies job creation, image generation, correct RDA dimensions, and $0 cost
- No AWS credentials or API keys required
- Runs in CI automatically

```bash
# Run just the integration test
npm run test:integration
```

### Optional: Real AWS Integration Test

For testing with actual AWS deployment (requires credentials):

```bash
# Set environment variables
export CONTROLLER_FUNCTION=rda-generator-controller-dev
export OPENAI_API_KEY=sk-your-key

# Run integration test against deployed stack
node scripts/test-integration.js
```

### Continuous Integration

This project uses GitHub Actions to automatically run tests on every push and pull request:
- ✅ Runs all three unit test suites (controller, prompt-builder, worker)
- ✅ Runs integration smoke test (mock mode)
- ✅ Uses Node.js 22.x
- ✅ No AWS credentials required (tests use mocks)
- ✅ Must pass before merging

View CI status in the "Actions" tab or on pull requests.

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests: `npm test` in each lambda folder (all tests must pass)
4. Submit PR (CI will verify tests automatically)

## License

[Add license information]