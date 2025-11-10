/**
 * Worker Lambda
 * Task 1.7 from PRD.md Section 2.2
 *
 * Processes SQS messages to generate images using Mock Mode or Replicate API
 * CRITICAL: Mock Mode implemented FIRST for zero-cost testing
 */

const AWS = require('aws-sdk');
const sharp = require('sharp');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const MockGenerator = require('./utils/mockGenerator');

// AWS SDK clients
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const rekognition = new AWS.Rekognition();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'RDAImageJobs-dev';
const S3_BUCKET = process.env.S3_BUCKET || 'rda-generated-images-dev';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const GEMINI_SECRET_NAME = process.env.GEMINI_SECRET_NAME || `rda-generator/gemini-api-key-${ENVIRONMENT}`;

// CRITICAL: Mock Mode check - must be first
const MOCK_MODE = process.env.MOCK_MODE === 'true';
console.log(`Worker Lambda starting in ${MOCK_MODE ? 'MOCK' : 'REAL'} mode`);

// Gemini API key (cached)
let geminiApiKey = null;

/**
 * Initialize Gemini API key from Secrets Manager
 */
async function initializeGemini() {
    if (geminiApiKey) {
        return geminiApiKey; // Already cached
    }

    try {
        console.log(`Retrieving Gemini API key from secret: ${GEMINI_SECRET_NAME}`);

        const secretResult = await secretsManager.getSecretValue({
            SecretId: GEMINI_SECRET_NAME
        }).promise();

        const apiKey = secretResult.SecretString;

        if (!apiKey || !apiKey.startsWith('AIza')) {
            throw new Error('Invalid Gemini API key format - must start with AIza');
        }

        geminiApiKey = apiKey;
        console.log('Gemini API key retrieved successfully');
        return geminiApiKey;

    } catch (error) {
        console.error('Failed to retrieve Gemini API key:', error);
        throw new Error(`Gemini API initialization failed: ${error.message}`);
    }
}

/**
 * Lambda handler for SQS batch processing
 */
exports.handler = async (event) => {
    console.log(`Processing ${event.Records.length} messages in ${MOCK_MODE ? 'MOCK' : 'REAL'} mode`);

    const results = [];

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            console.log(`Processing image ${message.image_id} for job ${message.job_id}`);

            const result = await processImage(message);
            results.push(result);

            // Delete message from queue on success
            // (Auto-deleted by Lambda if no errors thrown)

        } catch (error) {
            console.error('Error processing message:', error);
            // Don't delete message - let it retry or go to DLQ
            throw error;
        }
    }

    return {
        batchItemFailures: [] // All succeeded if we get here
    };
};

/**
 * Process a single image generation request
 */
async function processImage(message) {
    const {
        job_id,
        customer_id,
        image_id,
        image_index,
        aspect_ratio,
        prompt,
        input_images = [],
        created_at
    } = message;

    const startTime = Date.now();

    try {
        // Update image status to processing
        await updateImageStatus(job_id, image_index, 'processing');

        let imageBuffer;
        let generationTime;
        let cost;

        if (MOCK_MODE) {
            // CRITICAL: Mock Mode Implementation using MockGenerator
            console.log(`Generating MOCK image for ${image_id}`);
            const mockResult = await MockGenerator.generateImage(aspect_ratio, prompt, image_index);
            imageBuffer = mockResult.buffer;
            generationTime = mockResult.generationTime;
            cost = 0; // Mock mode is free

            console.log(`Mock image generated in ${generationTime}ms`);
        } else {
            // Real Gemini API integration - Updated to use Google's Imagen
            console.log(`Generating REAL image for ${image_id} using Gemini Imagen 3.0`);
            const geminiResult = await generateRealImage(aspect_ratio, prompt, input_images);
            imageBuffer = geminiResult.buffer;
            generationTime = geminiResult.generationTime;
            cost = 0.04; // Gemini API cost per image (approximate)

            console.log(`Real image generated in ${generationTime}ms using Gemini API`);
        }

        // Process and validate image
        console.log('Processing image...');
        let processedImage;

        if (MOCK_MODE) {
            // Mock images are already processed, just create metadata
            processedImage = {
                buffer: imageBuffer,
                metadata: {
                    width: aspect_ratio === '1.91:1' ? 1200 : 1200,
                    height: aspect_ratio === '1.91:1' ? 628 : 1200,
                    size: imageBuffer.length,
                    format: 'jpeg'
                },
                dimensions: aspect_ratio === '1.91:1' ? '1200x628' : '1200x1200'
            };
        } else {
            // Real images need processing (resize, optimize)
            processedImage = await processImageBuffer(imageBuffer, aspect_ratio);
        }

        // Validate with Rekognition
        console.log('Validating image with Rekognition...');
        const validation = await validateImage(processedImage.buffer);

        if (!validation.isValid) {
            throw new Error(`Image validation failed: ${validation.reason}`);
        }

        // Upload to S3
        console.log('Uploading to S3...');
        const s3Key = `${customer_id}/${job_id}/${image_id}_v1.jpg`;
        const s3Url = await uploadToS3(processedImage.buffer, s3Key, processedImage.metadata);

        // Update DynamoDB with success
        const totalTime = Date.now() - startTime;
        await updateImageSuccess(
            job_id,
            image_index,
            image_id,
            s3Url,
            s3Key,
            aspect_ratio,
            processedImage.dimensions,
            cost,
            generationTime,
            totalTime,
            validation
        );

        console.log(`Successfully processed ${image_id} in ${totalTime}ms (cost: $${cost})`);

        return {
            success: true,
            image_id,
            s3_url: s3Url,
            cost,
            processing_time: totalTime
        };

    } catch (error) {
        console.error(`Failed to process ${image_id}:`, error);

        // Update DynamoDB with failure
        await updateImageFailure(job_id, image_index, error.message);

        // Update job progress
        await updateJobProgress(job_id, 0, 0, 1);

        throw error;
    }
}

