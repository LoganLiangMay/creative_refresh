/**
 * Test Image Processor Utility
 * Validates image processing functionality
 */

const path = require('path');
const imageProcessor = require('../utils/image-processor');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'input-images');

async function testSingleImage() {
    console.log('\n🧪 Test 1: Process Single Image\n');

    const imagePath = path.join(FIXTURES_DIR, 'product-photo.jpg');

    try {
        const result = await imageProcessor.processImage(imagePath);

        console.log('✅ Result:', {
            source: path.basename(result.source),
            format: result.format,
            size: `${(result.size / 1024).toFixed(1)}KB`,
            dataUrlLength: result.dataUrl.length
        });

        // Verify data URL format
        if (!result.dataUrl.startsWith('data:image/')) {
            throw new Error('Invalid data URL format');
        }

        console.log('✅ Data URL format valid');
        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testMultipleImages() {
    console.log('\n🧪 Test 2: Process Multiple Images\n');

    const images = [
        path.join(FIXTURES_DIR, 'product-photo.jpg'),
        path.join(FIXTURES_DIR, 'brand-logo.png'),
        path.join(FIXTURES_DIR, 'stock-image.jpg')
    ];

    try {
        const results = await imageProcessor.processImages(images);

        console.log(`✅ Processed ${results.length} images:`);
        results.forEach((result, i) => {
            console.log(`   ${i + 1}. ${path.basename(result.source)} - ${result.format}, ${(result.size / 1024).toFixed(1)}KB`);
        });

        if (results.length !== images.length) {
            throw new Error(`Expected ${images.length} results, got ${results.length}`);
        }

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testPrepareInputImages() {
    console.log('\n🧪 Test 3: Prepare Input Images (Full Pipeline)\n');

    const images = [
        path.join(FIXTURES_DIR, 'product-photo.jpg'),
        path.join(FIXTURES_DIR, 'brand-logo.png')
    ];

    try {
        const prepared = await imageProcessor.prepareInputImages(images);

        console.log('✅ Prepared images:', {
            count: prepared.dataUrls.length,
            totalSize: `${(prepared.totalSize / 1024).toFixed(1)}KB`,
            dataUrlLengths: prepared.dataUrls.map(url => url.length)
        });

        if (prepared.dataUrls.length !== images.length) {
            throw new Error('Data URL count mismatch');
        }

        // Verify all are valid data URLs
        const allValid = prepared.dataUrls.every(url => url.startsWith('data:image/'));
        if (!allValid) {
            throw new Error('Some data URLs are invalid');
        }

        console.log('✅ All data URLs valid');
        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testEmptyArray() {
    console.log('\n🧪 Test 4: Empty Input Array\n');

    try {
        const prepared = await imageProcessor.prepareInputImages([]);

        if (prepared.dataUrls.length !== 0 || prepared.totalSize !== 0) {
            throw new Error('Expected empty result');
        }

        console.log('✅ Empty array handled correctly');
        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testGetImageInfo() {
    console.log('\n🧪 Test 5: Get Image Info\n');

    const imagePath = path.join(FIXTURES_DIR, 'test-image.jpg');

    try {
        const info = await imageProcessor.getImageInfo(imagePath);

        console.log('✅ Image info:', {
            source: path.basename(info.source),
            format: info.format,
            sizeKB: info.sizeKB,
            sizeMB: info.sizeMB
        });

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testInvalidFile() {
    console.log('\n🧪 Test 6: Invalid File Path\n');

    try {
        await imageProcessor.processImage('/nonexistent/file.jpg');
        console.error('❌ Should have thrown error for nonexistent file');
        return false;
    } catch (error) {
        if (error.message.includes('File not found')) {
            console.log('✅ Correctly rejected nonexistent file');
            return true;
        }
        console.error('❌ Unexpected error:', error.message);
        return false;
    }
}

async function testValidation() {
    console.log('\n🧪 Test 7: Replicate API Validation\n');

    const images = [
        path.join(FIXTURES_DIR, 'product-photo.jpg'),
        path.join(FIXTURES_DIR, 'brand-logo.png')
    ];

    try {
        const processed = await imageProcessor.processImages(images);
        const validation = imageProcessor.validateForReplicate(processed);

        console.log('✅ Validation result:', validation);

        if (!validation.valid) {
            console.error('❌ Validation failed unexpectedly');
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Image Processor Test Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tests = [
        { name: 'Single Image', fn: testSingleImage },
        { name: 'Multiple Images', fn: testMultipleImages },
        { name: 'Prepare Input Images', fn: testPrepareInputImages },
        { name: 'Empty Array', fn: testEmptyArray },
        { name: 'Get Image Info', fn: testGetImageInfo },
        { name: 'Invalid File', fn: testInvalidFile },
        { name: 'Validation', fn: testValidation }
    ];

    const results = [];

    for (const test of tests) {
        const passed = await test.fn();
        results.push({ name: test.name, passed });
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
    });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total: ${passed}/${total} passed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(passed === total ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests };
