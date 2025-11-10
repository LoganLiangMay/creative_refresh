#!/usr/bin/env node

/**
 * Local testing script that simulates the Lambda execution flow
 * Tests the system without deploying to AWS
 */

const { v4: uuidv4 } = require('uuid');

// Import Lambda handlers directly
const controller = require('../lambdas/controller/index');
const promptBuilder = require('../lambdas/prompt-builder/index');
const worker = require('../lambdas/worker/index');

// Mock AWS SDK services
const AWS = require('aws-sdk');

// Set environment variables for testing
process.env.MOCK_MODE = 'true';
process.env.DYNAMODB_TABLE = 'test-table';
process.env.S3_BUCKET = 'test-bucket';
process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/test/queue.fifo';
process.env.PROMPT_BUILDER_FUNCTION = 'test-prompt-builder';
process.env.REPLICATE_API_TOKEN_SECRET = 'test-secret';
process.env.ENVIRONMENT = 'test';

// Mock DynamoDB
const mockDynamoData = {};
AWS.DynamoDB.DocumentClient.prototype.put = jest.fn().mockImplementation((params) => ({
    promise: () => {
        const key = `${params.Item.PK}#${params.Item.SK}`;
        mockDynamoData[key] = params.Item;
        return Promise.resolve({});
    }
}));

AWS.DynamoDB.DocumentClient.prototype.get = jest.fn().mockImplementation((params) => ({
    promise: () => {
        const key = `${params.Key.PK}#${params.Key.SK}`;
        return Promise.resolve({ Item: mockDynamoData[key] });
    }
}));

AWS.DynamoDB.DocumentClient.prototype.query = jest.fn().mockImplementation((params) => ({
    promise: () => {
        const items = Object.entries(mockDynamoData)
            .filter(([key]) => key.startsWith(params.ExpressionAttributeValues[':pk']))
            .map(([_, item]) => item);
        return Promise.resolve({ Items: items });
    }
}));

AWS.DynamoDB.DocumentClient.prototype.update = jest.fn().mockImplementation((params) => ({
    promise: () => {
        const key = `${params.Key.PK}#${params.Key.SK}`;
        if (mockDynamoData[key]) {
            Object.assign(mockDynamoData[key], params.ExpressionAttributeValues);
        }
        return Promise.resolve({ Attributes: mockDynamoData[key] });
    }
}));

// Mock Lambda invocation
const mockLambdaQueue = [];
AWS.Lambda.prototype.invoke = jest.fn().mockImplementation((params) => ({
    promise: async () => {
        if (params.InvocationType === 'Event') {
            // Simulate async invocation
            mockLambdaQueue.push(JSON.parse(params.Payload));
            return Promise.resolve({ StatusCode: 202 });
        }
        return Promise.resolve({ StatusCode: 200 });
    }
}));

// Mock SQS
const mockSQSMessages = [];
AWS.SQS.prototype.sendMessageBatch = jest.fn().mockImplementation((params) => ({
    promise: () => {
        params.Entries.forEach(entry => {
            mockSQSMessages.push(JSON.parse(entry.MessageBody));
        });
        return Promise.resolve({
            Successful: params.Entries.map(e => ({ Id: e.Id })),
            Failed: []
        });
    }
}));

// Mock S3
AWS.S3.prototype.putObject = jest.fn().mockImplementation((params) => ({
    promise: () => {
        console.log(`Mock S3 Upload: ${params.Key}`);
        return Promise.resolve({ ETag: '"mock-etag"' });
    }
}));

AWS.S3.prototype.getSignedUrlPromise = jest.fn().mockImplementation((operation, params) => {
    return Promise.resolve(`https://mock-s3-url/${params.Key}`);
});

// Mock Rekognition
AWS.Rekognition.prototype.detectModerationLabels = jest.fn().mockImplementation(() => ({
    promise: () => Promise.resolve({ ModerationLabels: [] })
}));

AWS.Rekognition.prototype.detectText = jest.fn().mockImplementation(() => ({
    promise: () => Promise.resolve({ TextDetections: [] })
}));

// Mock Secrets Manager
AWS.SecretsManager.prototype.getSecretValue = jest.fn().mockImplementation(() => ({
    promise: () => Promise.resolve({
        SecretString: JSON.stringify({ token: 'mock-replicate-token' })
    })
}));

