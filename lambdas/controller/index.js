/**
 * Controller Lambda
 * Task 1.3 from PRD.md Section 2.2
 *
 * Handles API endpoints for RDA image generation:
 * - POST /generate: Create new job
 * - GET /jobs/{id}: Get job status
 * - POST /regenerate: Regenerate image (Phase 2)
 * - GET /regenerations/{id}: Get regeneration status (Phase 2)
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// AWS SDK clients
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

// Environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'RDAImageJobs-dev';
const PROMPT_BUILDER_FUNCTION = process.env.PROMPT_BUILDER_FUNCTION || 'rda-prompt-builder-dev';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * Lambda handler
 */
exports.handler = async (event) => {
    console.log('Controller Lambda invoked:', JSON.stringify(event));

    try {
        // Parse the HTTP method and path
        const { httpMethod, path, pathParameters, body } = event;

        // Route to appropriate handler
        if (httpMethod === 'POST' && path === '/generate') {
            return await handleGenerate(body);
        } else if (httpMethod === 'GET' && path.startsWith('/jobs/')) {
            const jobId = pathParameters?.id || path.split('/')[2];
            return await handleGetJob(jobId);
        } else if (httpMethod === 'POST' && path === '/regenerate') {
            return await handleRegenerate(body);
        } else if (httpMethod === 'GET' && path.startsWith('/regenerations/')) {
            const regenerationId = pathParameters?.id || path.split('/')[2];
            return await handleGetRegeneration(regenerationId);
        } else {
            return createResponse(404, {
                error: 'Not Found',
                message: `Path ${path} not found`
            });
        }
    } catch (error) {
        console.error('Controller Lambda error:', error);
        return createResponse(500, {
            error: 'Internal Server Error',
            message: error.message,
            requestId: event.requestContext?.requestId
        });
    }
};

/**
 * POST /generate - Create new image generation job
 */
