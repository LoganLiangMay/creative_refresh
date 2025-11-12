# Worker Lambda Tests

Test suite for RDA Image Generation Worker Lambda.

## Quick Start

```bash
# Interactive testing (recommended)
npm run test:interactive

# Simple local test (mock mode)
npm run test:local

# Unit tests
npm test
```

## Directory Structure

```
tests/
├── fixtures/                 # Test data and sample images
│   ├── input-images/        # Sample images for multi-modal testing
│   ├── test-prompts.json    # Predefined test cases
│   ├── generate-sample-images.js  # Regenerate sample images
│   └── README.md            # Fixtures documentation
├── local/                    # Local test environment
│   ├── mock-s3.js           # Mock S3 client (writes to filesystem)
│   ├── mock-dynamodb.js     # Mock DynamoDB client (JSON files)
│   ├── local-runner.js      # Main local test runner
│   ├── output/              # Test output (gitignored)
│   │   ├── s3/             # Generated images
│   │   └── dynamodb/       # Metadata JSON
│   └── .gitignore           # Ignore output files
├── interactive-test.js       # Interactive CLI test tool
├── test-image-processor.js   # Image processor unit tests
├── test-multi-modal.js       # Multi-modal generation tests
└── README.md                 # This file
```

## Available Test Commands

### Interactive Testing

```bash
npm run test:interactive
```

**Features:**
- Select from predefined test cases
- Run batch tests
- Create custom prompts
- Add input images (multi-modal)
- View and export results
- No coding required!

### Local Testing

```bash
# Mock mode (free, instant)
npm run test:local

# Real mode (costs $0.003/image)
npm run test:local:real

# With custom parameters
node tests/local/local-runner.js \
  --mock-mode \
  --clear \
  --prompt "Your prompt" \
  --aspect-ratio "1:1"
```

### Unit Tests

```bash
# All tests with coverage
npm test

# Watch mode
npm run test:watch

# Image processor tests
npm run test:image-processor

# Multi-modal tests
npm run test:multi-modal
```

### Fixtures

```bash
# Regenerate sample images
npm run fixtures:generate
```

## Test Modes

### Mock Mode (Default)
- **Cost**: $0.00
- **Speed**: Fast (500-2000ms)
- **Output**: Blue mock images with metadata
- **Use**: Development, testing, CI/CD

### Real Mode
- **Cost**: ~$0.003 per image
- **Speed**: Varies (10-30s typical)
- **Output**: AI-generated images via Replicate
- **Use**: Final validation, production testing

## Test Categories

From `fixtures/test-prompts.json`:

- **text-to-image**: Simple text prompts → images
- **multi-modal**: Input images + prompts → images
- **batch**: Multiple image generation
- **smoke**: Quick validation (2 images)
- **stress**: Performance and edge cases

## Sample Test Cases

### Basic Text-to-Image

```bash
node tests/local/local-runner.js \
  --mock-mode \
  --prompt "A professional product photograph"
```

### Multi-Modal (Image + Prompt)

```javascript
const LocalTestRunner = require('./local/local-runner');
const path = require('path');

const runner = new LocalTestRunner({ mockMode: true });
await runner.initialize();

await runner.runTest({
    prompt: 'Create a professional advertisement',
    inputImages: [
        path.join(__dirname, 'fixtures/input-images/product-photo.jpg')
    ]
});
```

### Batch Testing

```javascript
const results = await runner.runMultiple(5, {
    prompts: [
        'Professional office',
        'Modern workspace',
        'Tech startup',
        'Creative studio',
        'Minimal design'
    ]
});
```

## Viewing Test Output

### Generated Images

```bash
# List all generated images
ls tests/local/output/s3/rda-images-local/

# View specific job
ls tests/local/output/s3/rda-images-local/test-customer/test-job-*/
```

### DynamoDB Metadata

```bash
# View all metadata
cat tests/local/output/dynamodb/RDAImageJobs-local.json | jq

# Pretty print with Node
node -e "console.log(JSON.stringify(require('./tests/local/output/dynamodb/RDAImageJobs-local.json'), null, 2))"
```

### Interactive Viewer

```bash
npm run test:interactive
# Select "View previous results"
```

## Cost Tracking

All tests track costs:

```javascript
const result = await runner.runTest();
console.log(`Cost: $${result.cost}`);
console.log(`Duration: ${result.duration}ms`);
```

**Mock Mode**: Always $0.00
**Real Mode**: ~$0.003 per image

## Test Coverage

Current test coverage includes:

- ✅ Mock image generation
- ✅ Real image generation (Replicate FLUX Schnell)
- ✅ Multi-modal image generation
- ✅ Input image processing
- ✅ Image validation
- ✅ S3 upload simulation
- ✅ DynamoDB metadata storage
- ✅ Error handling
- ✅ Aspect ratio support (1:1, 1.91:1)
- ✅ Prompt enhancement
- ✅ Cost tracking

## Troubleshooting

### Clear Test Data

```bash
rm -rf tests/local/output/*
```

Or use interactive tool:
```bash
npm run test:interactive
# Select "Clear test data"
```

### Regenerate Fixtures

```bash
npm run fixtures:generate
```

### Debug Mode

Set `DEBUG=true` in environment or enable in code:

```javascript
const runner = new LocalTestRunner({
    mockMode: true,
    debug: true
});
```

## Adding New Tests

### 1. Add Test Case to Fixtures

Edit `fixtures/test-prompts.json`:

```json
{
  "id": "my_new_test",
  "name": "My New Test",
  "description": "What this test does",
  "prompt": "The image generation prompt",
  "aspect_ratio": "1:1",
  "input_images": [],
  "category": "text-to-image"
}
```

### 2. Add Sample Image (if needed)

```bash
# Add image to fixtures/input-images/
cp /path/to/image.jpg tests/fixtures/input-images/my-image.jpg

# Reference in test case
"input_images": ["my-image.jpg"]
```

### 3. Run Your Test

```bash
npm run test:interactive
# Select your test from the list
```

## Best Practices

1. **Always test in mock mode first**
2. **Run smoke tests** before full suites
3. **Clear old data** periodically
4. **Track costs** when using real mode
5. **Review generated images** for quality
6. **Export results** for documentation
7. **Version control fixtures**
8. **Document custom tests**

## Full Documentation

See [TESTING_GUIDE.md](../TESTING_GUIDE.md) for complete documentation.

## Need Help?

- 📖 Review [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- 🔍 Check [fixtures/README.md](fixtures/README.md)
- 💡 Run `npm run test:interactive` for guided testing
