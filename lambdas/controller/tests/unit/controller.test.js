/**
 * Controller Lambda Unit Tests
 * Task 1.3 from PRD.md Section 2.2
 */

// Set up AWS SDK before imports
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');

// Set up AWS SDK
AWS.config.update({ 
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

// Set AWS mock to use the same AWS instance
AWSMock.setSDKInstance(AWS);

// Import the handler
const { handler } = require('../../index');

describe('Controller Lambda', () => {
    beforeEach(() => {
        // Reset environment variables
        process.env.DYNAMODB_TABLE = 'RDAImageJobs-test';
        process.env.PROMPT_BUILDER_FUNCTION = 'rda-prompt-builder-test';
        process.env.ENVIRONMENT = 'test';
        process.env.MOCK_MODE = 'true';

        // Mock console to reduce noise in tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        AWSMock.restore();
        jest.restoreAllMocks();
    });

    describe('POST /generate', () => {
        const validRequest = {
            httpMethod: 'POST',
            path: '/generate',
            body: JSON.stringify({
                customer_id: 'test_customer_001',
                user_prompt: 'Generate RDA images for a tech startup focused on AI',
                openai_api_key: 'sk-test-key-123456789'
            })
        };

        it('should successfully create job with valid input', async () => {
            // Mock DynamoDB put
            AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
                expect(params.TableName).toBe('RDAImageJobs-test');
                expect(params.Item.customer_id).toBe('test_customer_001');
                expect(params.Item.status).toBe('queued');
                callback(null, {});
            });

            // Mock Lambda invoke
            AWSMock.mock('Lambda', 'invoke', (params, callback) => {
                expect(params.FunctionName).toBe('rda-prompt-builder-test');
                expect(params.InvocationType).toBe('Event');
                const payload = JSON.parse(params.Payload);
                expect(payload.customer_id).toBe('test_customer_001');
                callback(null, { StatusCode: 202 });
            });

            const response = await handler(validRequest);

            expect(response.statusCode).toBe(202);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('queued');
            expect(body.job_id).toMatch(/^job_[a-f0-9]{8}$/);
            expect(body.status_url).toMatch(/^\/jobs\/job_[a-f0-9]{8}$/);
            expect(body.estimated_completion_seconds).toBe(10); // Mock mode
        });

        it('should fail when missing customer_id', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    user_prompt: 'Generate images',
                    openai_api_key: 'sk-test-key'
                })
            };

            const response = await handler(request);

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation Error');
            expect(body.errors).toContain('customer_id is required');
        });

        it('should fail when missing user_prompt', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    openai_api_key: 'sk-test-key'
                })
            };

            const response = await handler(request);

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation Error');
            expect(body.errors).toContain('user_prompt is required');
        });

        it('should fail when missing openai_api_key', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images for tech startup'
                })
            };

            const response = await handler(request);

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation Error');
            expect(body.errors).toContain('openai_api_key is required');
        });

        it('should fail when openai_api_key has invalid format', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images for tech startup',
                    openai_api_key: 'invalid-key-format'
                })
            };

            const response = await handler(request);

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation Error');
            expect(body.errors).toContain('openai_api_key must be a valid OpenAI API key (starts with sk-)');
        });

        it('should create DynamoDB record with correct structure', async () => {
            let dynamoParams;

            AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
                dynamoParams = params;
                callback(null, {});
            });

            AWSMock.mock('Lambda', 'invoke', (params, callback) => {
                callback(null, { StatusCode: 202 });
            });

            await handler(validRequest);

            expect(dynamoParams.Item).toMatchObject({
                customer_id: 'test_customer_001',
                status: 'queued',
                user_prompt: 'Generate RDA images for a tech startup focused on AI',
                progress: {
                    total: 0,
                    completed: 0,
                    failed: 0
                }
            });
            expect(dynamoParams.Item.PK).toMatch(/^job_/);
            expect(dynamoParams.Item.SK).toBe('JOB#metadata');
        });

        it('should invoke Prompt Builder Lambda with correct payload', async () => {
            let lambdaParams;

            AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
                callback(null, {});
            });

            AWSMock.mock('Lambda', 'invoke', (params, callback) => {
                lambdaParams = params;
                callback(null, { StatusCode: 202 });
            });

            await handler(validRequest);

            expect(lambdaParams.FunctionName).toBe('rda-prompt-builder-test');
            expect(lambdaParams.InvocationType).toBe('Event');

            const payload = JSON.parse(lambdaParams.Payload);
            expect(payload).toMatchObject({
                customer_id: 'test_customer_001',
                user_prompt: 'Generate RDA images for a tech startup focused on AI',
                openai_api_key: 'sk-test-key-123456789'
            });
            expect(payload.job_id).toMatch(/^job_/);
        });

        it('should handle generation_config correctly', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images',
                    openai_api_key: 'sk-test-key',
                    generation_config: {
                        max_images: 5,
                        style_preset: 'photorealistic'
                    }
                })
            };

            AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
                expect(params.Item.generation_config).toEqual({
                    max_images: 5,
                    style_preset: 'photorealistic'
                });
                callback(null, {});
            });

            AWSMock.mock('Lambda', 'invoke', (params, callback) => {
                callback(null, { StatusCode: 202 });
            });

            const response = await handler(request);

            expect(response.statusCode).toBe(202);
            const body = JSON.parse(response.body);
            expect(body.estimated_completion_seconds).toBe(5); // 5 images in mock mode
        });

        it('should validate max_images range', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images',
                    openai_api_key: 'sk-test-key',
                    generation_config: {
                        max_images: 25 // Too high
                    }
                })
            };

            const response = await handler(request);

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.errors).toContain('generation_config.max_images must be an integer between 1 and 20');
        });
    });

    describe('GET /jobs/{id}', () => {
        it('should return job with images', async () => {
            const jobId = 'job_12345678';

            AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
                expect(params.TableName).toBe('RDAImageJobs-test');
                expect(params.KeyConditionExpression).toBe('PK = :pk');
                expect(params.ExpressionAttributeValues[':pk']).toBe(jobId);

                callback(null, {
                    Items: [
                        {
                            PK: jobId,
                            SK: 'JOB#metadata',
                            job_id: jobId,
                            customer_id: 'test_customer',
                            status: 'completed',
                            user_prompt: 'Test prompt',
                            created_at: '2024-01-01T00:00:00Z',
                            updated_at: '2024-01-01T00:01:00Z',
                            progress: { total: 2, completed: 2, failed: 0 }
                        },
                        {
                            PK: jobId,
                            SK: 'IMAGE#001',
                            image_id: 'img_001',
                            image_index: 0,
                            s3_url: 'https://s3.amazonaws.com/bucket/image1.jpg',
                            aspect_ratio: '1.91:1',
                            dimensions: '1200x628',
                            status: 'completed',
                            cost: 0,
                            generated_at: '2024-01-01T00:00:30Z'
                        },
                        {
                            PK: jobId,
                            SK: 'IMAGE#002',
                            image_id: 'img_002',
                            image_index: 1,
                            s3_url: 'https://s3.amazonaws.com/bucket/image2.jpg',
                            aspect_ratio: '1:1',
                            dimensions: '1200x1200',
                            status: 'completed',
                            cost: 0,
                            generated_at: '2024-01-01T00:00:45Z'
                        }
                    ]
                });
            });

            const response = await handler({
                httpMethod: 'GET',
                path: `/jobs/${jobId}`,
                pathParameters: { id: jobId }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.job_id).toBe(jobId);
            expect(body.status).toBe('completed');
            expect(body.images).toHaveLength(2);
            expect(body.images[0].image_id).toBe('img_001');
            expect(body.images[1].image_id).toBe('img_002');
            expect(body.summary.total_cost).toBe(0);
            expect(body.summary.total_images).toBe(2);
        });

        it('should return 404 for non-existent job', async () => {
            const jobId = 'job_nonexistent';

            AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
                callback(null, { Items: [] });
            });

            const response = await handler({
                httpMethod: 'GET',
                path: `/jobs/${jobId}`,
                pathParameters: { id: jobId }
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain(jobId);
        });

        it('should return correct progress for partial completion', async () => {
            const jobId = 'job_partial';

            AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
                callback(null, {
                    Items: [
                        {
                            PK: jobId,
                            SK: 'JOB#metadata',
                            job_id: jobId,
                            status: 'processing',
                            progress: { total: 5, completed: 2, failed: 1 }
                        },
                        {
                            PK: jobId,
                            SK: 'IMAGE#001',
                            status: 'completed',
                            cost: 0
                        },
                        {
                            PK: jobId,
                            SK: 'IMAGE#002',
                            status: 'completed',
                            cost: 0
                        },
                        {
                            PK: jobId,
                            SK: 'IMAGE#003',
                            status: 'failed',
                            cost: 0
                        }
                    ]
                });
            });

            const response = await handler({
                httpMethod: 'GET',
                path: `/jobs/${jobId}`
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.progress.completed).toBe(2);
            expect(body.progress.failed).toBe(1);
        });
    });

    describe('POST /regenerate', () => {
        it('should return 501 Not Implemented for Phase 2 feature', async () => {
            const response = await handler({
                httpMethod: 'POST',
                path: '/regenerate',
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    image_id: 'img_001',
                    new_prompt: 'Updated prompt'
                })
            });

            expect(response.statusCode).toBe(501);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Not Implemented');
            expect(body.phase).toBe(2);
            expect(body.message).toContain('Phase 2');
        });
    });

    describe('GET /regenerations/{id}', () => {
        it('should return 501 Not Implemented for Phase 2 feature', async () => {
            const response = await handler({
                httpMethod: 'GET',
                path: '/regenerations/regen_123',
                pathParameters: { id: 'regen_123' }
            });

            expect(response.statusCode).toBe(501);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Not Implemented');
            expect(body.phase).toBe(2);
        });
    });

    describe('Error handling', () => {
        it('should return 404 for unknown path', async () => {
            const response = await handler({
                httpMethod: 'GET',
                path: '/unknown',
                pathParameters: {}
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Not Found');
        });

        it('should return 400 for invalid JSON', async () => {
            const response = await handler({
                httpMethod: 'POST',
                path: '/generate',
                body: 'invalid json {'
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Invalid JSON');
        });

        it('should handle DynamoDB errors gracefully', async () => {
            const validRequest = {
                httpMethod: 'POST',
                path: '/generate',
                body: JSON.stringify({
                    customer_id: 'test_customer_001',
                    user_prompt: 'Generate RDA images for a tech startup focused on AI',
                    openai_api_key: 'sk-test-key-123456789'
                })
            };

            AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
                callback(new Error('DynamoDB error'));
            });

            const response = await handler(validRequest);

            expect(response.statusCode).toBe(500);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Internal Server Error');
        });
    });
});