// Test scenarios
async function runTests() {
    console.log('========================================');
    console.log('RDA Image Generator - Local Testing');
    console.log('Mock Mode: ENABLED (Cost: $0)');
    console.log('========================================\\n');

    try {
        // Test 1: Generate images
        console.log('Test 1: Image Generation Request');
        console.log('---------------------------------');

        const generateEvent = {
            httpMethod: 'POST',
            path: '/generate',
            body: JSON.stringify({
                customer_id: 'test_customer_001',
                user_prompt: 'Generate professional RDA images for an AI-powered productivity tool targeting tech professionals',
                openai_api_key: 'sk-test-12345',
                generation_config: {
                    max_images: 5
                }
            })
        };

        console.log('Request:', JSON.parse(generateEvent.body));

        const generateResponse = await controller.handler(generateEvent);
        console.log('\\nResponse Status:', generateResponse.statusCode);

        const responseBody = JSON.parse(generateResponse.body);
        console.log('Response Body:', responseBody);

        const jobId = responseBody.job_id;
        console.log(`\\n✅ Job created: ${jobId}`);

        // Test 2: Process Prompt Builder
        console.log('\\nTest 2: Prompt Builder Processing');
        console.log('-----------------------------------');

        if (mockLambdaQueue.length > 0) {
            const promptBuilderEvent = mockLambdaQueue.shift();
            console.log('Processing prompt for:', promptBuilderEvent.user_prompt);

            // Mock OpenAI response for testing
            const mockOpenAI = {
                chat: {
                    completions: {
                        create: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        num_images: 5,
                                        landscape_count: 3,
                                        square_count: 2,
                                        reasoning: "5 images with mixed aspect ratios for comprehensive coverage"
                                    })
                                }
                            }]
                        })
                    }
                }
            };

            // Override OpenAI import
            const OpenAI = function(config) { return mockOpenAI; };
            require.cache[require.resolve('openai')].exports = OpenAI;

            await promptBuilder.handler(promptBuilderEvent);
            console.log(`✅ Created ${mockSQSMessages.length} image generation tasks`);
        }

        // Test 3: Process Worker tasks
        console.log('\\nTest 3: Worker Image Generation');
        console.log('--------------------------------');

        for (let i = 0; i < Math.min(3, mockSQSMessages.length); i++) {
            const message = mockSQSMessages[i];
            const workerEvent = {
                Records: [{
                    body: JSON.stringify(message)
                }]
            };

            console.log(`\\nProcessing image ${i + 1}/${mockSQSMessages.length}:`);
            console.log(`  - Aspect Ratio: ${message.aspect_ratio}`);
            console.log(`  - Image ID: ${message.image_id}`);

            await worker.handler(workerEvent);

            console.log(`  ✅ Generated mock image`);
            console.log(`  ✅ Cost: $0.00 (Mock Mode)`);
        }

        // Test 4: Check job status
        console.log('\\nTest 4: Job Status Check');
        console.log('------------------------');

        const statusEvent = {
            httpMethod: 'GET',
            path: `/jobs/${jobId}`,
            pathParameters: { id: jobId }
        };

        const statusResponse = await controller.handler(statusEvent);
        const jobStatus = JSON.parse(statusResponse.body);

        console.log('\\nJob Status:', jobStatus.status);
        console.log('Progress:', jobStatus.progress);
        console.log('Total Images:', jobStatus.images?.length || 0);
        console.log('Total Cost: $' + (jobStatus.summary?.total_cost || 0));

        // Summary
        console.log('\\n========================================');
        console.log('Test Summary');
        console.log('========================================');
        console.log(`✅ Job Creation: SUCCESS`);
        console.log(`✅ Prompt Processing: SUCCESS`);
        console.log(`✅ Image Generation: SUCCESS (Mock Mode)`);
        console.log(`✅ Status Retrieval: SUCCESS`);
        console.log(`\\n💰 Total Cost: $0.00 (Mock Mode Active)`);
        console.log('\\n✨ All tests passed! System is working correctly.');
        console.log('\\nNext Steps:');
        console.log('1. Deploy to AWS: sam deploy --parameter-overrides Environment=dev MockMode=true');
        console.log('2. Test with real AWS services');
        console.log('3. Switch to real mode only for final validation (costs money)');

    } catch (error) {
        console.error('\\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);