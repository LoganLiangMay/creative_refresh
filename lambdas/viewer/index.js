/**
 * Viewer Lambda
 * API endpoint to query DynamoDB and generate signed S3 URLs
 * for the static web viewer
 */

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'RDAImageJobs-dev';
const S3_BUCKET = process.env.S3_BUCKET || 'rda-generated-images-dev';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

/**
 * Lambda handler
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    try {
        const path = event.path || event.rawPath || '';
        const method = event.httpMethod || event.requestContext?.http?.method;

        console.log(`${method} ${path}`);

        // Route requests
        if (path.includes('/jobs') && method === 'GET') {
            return await listJobs(event);
        } else if (path.match(/\/jobs\/[^/]+$/) && method === 'GET') {
            return await getJob(event);
        } else if (path.includes('/health') && method === 'GET') {
            return {
                statusCode: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'healthy',
                    environment: ENVIRONMENT,
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            return {
                statusCode: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Not found' })
            };
        }

    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

/**
 * List all jobs with their images
 */
async function listJobs(event) {
    try {
        const queryParams = event.queryStringParameters || {};
        const limit = parseInt(queryParams.limit) || 50;
        const status = queryParams.status; // Optional status filter

        console.log(`Listing jobs (limit: ${limit}, status: ${status || 'all'})`);

        // Scan DynamoDB for all jobs
        // In production, consider using GSI queries for better performance
        const scanParams = {
            TableName: DYNAMODB_TABLE,
            FilterExpression: 'begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':sk': 'JOB#metadata'
            },
            Limit: limit
        };

        // Add status filter if provided
        if (status) {
            scanParams.FilterExpression += ' AND #status = :status';
            scanParams.ExpressionAttributeNames = {
                '#status': 'status'
            };
            scanParams.ExpressionAttributeValues[':status'] = status;
        }

        const result = await dynamodb.scan(scanParams).promise();

        console.log(`Found ${result.Items.length} jobs`);

        // For each job, fetch its images
        const jobs = await Promise.all(result.Items.map(async (job) => {
            const jobId = job.PK;

            // Query for images belonging to this job
            const imagesResult = await dynamodb.query({
                TableName: DYNAMODB_TABLE,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': jobId,
                    ':sk': 'IMAGE#'
                }
            }).promise();

            // Get the first completed image for preview
            const completedImage = imagesResult.Items.find(img => img.status === 'completed');
            let outputUrl = null;

            if (completedImage && completedImage.s3_key) {
                // Generate signed URL for the image
                outputUrl = await generateSignedUrl(completedImage.s3_key);
            }

            return {
                job_id: jobId,
                customer_id: job.customer_id,
                prompt: job.prompt,
                status: job.status,
                aspect_ratio: job.aspect_ratio,
                created_at: job.created_at,
                completed_at: job.completed_at,
                duration_ms: job.completed_at && job.created_at
                    ? new Date(job.completed_at) - new Date(job.created_at)
                    : null,
                image_count: imagesResult.Items.length,
                output_url: outputUrl,
                s3_key: completedImage?.s3_key,
                enhanced_prompt: completedImage?.prompt_metadata?.enhanced_prompt,
                progress: job.progress
            };
        }));

        // Sort by created_at descending (newest first)
        jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobs,
                count: jobs.length,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error listing jobs:', error);
        return {
            statusCode: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to list jobs',
                message: error.message
            })
        };
    }
}

/**
 * Get a specific job with all its images
 */
async function getJob(event) {
    try {
        const jobId = event.pathParameters?.jobId || event.path.split('/').pop();

        if (!jobId) {
            return {
                statusCode: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Job ID is required' })
            };
        }

        console.log(`Getting job: ${jobId}`);

        // Get job metadata
        const jobResult = await dynamodb.get({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            }
        }).promise();

        if (!jobResult.Item) {
            return {
                statusCode: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Job not found' })
            };
        }

        const job = jobResult.Item;

        // Query for all images belonging to this job
        const imagesResult = await dynamodb.query({
            TableName: DYNAMODB_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': jobId,
                ':sk': 'IMAGE#'
            }
        }).promise();

        // Generate signed URLs for all images
        const images = await Promise.all(imagesResult.Items.map(async (image) => {
            let signedUrl = null;
            if (image.s3_key) {
                signedUrl = await generateSignedUrl(image.s3_key);
            }

            return {
                image_id: image.image_id,
                image_index: image.image_index,
                status: image.status,
                s3_url: signedUrl,
                s3_key: image.s3_key,
                aspect_ratio: image.aspect_ratio,
                dimensions: image.dimensions,
                cost: image.cost,
                generation_time: image.generation_time,
                processing_time: image.processing_time,
                mock_mode: image.mock_mode,
                generated_at: image.generated_at,
                validation: image.validation,
                prompt_metadata: image.prompt_metadata,
                error: image.error
            };
        }));

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job: {
                    job_id: jobId,
                    customer_id: job.customer_id,
                    prompt: job.prompt,
                    status: job.status,
                    aspect_ratio: job.aspect_ratio,
                    created_at: job.created_at,
                    completed_at: job.completed_at,
                    progress: job.progress
                },
                images,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error getting job:', error);
        return {
            statusCode: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to get job',
                message: error.message
            })
        };
    }
}

/**
 * Generate a signed URL for an S3 object
 * Valid for 1 hour
 */
async function generateSignedUrl(s3Key) {
    try {
        const url = await s3.getSignedUrlPromise('getObject', {
            Bucket: S3_BUCKET,
            Key: s3Key,
            Expires: 3600 // 1 hour
        });
        return url;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        return null;
    }
}
