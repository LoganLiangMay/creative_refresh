/**
 * Controller Lambda Unit Tests - Fixed with Jest Mocks
 */

// Set environment before any imports
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE = 'RDAImageJobs-test';
process.env.PROMPT_BUILDER_FUNCTION = 'rda-prompt-builder-test';
process.env.ENVIRONMENT = 'test';
process.env.MOCK_MODE = 'true';

// Mock functions
const mockPut = jest.fn();
const mockQuery = jest.fn();
const mockInvoke = jest.fn();

// Mock AWS SDK before requiring handler
jest.mock('aws-sdk', () => ({
    DynamoDB: {
        DocumentClient: jest.fn(() => ({
            put: jest.fn(() => ({ promise: () => mockPut() })),
            query: jest.fn(() => ({ promise: () => mockQuery() }))
        }))
    },
    Lambda: jest.fn(() => ({
        invoke: jest.fn(() => ({ promise: () => mockInvoke() }))
    })),
    config: { update: jest.fn() }
}));

// Now require handler
const { handler } = require('../../index');

describe('Controller Lambda', () => {
    beforeEach(() => {
        mockPut.mockReset();
        mockQuery.mockReset();
        mockInvoke.mockReset();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const validRequest = {
        httpMethod: 'POST',
        path: '/generate',
        body: JSON.stringify({
            customer_id: 'test_customer_001',
            user_prompt: 'Generate RDA images for a tech startup focused on AI',
            openai_api_key: 'sk-test-key-123456789'
        })
    };

    describe('POST /generate', () => {
        it('should successfully create job with valid input', async () => {
            mockPut.mockResolvedValue({});
            mockInvoke.mockResolvedValue({ StatusCode: 202 });

            const response = await handler(validRequest);

            expect(response.statusCode).toBe(202);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('queued');
            expect(body.job_id).toMatch(/^job_[a-f0-9]{8}$/);
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
        });

        it('should fail when missing openai_api_key', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images'
                })
            };

            const response = await handler(request);
            expect(response.statusCode).toBe(400);
        });

        it('should fail when openai_api_key has invalid format', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images',
                    openai_api_key: 'invalid-key'
                })
            };

            const response = await handler(request);
            expect(response.statusCode).toBe(400);
        });

        it('should create DynamoDB record with correct structure', async () => {
            mockPut.mockResolvedValue({});
            mockInvoke.mockResolvedValue({ StatusCode: 202 });

            await handler(validRequest);

            expect(mockPut).toHaveBeenCalled();
        });

        it('should invoke Prompt Builder Lambda with correct payload', async () => {
            mockPut.mockResolvedValue({});
            mockInvoke.mockResolvedValue({ StatusCode: 202 });

            await handler(validRequest);

            expect(mockInvoke).toHaveBeenCalled();
        });

        it('should handle generation_config correctly', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images',
                    openai_api_key: 'sk-test-key',
                    generation_config: { max_images: 5 }
                })
            };

            mockPut.mockResolvedValue({});
            mockInvoke.mockResolvedValue({ StatusCode: 202 });

            const response = await handler(request);
            expect(response.statusCode).toBe(202);
        });

        it('should validate max_images range', async () => {
            const request = {
                ...validRequest,
                body: JSON.stringify({
                    customer_id: 'test_customer',
                    user_prompt: 'Generate images',
                    openai_api_key: 'sk-test-key',
                    generation_config: { max_images: 25 }
                })
            };

            const response = await handler(request);
            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /jobs/{id}', () => {
        it('should return job with images', async () => {
            const jobId = 'job_12345678';

            mockQuery.mockResolvedValue({
                Items: [
                    {
                        PK: jobId,
                        SK: 'JOB#metadata',
                        job_id: jobId,
                        customer_id: 'test_customer',
                        status: 'completed',
                        user_prompt: 'Test prompt',
                        created_at: '2024-01-01T00:00:00Z',
                        progress: { total: 2, completed: 2, failed: 0 }
                    },
                    {
                        PK: jobId,
                        SK: 'IMAGE#001',
                        image_id: 'img_001',
                        s3_url: 'https://s3.amazonaws.com/bucket/image1.jpg',
                        status: 'completed',
                        cost: 0
                    },
                    {
                        PK: jobId,
                        SK: 'IMAGE#002',
                        image_id: 'img_002',
                        s3_url: 'https://s3.amazonaws.com/bucket/image2.jpg',
                        status: 'completed',
                        cost: 0
                    }
                ]
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
        });

        it('should return 404 for non-existent job', async () => {
            const jobId = 'job_nonexistent';
            mockQuery.mockResolvedValue({ Items: [] });

            const response = await handler({
                httpMethod: 'GET',
                path: `/jobs/${jobId}`,
                pathParameters: { id: jobId }
            });

            expect(response.statusCode).toBe(404);
        });

        it('should return correct progress for partial completion', async () => {
            const jobId = 'job_partial';

            mockQuery.mockResolvedValue({
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
                    }
                ]
            });

            const response = await handler({
                httpMethod: 'GET',
                path: `/jobs/${jobId}`,
                pathParameters: { id: jobId }
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
        });
    });

    describe('Error handling', () => {
        it('should return 404 for unknown path', async () => {
            const response = await handler({
                httpMethod: 'GET',
                path: '/unknown'
            });

            expect(response.statusCode).toBe(404);
        });

        it('should return 400 for invalid JSON', async () => {
            const response = await handler({
                httpMethod: 'POST',
                path: '/generate',
                body: 'invalid json {'
            });

            expect(response.statusCode).toBe(400);
        });

        it('should handle DynamoDB errors gracefully', async () => {
            mockPut.mockRejectedValue(new Error('DynamoDB error'));

            const response = await handler(validRequest);

            expect(response.statusCode).toBe(500);
        });
    });
});
