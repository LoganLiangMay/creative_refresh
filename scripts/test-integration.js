const AWS = require('aws-sdk');
const axios = require('axios');

const lambda = new AWS.Lambda({ region: 'us-east-1' });

const CONTROLLER_FUNCTION = process.env.CONTROLLER_FUNCTION || 'rda-generator-controller-dev';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';

async function generateImages(prompt, maxImages = 10) {
    console.log('\\n=== Generating Images ===');
    console.log('Prompt:', prompt);
    console.log('Max Images:', maxImages);

    const payload = {
        httpMethod: 'POST',
        path: '/generate',
        body: JSON.stringify({
            customer_id: 'test_customer_001',
            user_prompt: prompt,
            openai_api_key: OPENAI_API_KEY,
            generation_config: {
                max_images: maxImages
            }
        })
    };

    const response = await lambda.invoke({
        FunctionName: CONTROLLER_FUNCTION,
        Payload: JSON.stringify(payload)
    }).promise();

    const result = JSON.parse(response.Payload);
    const body = JSON.parse(result.body);

    console.log('Response:', body);
    return body.job_id;
}

async function checkJobStatus(jobId) {
    const payload = {
        httpMethod: 'GET',
        path: `/jobs/${jobId}`,
        pathParameters: { id: jobId }
    };

    const response = await lambda.invoke({
        FunctionName: CONTROLLER_FUNCTION,
        Payload: JSON.stringify(payload)
    }).promise();

    const result = JSON.parse(response.Payload);
    return JSON.parse(result.body);
}

async function waitForCompletion(jobId, maxWaitSeconds = 180) {
    console.log(`\\nWaiting for job ${jobId} to complete...`);

    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (true) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > maxWaitSeconds) {
            throw new Error(`Timeout: Job ${jobId} did not complete in ${maxWaitSeconds}s`);
        }

        const job = await checkJobStatus(jobId);

        if (job.status === 'completed') {
            return job;
        } else if (job.status === 'failed') {
            throw new Error(`Job failed: ${JSON.stringify(job.error)}`);
        }

        console.log(`Status: ${job.status} | Progress: ${job.progress.completed}/${job.progress.total}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}

async function runTest() {
    try {
        console.log('========================================');
        console.log('RDA Image Generator - Integration Test');
        console.log('========================================');

        // Test 1: Basic generation
        console.log('\\nTest 1: Basic Text-Only Generation');
        const jobId1 = await generateImages(
            'Generate professional RDA images for an AI-powered tech startup focused on productivity tools',
            5
        );

        const job1 = await waitForCompletion(jobId1, 60);

        console.log('\\n=== Job Complete ===');
        console.log(`Total Images: ${job1.images.length}`);
        console.log(`Landscape: ${job1.images.filter(img => img.aspect_ratio === '1.91:1').length}`);
        console.log(`Square: ${job1.images.filter(img => img.aspect_ratio === '1:1').length}`);
        console.log(`Total Cost: $${job1.summary.total_cost}`);

        // Display sample images
        console.log('\\nSample Images:');
        job1.images.slice(0, 3).forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.s3_url}`);
            console.log(`     Aspect: ${img.aspect_ratio} | Cost: $${img.cost}`);
        });

        // Verify mock mode
        const isMockMode = job1.images[0].metadata.mock_mode;
        console.log(`\\nMock Mode: ${isMockMode ? 'ENABLED (Free)' : 'DISABLED (Real)'}`);

        if (isMockMode && job1.summary.total_cost > 0) {
            console.error('ERROR: Mock mode should have zero cost!');
            process.exit(1);
        }

        console.log('\\n========================================');
        console.log('All tests passed successfully!');
        console.log('========================================');

    } catch (error) {
        console.error('\\nTest failed:', error.message);
        process.exit(1);
    }
}

// Run the test
runTest();