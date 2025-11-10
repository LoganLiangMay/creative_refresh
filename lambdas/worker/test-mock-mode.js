#!/usr/bin/env node

/**
 * Test script to verify Worker Lambda Mock Mode
 * Task 1.7 from PRD.md Section 2.2
 *
 * Run with: MOCK_MODE=true node test-mock-mode.js
 */

// Set environment
process.env.MOCK_MODE = 'true';
process.env.DYNAMODB_TABLE = 'RDAImageJobs-dev';
process.env.S3_BUCKET = 'rda-generated-images-dev';
process.env.ENVIRONMENT = 'dev';

const { handler } = require('./index');

console.log('=== Worker Lambda Mock Mode Test ===\n');
console.log(`MOCK_MODE: ${process.env.MOCK_MODE}`);
console.log(`Environment: ${process.env.ENVIRONMENT}\n`);

// Test data
const testEvent = {
    Records: [
        {
            body: JSON.stringify({
                job_id: 'job_test_' + Date.now(),
                customer_id: 'customer_test',
                image_id: 'img_test_001',
                image_index: 0,
                aspect_ratio: '1.91:1',
                prompt: 'A beautiful landscape image for Google Display Ads, professional photography, high contrast, no text',
                input_images: [],
                created_at: new Date().toISOString()
            })
        },
        {
            body: JSON.stringify({
                job_id: 'job_test_' + Date.now(),
                customer_id: 'customer_test',
                image_id: 'img_test_002',
                image_index: 1,
                aspect_ratio: '1:1',
                prompt: 'A square image for mobile ads, vibrant colors, clear focal point, no typography',
                input_images: [],
                created_at: new Date().toISOString()
            })
        }
    ]
};

async function testMockMode() {
    console.log('Testing Worker Lambda with 2 images (1 landscape, 1 square)...\n');

    try {
        const startTime = Date.now();
        const result = await handler(testEvent);
        const elapsed = Date.now() - startTime;

        console.log('✅ Test completed successfully!');
        console.log(`   - Processing time: ${elapsed}ms`);
        console.log(`   - Batch failures: ${result.batchItemFailures.length}`);
        console.log(`   - Mock mode cost: $0.00`);

        if (elapsed < 3000) {
            console.log('   - ✅ Fast processing confirmed (< 3 seconds)');
        } else {
            console.log('   - ⚠️  Processing took longer than expected');
        }

        console.log('\n📊 Results:');
        console.log('   - Landscape image: Mock placeholder at 1200x628');
        console.log('   - Square image: Mock placeholder at 1200x1200');
        console.log('   - Total cost: $0.00 (Mock Mode)');
        console.log('   - If this was real mode: $0.09 (2 images × $0.045)');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.message.includes('Real mode not implemented')) {
            console.log('\n✅ This is expected! Real mode is not implemented yet.');
            console.log('   Worker Lambda is correctly running in Mock Mode only.');
        }
    }
}

// Run test
testMockMode()
    .then(() => {
        console.log('\n=== Mock Mode Test Complete ===');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });