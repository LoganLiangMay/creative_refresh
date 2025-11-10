/**
 * Worker Lambda Unit Tests
 * Comprehensive test coverage for Mock Mode and Real Mode
 * Tests Task 1.7 (Mock Mode) and Task 1.8 (Real Replicate Integration)
 */

// Set environment variables before requiring anything
process.env.MOCK_MODE = 'true';
process.env.DYNAMODB_TABLE = 'RDAImageJobs-test';
process.env.S3_BUCKET = 'rda-generated-images-test';
process.env.ENVIRONMENT = 'test';
process.env.REPLICATE_SECRET_NAME = 'rda-generator/replicate-token-test';

// Mock AWS SDK before requiring anything else
jest.mock('aws-sdk', () => {
    const mockDynamoDBPut = jest.fn();
    const mockDynamoDBUpdate = jest.fn();
    const mockDynamoDBGet = jest.fn();
    const mockS3PutObject = jest.fn();
    const mockRekognitionDetectModerationLabels = jest.fn();
    const mockRekognitionDetectText = jest.fn();
    const mockRekognitionDetectLabels = jest.fn();
    const mockSecretsManagerGetSecretValue = jest.fn();

    return {
        S3: jest.fn(() => ({
            putObject: jest.fn((params) => ({
                promise: () => mockS3PutObject(params)
            }))
        })),
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                put: jest.fn((params) => ({
                    promise: () => mockDynamoDBPut(params)
                })),
                update: jest.fn((params) => ({
                    promise: () => mockDynamoDBUpdate(params)
                })),
                get: jest.fn((params) => ({
                    promise: () => mockDynamoDBGet(params)
                }))
            }))
        },
        Rekognition: jest.fn(() => ({
            detectModerationLabels: jest.fn((params) => ({
                promise: () => mockRekognitionDetectModerationLabels(params)
            })),
            detectText: jest.fn((params) => ({
                promise: () => mockRekognitionDetectText(params)
            })),
            detectLabels: jest.fn((params) => ({
                promise: () => mockRekognitionDetectLabels(params)
            }))
        })),
        SecretsManager: jest.fn(() => ({
            getSecretValue: jest.fn((params) => ({
                promise: () => mockSecretsManagerGetSecretValue(params)
            }))
        })),
        config: {
            update: jest.fn()
        },
        // Export mocks for test access
        __mockDynamoDBPut: mockDynamoDBPut,
        __mockDynamoDBUpdate: mockDynamoDBUpdate,
        __mockDynamoDBGet: mockDynamoDBGet,
        __mockS3PutObject: mockS3PutObject,
        __mockRekognitionDetectModerationLabels: mockRekognitionDetectModerationLabels,
        __mockRekognitionDetectText: mockRekognitionDetectText,
        __mockRekognitionDetectLabels: mockRekognitionDetectLabels,
        __mockSecretsManagerGetSecretValue: mockSecretsManagerGetSecretValue
    };
});

// Mock the MockGenerator module
jest.mock('../../utils/mockGenerator', () => ({
    generateImage: jest.fn(),
    simulateDelay: jest.fn(),
    getPlaceholderUrl: jest.fn()
}));

// Mock axios for image download
jest.mock('axios');
const axios = require('axios');

// Mock Replicate
jest.mock('replicate');
const Replicate = require('replicate');

// Mock sharp for image processing
jest.mock('sharp');
const sharp = require('sharp');

// Import after mocking
const { handler } = require('../../index');
const AWS = require('aws-sdk');
const MockGenerator = require('../../utils/mockGenerator');

