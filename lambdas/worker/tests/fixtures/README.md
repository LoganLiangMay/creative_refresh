# Test Fixtures

This directory contains test fixtures for the RDA Image Generation Worker Lambda.

## Directory Structure

```
fixtures/
├── input-images/          # Sample input images for multi-modal testing
│   ├── product-photo.jpg  # Sample product photograph
│   ├── brand-logo.png     # Sample brand logo
│   ├── stock-image.jpg    # Sample stock photograph
│   └── test-image.jpg     # Basic test pattern
├── test-prompts.json      # Comprehensive test cases
├── generate-sample-images.js  # Script to regenerate sample images
└── README.md              # This file
```

## Sample Input Images

### product-photo.jpg
- **Size**: 800x800px
- **Use Case**: Testing product-based advertisement generation
- **Description**: Mock product photograph (coffee mug)

### brand-logo.png
- **Size**: 600x600px
- **Use Case**: Testing brand integration and logo placement
- **Description**: Circular brand logo with transparent background

### stock-image.jpg
- **Size**: 1200x800px
- **Use Case**: Testing stock photo enhancement and transformation
- **Description**: Landscape scene with mountains and sky

### test-image.jpg
- **Size**: 400x400px
- **Use Case**: Basic functionality and validation testing
- **Description**: Checkerboard pattern with center marker

## Test Prompts

The `test-prompts.json` file contains categorized test cases:

### Categories

- **text-to-image**: Simple text prompts generating images from scratch
- **multi-modal**: Using input images combined with text prompts
- **batch**: Multiple image generation in parallel
- **smoke**: Quick validation tests
- **stress**: Performance and edge case testing

### Example Usage

```javascript
const testCases = require('./test-prompts.json');

// Get basic text-to-image test
const basicTest = testCases.test_cases.find(t => t.id === 'basic_text_to_image');

// Run with local test runner
const LocalTestRunner = require('../local/local-runner');
const runner = new LocalTestRunner();
await runner.runTest({
  prompt: basicTest.prompt,
  aspectRatio: basicTest.aspect_ratio
});
```

## Regenerating Sample Images

If you need to regenerate the sample images:

```bash
node tests/fixtures/generate-sample-images.js
```

This will recreate all images in the `input-images/` directory.

## Adding New Fixtures

### Adding New Test Cases

Edit `test-prompts.json` and add to the appropriate category:

```json
{
  "id": "my_new_test",
  "name": "My New Test Case",
  "description": "What this test validates",
  "prompt": "The image generation prompt",
  "aspect_ratio": "1:1",
  "input_images": ["optional-input.jpg"],
  "category": "text-to-image"
}
```

### Adding New Sample Images

1. Place the image in `input-images/`
2. Update this README with image details
3. Reference the image in `test-prompts.json` test cases

## Cost Estimation

- **Mock Mode**: $0.00 (all tests)
- **Real Mode**: ~$0.003 per image generation
  - 10 standard test cases = $0.03
  - 2 smoke tests = $0.006
  - 1 batch test (3 images) = $0.009
  - **Total for full suite**: ~$0.045

## Integration with Test Runner

These fixtures are designed to work seamlessly with the local test runner:

```bash
# Run with a specific test case
node tests/local/local-runner.js \
  --mock-mode \
  --prompt "A professional product photograph" \
  --aspect-ratio "1:1"

# Run with input image (multi-modal)
node tests/local/local-runner.js \
  --mock-mode \
  --prompt "Create an advertisement from this product" \
  --input-image tests/fixtures/input-images/product-photo.jpg
```

## Notes

- All sample images are programmatically generated
- Images are kept small for fast testing (< 100KB each)
- Test prompts cover common use cases and edge cases
- Fixtures are version controlled for consistency across environments