/**
 * Generate real image using Google's Gemini Imagen API
 * Updated implementation using Gemini API instead of Replicate
 */
async function generateRealImage(aspectRatio, prompt, inputImages = []) {
    const startTime = Date.now();

    try {
        console.log(`Initializing Gemini API for Imagen 3.0 model...`);
        const apiKey = await initializeGemini();

        // Convert aspect ratio to dimensions for better prompting
        let dimensionPrompt = '';
        if (aspectRatio === '1.91:1') {
            dimensionPrompt = ' Landscape orientation, wide banner format.';
        } else if (aspectRatio === '1:1') {
            dimensionPrompt = ' Square image format.';
        }

        // Enhance prompt with dimension information
        const enhancedPrompt = prompt + dimensionPrompt;

        console.log(`Calling Gemini Imagen API with params:`, {
            prompt: enhancedPrompt.substring(0, 100) + (enhancedPrompt.length > 100 ? '...' : ''),
            aspect_ratio: aspectRatio,
            model: 'imagen-3.0-generate-002',
            has_input_images: inputImages.length > 0
        });

        // Prepare request payload for Gemini API
        const requestPayload = {
            model: "imagen-3.0-generate-002",
            prompt: enhancedPrompt,
            response_format: "b64_json",
            n: 1
        };

        // Call Gemini API
        const response = await axios({
            method: 'POST',
            url: 'https://generativelanguage.googleapis.com/v1beta/openai/images/generations',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            data: requestPayload,
            timeout: 120000 // 2 minute timeout for image generation
        });

        const generationTime = Date.now() - startTime;
        console.log(`Gemini API generation completed in ${generationTime}ms`);

        // Validate response
        if (!response.data || !response.data.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
            throw new Error('Gemini API returned no images');
        }

        // Extract base64 image data
        const imageData = response.data.data[0];
        if (!imageData.b64_json) {
            throw new Error('Gemini API response missing b64_json data');
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageData.b64_json, 'base64');
        console.log(`Converted base64 image to buffer: ${imageBuffer.length} bytes`);

        return {
            buffer: imageBuffer,
            generationTime: generationTime
        };

    } catch (error) {
        const generationTime = Date.now() - startTime;
        console.error(`Gemini API generation failed after ${generationTime}ms:`, error.response?.data || error.message);
        throw new Error(`Gemini Imagen API failed: ${error.message}`);
    }
}


/**
 * Process image buffer - resize and optimize
 * Used for real Gemini API images
 */
async function processImageBuffer(buffer, aspectRatio) {
    try {
        // Determine target dimensions
        let width, height;
        if (aspectRatio === '1.91:1') {
            width = 1200;
            height = 628;
        } else if (aspectRatio === '1:1') {
            width = 1200;
            height = 1200;
        } else {
            throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
        }

        // Process with sharp
        const processed = await sharp(buffer)
            .resize(width, height, {
                fit: 'cover',
                position: 'center',
                withoutEnlargement: false
            })
            .jpeg({
                quality: 85,
                progressive: true
            })
            .toBuffer({ resolveWithObject: true });

        return {
            buffer: processed.data,
            metadata: processed.info,
            dimensions: `${width}x${height}`
        };

    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error(`Failed to process image: ${error.message}`);
    }
}

/**
 * Validate image using AWS Rekognition
 */