async function handleGenerate(body) {
    console.log('Handling POST /generate');

    // Parse request body
    let requestData;
    try {
        requestData = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (error) {
        return createResponse(400, {
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON'
        });
    }

    // Validate required fields
    const validation = validateGenerateRequest(requestData);
    if (!validation.valid) {
        return createResponse(400, {
            error: 'Validation Error',
            errors: validation.errors
        });
    }

    const {
        customer_id,
        user_prompt,
        openai_api_key,
        input_images = [],
        generation_config = {}
    } = requestData;

    // Generate unique job ID
    const jobId = `job_${uuidv4().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    // Create job record in DynamoDB
    const jobRecord = {
        PK: jobId,
        SK: 'JOB#metadata',
        job_id: jobId,
        customer_id,
        status: 'queued',
        user_prompt,
        input_images,
        generation_config,
        created_at: timestamp,
        updated_at: timestamp,
        progress: {
            total: 0,
            completed: 0,
            failed: 0
        },
        summary: {
            total_cost: 0,
            total_images: 0
        }
    };

    // Additional GSI attributes
    jobRecord.created_at = timestamp; // For CustomerCreatedAtIndex
    jobRecord.status = 'queued'; // For StatusCreatedAtIndex

    try {
        // Store job in DynamoDB
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: jobRecord,
            ConditionExpression: 'attribute_not_exists(PK)'
        }).promise();

        console.log(`Job ${jobId} created in DynamoDB`);

        // Prepare payload for Prompt Builder Lambda
        const promptBuilderPayload = {
            job_id: jobId,
            customer_id,
            user_prompt,
            openai_api_key,
            input_images,
            generation_config,
            created_at: timestamp
        };

        // Invoke Prompt Builder Lambda asynchronously
        await lambda.invoke({
            FunctionName: PROMPT_BUILDER_FUNCTION,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify(promptBuilderPayload)
        }).promise();

        console.log(`Prompt Builder Lambda invoked for job ${jobId}`);

        // Calculate estimated completion time
        const estimatedImages = generation_config.max_images || 10;
        const estimatedSeconds = process.env.MOCK_MODE === 'true'
            ? estimatedImages // 1 second per image in mock mode
            : estimatedImages * 9; // 9 seconds per image in real mode

        // Return 202 Accepted
        return createResponse(202, {
            job_id: jobId,
            status: 'queued',
            status_url: `/jobs/${jobId}`,
            estimated_completion_seconds: estimatedSeconds,
            message: 'Job created and queued for processing'
        });

    } catch (error) {
        console.error('Error creating job:', error);

        // Clean up if needed
        if (error.code !== 'ConditionalCheckFailedException') {
            await cleanupFailedJob(jobId);
        }

        throw error;
    }
}

/**
 * GET /jobs/{id} - Get job status and images
 */
async function handleGetJob(jobId) {
    console.log(`Handling GET /jobs/${jobId}`);

    if (!jobId) {
        return createResponse(400, {
            error: 'Bad Request',
            message: 'Job ID is required'
        });
    }

    try {
        // Query all items for this job (metadata + images)
        const result = await dynamodb.query({
            TableName: DYNAMODB_TABLE,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': jobId
            }
        }).promise();

        if (result.Items.length === 0) {
            return createResponse(404, {
                error: 'Not Found',
                message: `Job ${jobId} not found`
            });
        }

        // Find job metadata
        const jobMetadata = result.Items.find(item => item.SK === 'JOB#metadata');
        if (!jobMetadata) {
            return createResponse(500, {
                error: 'Data Inconsistency',
                message: 'Job metadata not found'
            });
        }

        // Extract images
        const images = result.Items
            .filter(item => item.SK.startsWith('IMAGE#'))
            .sort((a, b) => {
                const aIndex = parseInt(a.SK.split('#')[1]);
                const bIndex = parseInt(b.SK.split('#')[1]);
                return aIndex - bIndex;
            })
            .map(item => ({
                image_id: item.image_id,
                image_index: item.image_index,
                s3_url: item.s3_url,
                aspect_ratio: item.aspect_ratio,
                dimensions: item.dimensions,
                prompt: item.prompt,
                status: item.status,
                cost: item.cost || 0,
                metadata: item.metadata || {},
                validation: item.validation || {},
                generated_at: item.generated_at
            }));

        // Construct response
        const response = {
            job_id: jobMetadata.job_id,
            customer_id: jobMetadata.customer_id,
            status: jobMetadata.status,
            user_prompt: jobMetadata.user_prompt,
            generation_config: jobMetadata.generation_config,
            created_at: jobMetadata.created_at,
            updated_at: jobMetadata.updated_at,
            progress: jobMetadata.progress || {
                total: 0,
                completed: images.filter(img => img.status === 'completed').length,
                failed: images.filter(img => img.status === 'failed').length
            },
            summary: {
                total_cost: images.reduce((sum, img) => sum + (img.cost || 0), 0),
                total_images: images.length
            },
            images
        };

        // Add error information if job failed
        if (jobMetadata.error) {
            response.error = jobMetadata.error;
        }

        return createResponse(200, response);

    } catch (error) {
        console.error('Error getting job:', error);
        throw error;
    }
}

/**
 * POST /regenerate - Regenerate specific image (Phase 2 placeholder)
 */
async function handleRegenerate(body) {
    console.log('Handling POST /regenerate');

    // Parse request body
    let requestData;
    try {
        requestData = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (error) {
        return createResponse(400, {
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON'
        });
    }

    // Basic validation
    if (!requestData.customer_id || !requestData.image_id || !requestData.new_prompt) {
        return createResponse(400, {
            error: 'Validation Error',
            message: 'customer_id, image_id, and new_prompt are required'
        });
    }

    // Phase 2 placeholder response
    return createResponse(501, {
        error: 'Not Implemented',
        message: 'Image regeneration will be available in Phase 2',
        phase: 2,
        task: '2.2',
        documentation: 'See PRD.md Section 2.3 Task 2.2'
    });
}

/**
 * GET /regenerations/{id} - Get regeneration status (Phase 2 placeholder)
 */
async function handleGetRegeneration(regenerationId) {
    console.log(`Handling GET /regenerations/${regenerationId}`);

    if (!regenerationId) {
        return createResponse(400, {
            error: 'Bad Request',
            message: 'Regeneration ID is required'
        });
    }

    // Phase 2 placeholder response
    return createResponse(501, {
        error: 'Not Implemented',
        message: 'Regeneration status will be available in Phase 2',
        phase: 2,
        task: '2.2',
        documentation: 'See PRD.md Section 2.3 Task 2.2'
    });
}

/**
 * Validate POST /generate request
 */
function validateGenerateRequest(data) {
    const errors = [];

    // Required fields
    if (!data.customer_id) {
        errors.push('customer_id is required');
    } else if (typeof data.customer_id !== 'string') {
        errors.push('customer_id must be a string');
    }

    if (!data.user_prompt) {
        errors.push('user_prompt is required');
    } else if (typeof data.user_prompt !== 'string') {
        errors.push('user_prompt must be a string');
    } else if (data.user_prompt.length < 10) {
        errors.push('user_prompt must be at least 10 characters');
    }

    if (!data.openai_api_key) {
        errors.push('openai_api_key is required');
    } else if (typeof data.openai_api_key !== 'string') {
        errors.push('openai_api_key must be a string');
    } else if (!data.openai_api_key.startsWith('sk-')) {
        errors.push('openai_api_key must be a valid OpenAI API key (starts with sk-)');
    }

    // Optional fields validation
    if (data.input_images !== undefined) {
        if (!Array.isArray(data.input_images)) {
            errors.push('input_images must be an array');
        } else {
            data.input_images.forEach((img, index) => {
                if (!img.s3_url) {
                    errors.push(`input_images[${index}].s3_url is required`);
                }
                if (img.usage && !['product', 'logo', 'background'].includes(img.usage)) {
                    errors.push(`input_images[${index}].usage must be product, logo, or background`);
                }
            });
        }
    }

    if (data.generation_config !== undefined) {
        if (typeof data.generation_config !== 'object') {
            errors.push('generation_config must be an object');
        } else {
            const config = data.generation_config;

            if (config.max_images !== undefined) {
                const maxImages = config.max_images;
                if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > 20) {
                    errors.push('generation_config.max_images must be an integer between 1 and 20');
                }
            }

            if (config.style_preset !== undefined) {
                const validPresets = ['photorealistic', 'artistic', 'minimalist', 'vibrant'];
                if (!validPresets.includes(config.style_preset)) {
                    errors.push(`generation_config.style_preset must be one of: ${validPresets.join(', ')}`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Clean up failed job
 */
async function cleanupFailedJob(jobId) {
    try {
        await dynamodb.delete({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            }
        }).promise();
        console.log(`Cleaned up failed job ${jobId}`);
    } catch (error) {
        console.error(`Failed to clean up job ${jobId}:`, error);
    }
}

/**
 * Create HTTP response
 */
function createResponse(statusCode, body) {
    const response = {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify(body)
    };

    // Log response for debugging
    console.log(`Response ${statusCode}:`, JSON.stringify(body));

    return response;
}