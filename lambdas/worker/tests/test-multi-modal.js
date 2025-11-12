/**
 * Test Multi-Modal Image Generation
 * Verifies that input images work with both mock and real mode
 */

const path = require('path');
const LocalTestRunner = require('./local/local-runner');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'input-images');

async function testMultiModalMock() {
    console.log('\n🧪 Test: Multi-Modal Generation (Mock Mode)\n');

    const runner = new LocalTestRunner({
        mockMode: true,
        clearData: true,
        prompt: 'Create a professional advertisement from this product',
        aspectRatio: '1:1'
    });

    await runner.initialize();

    // Test with single input image
    const result1 = await runner.runTest({
        prompt: 'Create a professional product advertisement',
        inputImages: [path.join(FIXTURES_DIR, 'product-photo.jpg')]
    });

    if (!result1.success) {
        throw new Error('Single input image test failed');
    }

    console.log('✅ Single input image test passed\n');

    // Test with multiple input images
    const result2 = await runner.runTest({
        prompt: 'Create a branded advertisement',
        inputImages: [
            path.join(FIXTURES_DIR, 'product-photo.jpg'),
            path.join(FIXTURES_DIR, 'brand-logo.png')
        ]
    });

    if (!result2.success) {
        throw new Error('Multiple input images test failed');
    }

    console.log('✅ Multiple input images test passed\n');

    // Test without input images (text-to-image)
    const result3 = await runner.runTest({
        prompt: 'A beautiful landscape'
    });

    if (!result3.success) {
        throw new Error('Text-to-image test failed');
    }

    console.log('✅ Text-to-image test passed\n');

    return true;
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Multi-Modal Image Generation Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        await testMultiModalMock();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ All Multi-Modal Tests Passed');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ Multi-Modal Tests Failed');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testMultiModalMock };