describe('Worker Lambda Tests', () => {
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Set up default successful mocks
        AWS.__mockDynamoDBPut.mockResolvedValue({});
        AWS.__mockDynamoDBUpdate.mockResolvedValue({});
        AWS.__mockDynamoDBGet.mockResolvedValue({
            Item: {
                progress: {
                    total: 1,
                    completed: 0,
                    processing: 0,
                    failed: 0
                }
            }
        });
        AWS.__mockS3PutObject.mockResolvedValue({});

        // Default Rekognition responses (valid image)
        AWS.__mockRekognitionDetectModerationLabels.mockResolvedValue({
            ModerationLabels: []
        });
        AWS.__mockRekognitionDetectText.mockResolvedValue({
            TextDetections: []
        });
        AWS.__mockRekognitionDetectLabels.mockResolvedValue({
            Labels: [
                { Name: 'Nature', Confidence: 85 },
                { Name: 'Landscape', Confidence: 80 }
            ]
        });

        // Default MockGenerator responses
        MockGenerator.generateImage.mockResolvedValue({
            buffer: Buffer.from('mock-image-data'),
            generationTime: 800
        });
    });

    describe('Mock Mode Tests', () => {
        beforeEach(() => {
            process.env.MOCK_MODE = 'true';
        });

        describe('✅ Mock Image Generation', () => {
            it('generates mock image with correct dimensions for landscape (1.91:1)', async () => {
                const event = createTestEvent({
                    aspect_ratio: '1.91:1',
                    prompt: 'Test landscape image'
                });

                const result = await handler(event);

                expect(result.batchItemFailures).toEqual([]);
                expect(MockGenerator.generateImage).toHaveBeenCalledWith(
                    '1.91:1',
                    'Test landscape image',
                    0
                );

                // Verify DynamoDB record includes correct dimensions
                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord).toBeDefined();
                expect(imageRecord[0].Item.dimensions).toBe('1200x628');
            });

            it('generates mock image with correct dimensions for square (1:1)', async () => {
                const event = createTestEvent({
                    aspect_ratio: '1:1',
                    prompt: 'Test square image'
                });

                await handler(event);

                expect(MockGenerator.generateImage).toHaveBeenCalledWith(
                    '1:1',
                    'Test square image',
                    0
                );

                // Verify DynamoDB record includes correct dimensions
                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.dimensions).toBe('1200x1200');
            });
        });

        describe('✅ Cost Verification', () => {
            it('has zero cost in mock mode', async () => {
                const event = createTestEvent();
                await handler(event);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.cost).toBe(0);
            });
        });

        describe('✅ S3 Upload', () => {
            it('uploads to S3 successfully with correct metadata', async () => {
                const event = createTestEvent({
                    customer_id: 'customer_123',
                    job_id: 'job_456',
                    image_id: 'img_789'
                });

                await handler(event);

                expect(AWS.__mockS3PutObject).toHaveBeenCalledWith(
                    expect.objectContaining({
                        Bucket: 'rda-generated-images-test',
                        Key: 'customer_123/job_456/img_789_v1.jpg',
                        ContentType: 'image/jpeg',
                        Metadata: expect.objectContaining({
                            generated_by: 'mock',
                            environment: 'test'
                        }),
                        Tags: expect.stringContaining('MockMode=true')
                    })
                );
            });
        });

        describe('✅ DynamoDB Operations', () => {
            it('writes to DynamoDB with mock_mode=true', async () => {
                const event = createTestEvent();
                await handler(event);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );

                expect(imageRecord[0].Item.mock_mode).toBe(true);
                expect(imageRecord[0].Item.status).toBe('completed');
                expect(imageRecord[0].Item.s3_url).toBeDefined();
            });

            it('updates job progress correctly', async () => {
                const event = createTestEvent();
                await handler(event);

                const updateCalls = AWS.__mockDynamoDBUpdate.mock.calls;
                const progressUpdate = updateCalls.find(call =>
                    call[0].UpdateExpression &&
                    call[0].UpdateExpression.includes('progress.completed')
                );

                expect(progressUpdate).toBeDefined();
                expect(progressUpdate[0].ExpressionAttributeValues[':completed']).toBe(1);
            });
        });

        describe('✅ Performance', () => {
            it('completes in <2 seconds', async () => {
                const startTime = Date.now();
                const event = createTestEvent();

                await handler(event);

                const duration = Date.now() - startTime;
                expect(duration).toBeLessThan(2000);
            });
        });
    });

    describe('Real Mode Tests (Mocked)', () => {
        beforeEach(() => {
            process.env.MOCK_MODE = 'false';

            // Mock Secrets Manager to return valid token
            AWS.__mockSecretsManagerGetSecretValue.mockResolvedValue({
                SecretString: 'r8_test_token_12345'
            });

            // Mock axios for image download
            axios.mockResolvedValue({
                data: Buffer.from('replicate-generated-image-data')
            });

            // Mock sharp for image processing
            const mockSharpInstance = {
                resize: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue({
                    data: Buffer.from('processed-image-data'),
                    info: {
                        width: 1200,
                        height: 628,
                        size: 45000,
                        format: 'jpeg'
                    }
                })
            };
            sharp.mockReturnValue(mockSharpInstance);

            // Need to clear module cache to get real mode
            jest.resetModules();
        });

        afterEach(() => {
            // Restore mock mode
            process.env.MOCK_MODE = 'true';
            jest.resetModules();
        });

        describe('✅ Replicate API Calls', () => {
            it('calls Replicate with correct parameters', async () => {
                const mockRun = jest.fn().mockResolvedValue(['https://replicate-output-url.com/image.jpg']);
                Replicate.mockImplementation(() => ({ run: mockRun }));

                const { handler: realHandler } = require('../../index');

                const event = createTestEvent({
                    aspect_ratio: '1.91:1',
                    prompt: 'Test real mode image'
                });

                await realHandler(event);

                expect(mockRun).toHaveBeenCalledWith(
                    'google-research/nano-banana',
                    {
                        input: {
                            prompt: 'Test real mode image',
                            aspect_ratio: '1.91:1',
                            output_format: 'jpg'
                        }
                    }
                );
            });

            it('includes input images when provided', async () => {
                const mockRun = jest.fn().mockResolvedValue(['https://replicate-output-url.com/image.jpg']);
                Replicate.mockImplementation(() => ({ run: mockRun }));

                const { handler: realHandler } = require('../../index');

                const event = createTestEvent({
                    input_images: ['https://input-image.com/image.jpg']
                });

                await realHandler(event);

                expect(mockRun).toHaveBeenCalledWith(
                    'google-research/nano-banana',
                    {
                        input: expect.objectContaining({
                            image_input: 'https://input-image.com/image.jpg'
                        })
                    }
                );
            });
        });

        describe('✅ Cost Verification', () => {
            it('has correct cost (0.045) in real mode', async () => {
                const mockRun = jest.fn().mockResolvedValue(['https://replicate-output-url.com/image.jpg']);
                Replicate.mockImplementation(() => ({ run: mockRun }));

                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await realHandler(event);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.cost).toBe(0.045);
                expect(imageRecord[0].Item.mock_mode).toBe(false);
            });
        });

        describe('✅ Error Handling', () => {
            it('handles Replicate API errors gracefully', async () => {
                const mockRun = jest.fn().mockRejectedValue(new Error('Replicate API timeout'));
                Replicate.mockImplementation(() => ({ run: mockRun }));

                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await expect(realHandler(event)).rejects.toThrow('Replicate nano-banana failed');

                // Should update DynamoDB with failure
                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const failureRecord = putCalls.find(call =>
                    call[0].Item.status === 'failed'
                );
                expect(failureRecord).toBeDefined();
            });

            it('handles invalid Secrets Manager tokens', async () => {
                AWS.__mockSecretsManagerGetSecretValue.mockResolvedValue({
                    SecretString: 'invalid-token-format'
                });

                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await expect(realHandler(event)).rejects.toThrow('Invalid Replicate token format');
            });

            it('handles missing Secrets Manager secret', async () => {
                AWS.__mockSecretsManagerGetSecretValue.mockRejectedValue(
                    new Error('Secret not found')
                );

                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await expect(realHandler(event)).rejects.toThrow('Replicate initialization failed');
            });
        });

        describe('✅ Retry Logic', () => {
            it('allows SQS to retry failed messages', async () => {
                const mockRun = jest.fn().mockRejectedValue(new Error('Network timeout'));
                Replicate.mockImplementation(() => ({ run: mockRun }));

                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                // Should throw error to trigger SQS retry
                await expect(realHandler(event)).rejects.toThrow();
            });
        });
    });

    describe('Validation Tests', () => {
        beforeEach(() => {
            process.env.MOCK_MODE = 'false'; // Use real mode for validation tests

            // Set up Secrets Manager mock for real mode
            AWS.__mockSecretsManagerGetSecretValue.mockResolvedValue({
                SecretString: 'r8_test_token_12345'
            });

            // Mock Replicate to return success
            const mockRun = jest.fn().mockResolvedValue(['https://replicate-output-url.com/image.jpg']);
            Replicate.mockImplementation(() => ({ run: mockRun }));

            // Mock axios for image download
            axios.mockResolvedValue({
                data: Buffer.from('replicate-generated-image-data')
            });

            // Mock sharp for image processing
            const mockSharpInstance = {
                resize: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue({
                    data: Buffer.from('processed-image-data'),
                    info: {
                        width: 1200,
                        height: 628,
                        size: 45000,
                        format: 'jpeg'
                    }
                })
            };
            sharp.mockReturnValue(mockSharpInstance);
        });

        afterEach(() => {
            // Restore mock mode
            process.env.MOCK_MODE = 'true';
        });

        describe('✅ Image Dimensions', () => {
            it('validates landscape dimensions (1200x628)', async () => {
                // Mock sharp for landscape dimensions
                const mockSharpInstance = {
                    resize: jest.fn().mockReturnThis(),
                    jpeg: jest.fn().mockReturnThis(),
                    toBuffer: jest.fn().mockResolvedValue({
                        data: Buffer.from('processed-image-data'),
                        info: {
                            width: 1200,
                            height: 628,
                            size: 45000,
                            format: 'jpeg'
                        }
                    })
                };
                sharp.mockReturnValue(mockSharpInstance);

                jest.resetModules();
                const { handler: realHandler } = require('../../index');

                const event = createTestEvent({ aspect_ratio: '1.91:1' });
                await realHandler(event);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.dimensions).toBe('1200x628');
            });

            it('validates square dimensions (1200x1200)', async () => {
                // Mock sharp for square dimensions
                const mockSharpInstance = {
                    resize: jest.fn().mockReturnThis(),
                    jpeg: jest.fn().mockReturnThis(),
                    toBuffer: jest.fn().mockResolvedValue({
                        data: Buffer.from('processed-image-data'),
                        info: {
                            width: 1200,
                            height: 1200,
                            size: 45000,
                            format: 'jpeg'
                        }
                    })
                };
                sharp.mockReturnValue(mockSharpInstance);

                jest.resetModules();
                const { handler: realHandler } = require('../../index');

                const event = createTestEvent({ aspect_ratio: '1:1' });
                await realHandler(event);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.dimensions).toBe('1200x1200');
            });

            it('rejects unsupported aspect ratios', async () => {
                jest.resetModules();
                const { handler: realHandler } = require('../../index');

                const event = createTestEvent({ aspect_ratio: '16:9' });

                await expect(realHandler(event)).rejects.toThrow('Unsupported aspect ratio');
            });
        });

        describe('✅ NSFW Content Detection', () => {
            it('rejects images with NSFW content', async () => {
                AWS.__mockRekognitionDetectModerationLabels.mockResolvedValue({
                    ModerationLabels: [{
                        Name: 'Explicit Nudity',
                        Confidence: 85.5
                    }]
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await expect(realHandler(event)).rejects.toThrow('NSFW content detected');
            });

            it('allows images with low NSFW confidence', async () => {
                AWS.__mockRekognitionDetectModerationLabels.mockResolvedValue({
                    ModerationLabels: [{
                        Name: 'Suggestive',
                        Confidence: 60 // Below 75 threshold
                    }]
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();
                const result = await realHandler(event);

                expect(result.batchItemFailures).toEqual([]);
            });
        });

        describe('✅ Text Amount Detection', () => {
            it('rejects images with too much text', async () => {
                AWS.__mockRekognitionDetectText.mockResolvedValue({
                    TextDetections: [
                        { Type: 'LINE', DetectedText: 'First line of text' },
                        { Type: 'LINE', DetectedText: 'Second line of text' },
                        { Type: 'LINE', DetectedText: 'Third line of text' },
                        { Type: 'LINE', DetectedText: 'Fourth line of text' } // More than 2 lines
                    ]
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();

                await expect(realHandler(event)).rejects.toThrow('Too much text detected');
            });

            it('allows images with acceptable text amount', async () => {
                AWS.__mockRekognitionDetectText.mockResolvedValue({
                    TextDetections: [
                        { Type: 'LINE', DetectedText: 'Brand Logo' },
                        { Type: 'LINE', DetectedText: 'Call to Action' } // 2 lines is acceptable
                    ]
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();
                const result = await realHandler(event);

                expect(result.batchItemFailures).toEqual([]);
            });

            it('ignores short text snippets', async () => {
                AWS.__mockRekognitionDetectText.mockResolvedValue({
                    TextDetections: [
                        { Type: 'LINE', DetectedText: 'Hi' }, // Too short (≤3 chars)
                        { Type: 'LINE', DetectedText: 'OK' },
                        { Type: 'LINE', DetectedText: 'Yes' }
                    ]
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();
                const result = await realHandler(event);

                expect(result.batchItemFailures).toEqual([]);
            });
        });

        describe('✅ File Size Validation', () => {
            it('validates image buffer size', async () => {
                const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB

                // Mock axios to return large buffer
                axios.mockResolvedValue({
                    data: largeBuffer
                });

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();
                await realHandler(event);

                // Should upload successfully
                expect(AWS.__mockS3PutObject).toHaveBeenCalledWith(
                    expect.objectContaining({
                        ContentType: 'image/jpeg'
                    })
                );
            });
        });

        describe('Validation Error Handling', () => {
            it('continues processing when Rekognition fails', async () => {
                // Test the error handling fallback in real mode
                AWS.__mockRekognitionDetectModerationLabels.mockRejectedValue(
                    new Error('Rekognition service unavailable')
                );
                AWS.__mockRekognitionDetectText.mockRejectedValue(
                    new Error('Rekognition service unavailable')
                );
                AWS.__mockRekognitionDetectLabels.mockRejectedValue(
                    new Error('Rekognition service unavailable')
                );

                jest.resetModules();
                const { handler: realHandler } = require('../../index');
                const event = createTestEvent();
                const result = await realHandler(event);

                // Should complete successfully with validation skipped
                expect(result.batchItemFailures).toEqual([]);

                const putCalls = AWS.__mockDynamoDBPut.mock.calls;
                const imageRecord = putCalls.find(call =>
                    call[0].Item.SK && call[0].Item.SK.startsWith('IMAGE#')
                );
                expect(imageRecord[0].Item.validation.reason).toBe('Validation skipped due to error');
            });
        });
    });

    describe('Integration Tests', () => {
        it('processes complete workflow in mock mode', async () => {
            const event = createTestEvent({
                job_id: 'integration_job_001',
                customer_id: 'integration_customer',
                image_id: 'integration_image_001',
                aspect_ratio: '1.91:1',
                prompt: 'Integration test landscape image'
            });

            const startTime = Date.now();
            const result = await handler(event);
            const endTime = Date.now();

            // Verify success
            expect(result.batchItemFailures).toEqual([]);
            expect(endTime - startTime).toBeLessThan(2000);

            // Verify all components were called
            expect(MockGenerator.generateImage).toHaveBeenCalled();
            expect(AWS.__mockS3PutObject).toHaveBeenCalled();
            expect(AWS.__mockDynamoDBPut).toHaveBeenCalled();
            expect(AWS.__mockDynamoDBUpdate).toHaveBeenCalled();
        });

        it('handles batch processing with multiple records', async () => {
            const event = {
                Records: [
                    {
                        body: JSON.stringify({
                            job_id: 'batch_job_001',
                            customer_id: 'batch_customer',
                            image_id: 'batch_image_001',
                            image_index: 0,
                            aspect_ratio: '1.91:1',
                            prompt: 'First batch image',
                            created_at: new Date().toISOString()
                        })
                    },
                    {
                        body: JSON.stringify({
                            job_id: 'batch_job_001',
                            customer_id: 'batch_customer',
                            image_id: 'batch_image_002',
                            image_index: 1,
                            aspect_ratio: '1:1',
                            prompt: 'Second batch image',
                            created_at: new Date().toISOString()
                        })
                    }
                ]
            };

            const result = await handler(event);

            expect(result.batchItemFailures).toEqual([]);
            expect(MockGenerator.generateImage).toHaveBeenCalledTimes(2);
            expect(AWS.__mockS3PutObject).toHaveBeenCalledTimes(2);
        });
    });
});

/**
 * Helper function to create test events
 */
function createTestEvent(overrides = {}) {
    const defaultEvent = {
        job_id: 'test_job_001',
        customer_id: 'test_customer_001',
        image_id: 'test_image_001',
        image_index: 0,
        aspect_ratio: '1.91:1',
        prompt: 'Test image prompt',
        input_images: [],
        created_at: new Date().toISOString()
    };

    return {
        Records: [{
            body: JSON.stringify({
                ...defaultEvent,
                ...overrides
            })
        }]
    };
}