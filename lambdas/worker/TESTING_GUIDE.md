# RDA Image Generation Worker - Testing Guide

Complete guide for testing the Worker Lambda locally and in AWS.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Modes](#test-modes)
3. [Testing Tools](#testing-tools)
4. [Test Fixtures](#test-fixtures)
5. [Multi-Modal Testing](#multi-modal-testing)
6. [AWS Integration Testing](#aws-integration-testing)
7. [Cost Management](#cost-management)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Interactive Testing (Recommended)

The easiest way to test:

```bash
npm run test:interactive
```

This launches an interactive menu where you can:
- Run predefined test cases
- Create custom prompts
- Test multi-modal generation
- View and export results
- All without writing any code!

### 2. Simple Local Test

Run a single test with mock mode (free, instant):

```bash
npm run test:local
```

Or with custom parameters:

```bash
node tests/local/local-runner.js \
  --mock-mode \
  --prompt "A professional product photograph" \
  --aspect-ratio "1:1"
```

### 3. Web UI Testing (NEW - Visual Interface)

**Best for**: Visual testing, demonstrations, HTTP uploads

```bash
npm run test:web-ui
```

Then open your browser to: **http://localhost:3000**

**Features:**
- 🖼️ Drag & drop image uploads
- 👁️ Visual preview of input and output images
- 🎨 Real-time prompt enhancement display
- 🎛️ Easy toggle between Mock/Real modes
- 📊 Side-by-side image comparison
- 💾 Download generated images
- 🧹 Clear test data with one click

**Perfect for:**
- Testing multi-modal image uploads visually
- Seeing the full workflow in action
- Demonstrations and presentations
- Quick iterations on prompts and inputs

See `tests/web-ui/README.md` for more details.

### 4. Unit Tests

Run all unit tests:

```bash
npm test                    # Run all tests with coverage
npm run test:image-processor  # Test image processor only
npm run test:multi-modal      # Test multi-modal features
```

---

## Test Modes

### Mock Mode (Default) - FREE

- **Cost**: $0.00
- **Speed**: Fast (500-2000ms)
- **Use Case**: Development, testing, CI/CD
- **Output**: Blue mock images with metadata overlay

```bash
# Mock mode (default)
npm run test:local
node tests/local/local-runner.js --mock-mode
```

**Mock Image Features:**
- Shows prompt, aspect ratio, timestamp
- Indicates multi-modal (if input images used)
- RDA compliant watermark
- Unique image for each test

### Real Mode - PAID

- **Cost**: ~$0.003 per image
- **Speed**: Fast (2-3x faster than competitors)
- **Use Case**: Final validation, production testing
- **Output**: Real AI-generated images via Google nano-banana (Gemini 2.5 Flash Image)

```bash
# Real mode (costs money!)
npm run test:local:real
node tests/local/local-runner.js --real-mode
```

**⚠️ Warning**: Real mode calls actual Replicate API and incurs costs. Always test in mock mode first!

---

## Testing Tools

### 1. Interactive CLI Test Tool

**Best for**: Manual testing, exploration, demonstrations

```bash
npm run test:interactive
```

**Features:**
- 🎯 Select from predefined test cases
- 📋 Run batch tests
- ✏️  Create custom prompts
- 🖼️  Add input images (multi-modal)
- 📊 View results
- 💾 Export results to JSON

### 2. Local Test Runner

**Best for**: Automated testing, scripts, CI/CD

```bash
# Basic usage
node tests/local/local-runner.js --mock-mode

# With options
node tests/local/local-runner.js \
  --mock-mode \
  --clear \
  --prompt "Your prompt here" \
  --aspect-ratio "1:1"
```

**Options:**
- `--mock-mode` - Use mock mode (default)
- `--real-mode` - Use real Replicate API
- `--clear` - Clear previous test data
- `--prompt "..."` - Custom prompt
- `--aspect-ratio` - 1:1 or 1.91:1

**Programmatic Usage:**

```javascript
const LocalTestRunner = require('./tests/local/local-runner');

const runner = new LocalTestRunner({
    mockMode: true,
    clearData: false,
    prompt: 'A beautiful landscape',
    aspectRatio: '1:1'
});

await runner.initialize();
const result = await runner.runTest();
```

### 3. Image Processor Tests

Test the image processor utility:

```bash
npm run test:image-processor
```

Tests:
- ✅ Single image processing
- ✅ Multiple images
- ✅ Data URL conversion
- ✅ Size validation
- ✅ Format validation
- ✅ Error handling

### 4. Multi-Modal Tests

Test multi-modal image generation:

```bash
npm run test:multi-modal
```

Tests:
- ✅ Single input image + prompt
- ✅ Multiple input images + prompt
- ✅ Text-to-image (no input images)

---

## Test Fixtures

Location: `tests/fixtures/`

### Test Prompts

File: `tests/fixtures/test-prompts.json`

**Categories:**
- **text-to-image**: Simple text prompts
- **multi-modal**: Input images + prompts
- **batch**: Multiple image generation
- **smoke**: Quick validation tests
- **stress**: Performance testing

**Example Test Case:**

```json
{
  "id": "product_ad_with_image",
  "name": "Product Advertisement from Photo",
  "description": "Generate ad creative from product photo",
  "prompt": "Professional advertisement showcasing this product",
  "aspect_ratio": "1:1",
  "input_images": ["product-photo.jpg"],
  "expected_cost": 0.003,
  "category": "multi-modal"
}
```

### Sample Input Images

Location: `tests/fixtures/input-images/`

| Image | Size | Use Case |
|-------|------|----------|
| `product-photo.jpg` | 800×800 | Product advertisement testing |
| `brand-logo.png` | 600×600 | Brand integration testing |
| `stock-image.jpg` | 1200×800 | Stock photo transformation |
| `test-image.jpg` | 400×400 | Basic validation |

**Regenerate Sample Images:**

```bash
npm run fixtures:generate
```

---

## Multi-Modal Testing

Multi-modal generation combines input images with text prompts to create new images.

### Example: Product Advertisement

```bash
node tests/local/local-runner.js \
  --mock-mode \
  --prompt "Create a professional advertisement from this product" \
  --input-image tests/fixtures/input-images/product-photo.jpg
```

### Example: Brand Integration

```javascript
const runner = new LocalTestRunner({ mockMode: true });
await runner.initialize();

const result = await runner.runTest({
    prompt: 'Modern advertisement featuring this brand',
    inputImages: [
        'tests/fixtures/input-images/product-photo.jpg',
        'tests/fixtures/input-images/brand-logo.png'
    ]
});
```

### Supported Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

### Size Limits

- **Per Image**: 10MB max
- **Total Payload**: 5MB recommended (after base64 encoding)
- **Max Images**: 10

---

## AWS Integration Testing

### Prerequisites

1. Valid AWS credentials in `.env.local`
2. Resources deployed in us-east-1:
   - S3 bucket: `rda-images-local`
   - DynamoDB table: `RDAImageJobs-local`
   - SQS queue (optional for local testing)

### Local AWS Testing

The local test runner simulates AWS services:

**Mock S3**: Writes to `tests/local/output/s3/`
**Mock DynamoDB**: Writes to `tests/local/output/dynamodb/`

### View Test Output

**Generated Images:**
```bash
ls tests/local/output/s3/rda-images-local/
```

**DynamoDB Metadata:**
```bash
cat tests/local/output/dynamodb/RDAImageJobs-local.json
```

**Interactive Viewer:**
```bash
npm run test:interactive
# Select "View previous results"
```

---

## Cost Management

### Mock Mode Costs

| Test Type | Images | Cost |
|-----------|--------|------|
| Single test | 1 | $0.00 |
| Batch (10 tests) | 10 | $0.00 |
| Full test suite | ~25 | $0.00 |

**Total: $0.00** 🎉

### Real Mode Costs

| Test Type | Images | Cost |
|-----------|--------|------|
| Single test | 1 | ~$0.003 |
| Smoke tests | 2 | ~$0.006 |
| Standard test suite | 10 | ~$0.03 |
| Full test suite | 25 | ~$0.075 |

**Replicate FLUX Schnell**: ~$0.003 per image

**Cost Tracking:**

The local test runner tracks costs:

```javascript
const result = await runner.runTest();
console.log(`Cost: $${result.cost}`);
```

### Cost-Saving Tips

1. **Always start with mock mode**
2. **Run smoke tests** (2 images) before full suite
3. **Use interactive tool** to select specific tests
4. **Batch test carefully** - select only needed tests
5. **Monitor output** - stop if errors occur

---

## Troubleshooting

### Common Issues

#### 1. "Module not found" errors

```bash
# Ensure dependencies are installed
npm install
```

#### 2. "File not found" errors

```bash
# Regenerate fixtures
npm run fixtures:generate
```

#### 3. "Replicate API failed"

- Check `.env.local` has valid `REPLICATE_API_TOKEN`
- Verify token starts with `r8_`
- Try mock mode first to isolate issue

#### 4. Images not generating in mock mode

```bash
# Clear test data and try again
rm -rf tests/local/output/*
npm run test:local -- --clear
```

#### 5. Interactive tool not working

```bash
# Reinstall inquirer
npm install inquirer --save-dev
```

### Debug Mode

Enable verbose logging:

```javascript
const runner = new LocalTestRunner({
    mockMode: true,
    debug: true  // Enable debug logging
});
```

### View Logs

All tests log to console. For long-running tests, redirect output:

```bash
npm run test:local > test-output.log 2>&1
```

---

## Test Output Examples

### Successful Mock Test

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TEST COMPLETED SUCCESSFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 1234ms
Job ID: test-job-1234567890
Image ID: img-1234567890

📁 Output Locations:
   Images: tests/local/output/s3/rda-images-local/...
   Metadata: tests/local/output/dynamodb/RDAImageJobs-local.json
```

### Multi-Modal Test

```
📸 Processing 2 input image(s) for multi-modal generation...
✅ Prepared 2 images (68.7KB total)
Generating MOCK image (multi-modal with 2 input images)
Mock image 1 generated in 1500ms for aspect ratio 1:1
```

### Batch Test Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Batch Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 10
Successful: 10 ✅
Failed: 0 ❌
Avg Duration: 1234ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Best Practices

1. **Always test locally first** before deploying to AWS
2. **Use mock mode** for development and testing
3. **Run smoke tests** before full test suites
4. **Clear old data** periodically to avoid confusion
5. **Version control fixtures** for consistency across team
6. **Document custom test cases** in `test-prompts.json`
7. **Track costs** when using real mode
8. **Review generated images** to validate quality
9. **Use interactive tool** for demonstrations
10. **Export results** for documentation and reporting

---

## Next Steps

- [ ] Run interactive test tool: `npm run test:interactive`
- [ ] Try multi-modal generation with sample images
- [ ] Create custom test cases in `test-prompts.json`
- [ ] Test with real mode (carefully!)
- [ ] Deploy to AWS and run integration tests
- [ ] Set up CI/CD pipeline with automated tests

---

## Need Help?

- 📖 Review code comments in `tests/` directory
- 🔍 Check `tests/fixtures/README.md` for fixture details
- 🐛 Report issues with detailed error logs
- 💡 Suggest improvements or new test cases

Happy testing! 🧪✨