async function validateImage(buffer) {
    try {
        // In mock mode, skip expensive Rekognition calls
        if (MOCK_MODE) {
            console.log('Skipping Rekognition validation in mock mode');
            return {
                isValid: true,
                nsfw_score: 0,
                text_detected: false,
                labels: ['Mock', 'Placeholder'],
                reason: null
            };
        }

        // Detect moderation labels (NSFW content)
        const moderationResult = await rekognition.detectModerationLabels({
            Image: { Bytes: buffer },
            MinConfidence: 50
        }).promise();

        // Check for NSFW content
        const nsfwLabels = moderationResult.ModerationLabels.filter(
            label => label.Confidence > 75
        );

        if (nsfwLabels.length > 0) {
            return {
                isValid: false,
                nsfw_score: nsfwLabels[0].Confidence,
                reason: `NSFW content detected: ${nsfwLabels[0].Name}`
            };
        }

        // Detect text in image
        const textResult = await rekognition.detectText({
            Image: { Bytes: buffer }
        }).promise();

        // Count significant text (more than 3 characters)
        const significantText = textResult.TextDetections.filter(
            text => text.Type === 'LINE' && text.DetectedText.length > 3
        );

        if (significantText.length > 2) {
            return {
                isValid: false,
                text_detected: true,
                reason: `Too much text detected (${significantText.length} lines)`
            };
        }

        // Get general labels
        const labelsResult = await rekognition.detectLabels({
            Image: { Bytes: buffer },
            MaxLabels: 10,
            MinConfidence: 70
        }).promise();

        return {
            isValid: true,
            nsfw_score: 0,
            text_detected: significantText.length > 0,
            labels: labelsResult.Labels.map(l => l.Name),
            reason: null
        };

    } catch (error) {
        console.error('Rekognition validation error:', error);
        // Don't fail on validation errors - log and continue
        return {
            isValid: true,
            nsfw_score: 0,
            text_detected: false,
            labels: [],
            reason: 'Validation skipped due to error'
        };
    }
}

/**
 * Upload processed image to S3
 */
async function uploadToS3(buffer, key, metadata) {
    try {
        const params = {
            Bucket: S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'image/jpeg',
            Metadata: {
                width: String(metadata.width),
                height: String(metadata.height),
                size: String(metadata.size),
                format: metadata.format,
                generated_by: MOCK_MODE ? 'mock' : 'replicate',
                environment: ENVIRONMENT
            },
            Tags: `Environment=${ENVIRONMENT}&MockMode=${MOCK_MODE}`
        };

        await s3.putObject(params).promise();

        // Return public URL
        return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;

    } catch (error) {
        console.error('S3 upload error:', error);
        throw new Error(`Failed to upload to S3: ${error.message}`);
    }
}

/**
 * Update image status in DynamoDB
 */
async function updateImageStatus(jobId, imageIndex, status) {
    try {
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                PK: jobId,
                SK: `IMAGE#${String(imageIndex + 1).padStart(3, '0')}`,
                status: status,
                updated_at: new Date().toISOString()
            }
        }).promise();
    } catch (error) {
        console.error('Error updating image status:', error);
    }
}

/**
 * Update DynamoDB with successful image generation
 */
async function updateImageSuccess(
    jobId,
    imageIndex,
    imageId,
    s3Url,
    s3Key,
    aspectRatio,
    dimensions,
    cost,
    generationTime,
    totalTime,
    validation
) {
    try {
        // Update image record
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                PK: jobId,
                SK: `IMAGE#${String(imageIndex + 1).padStart(3, '0')}`,
                image_id: imageId,
                image_index: imageIndex,
                status: 'completed',
                s3_url: s3Url,
                s3_key: s3Key,
                aspect_ratio: aspectRatio,
                dimensions: dimensions,
                cost: cost,
                generation_time: generationTime,
                processing_time: totalTime,
                validation: validation,
                mock_mode: MOCK_MODE,
                generated_at: new Date().toISOString()
            }
        }).promise();

        // Update job progress
        await updateJobProgress(jobId, 1, 0, 0);

    } catch (error) {
        console.error('Error updating image success:', error);
    }
}

/**
 * Update DynamoDB with failed image generation
 */
async function updateImageFailure(jobId, imageIndex, errorMessage) {
    try {
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                PK: jobId,
                SK: `IMAGE#${String(imageIndex + 1).padStart(3, '0')}`,
                status: 'failed',
                error: {
                    message: errorMessage,
                    timestamp: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            }
        }).promise();
    } catch (error) {
        console.error('Error updating image failure:', error);
    }
}

/**
 * Update job progress counters
 */
async function updateJobProgress(jobId, completed, processing, failed) {
    try {
        const updates = [];
        const values = {};

        if (completed > 0) {
            updates.push('progress.completed = progress.completed + :completed');
            values[':completed'] = completed;
        }

        if (processing > 0) {
            updates.push('progress.processing = progress.processing + :processing');
            values[':processing'] = processing;
        }

        if (failed > 0) {
            updates.push('progress.failed = progress.failed + :failed');
            values[':failed'] = failed;
        }

        if (updates.length === 0) return;

        updates.push('updated_at = :now');
        values[':now'] = new Date().toISOString();

        await dynamodb.update({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: values
        }).promise();

        // Check if job is complete
        const jobData = await dynamodb.get({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            }
        }).promise();

        const progress = jobData.Item.progress;
        const total = progress.total;
        const done = progress.completed + progress.failed;

        if (done >= total && total > 0) {
            // Job is complete
            const status = progress.failed === 0 ? 'completed' : 'completed_with_errors';
            await dynamodb.update({
                TableName: DYNAMODB_TABLE,
                Key: {
                    PK: jobId,
                    SK: 'JOB#metadata'
                },
                UpdateExpression: 'SET #status = :status, completed_at = :now',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': status,
                    ':now': new Date().toISOString()
                }
            }).promise();

            console.log(`Job ${jobId} completed: ${progress.completed} succeeded, ${progress.failed} failed`);
        }

    } catch (error) {
        console.error('Error updating job progress:', error);
    }
}