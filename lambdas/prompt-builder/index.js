/**
 * Prompt Builder Lambda
 * Task 1.5 from PRD.md Section 2.2
 *
 * Analyzes user prompts with GPT-4 and generates refined prompts for image generation
 * Creates SQS messages for Worker Lambda processing
 */

const AWS = require('aws-sdk');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

// AWS SDK clients
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

// Environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'RDAImageJobs-dev';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/account/image-generation-queue-dev';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * Lambda handler
 */
exports.handler = async (event) => {
    console.log('Prompt Builder Lambda invoked:', JSON.stringify(event));

    const {
        job_id,
        customer_id,
        user_prompt,
        openai_api_key,
        input_images = [],
        generation_config = {},
        created_at
    } = event;

    try {
        // Update job status to processing
        await updateJobStatus(job_id, 'processing');

        // Initialize OpenAI client with customer's API key
        const openai = new OpenAI({
            apiKey: openai_api_key
        });

        // Step 1: Analyze prompt with GPT-4
        console.log(`Analyzing prompt with GPT-4 for job ${job_id}`);
        const analysis = await analyzePromptWithGPT4(openai, user_prompt, generation_config);
        console.log(`Analysis result:`, analysis);

        // Step 2: Generate refined prompts
        console.log(`Generating ${analysis.num_images} refined prompts`);
        const refinedPrompts = await generateRefinedPrompts(
            openai,
            user_prompt,
            analysis,
            input_images
        );

        // Step 3: Create SQS messages
        console.log('Creating SQS messages');
        const messages = createSQSMessages(
            job_id,
            customer_id,
            refinedPrompts,
            input_images,
            created_at
        );

        // Step 4: Send messages to SQS
        console.log(`Sending ${messages.length} messages to SQS`);
        await sendMessagesToSQS(messages);

        // Step 5: Update job with total image count
        await updateJobProgress(job_id, analysis.num_images, analysis);

        console.log(`Prompt Builder completed for job ${job_id}`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                job_id,
                images_queued: analysis.num_images,
                landscape_count: analysis.landscape_count,
                square_count: analysis.square_count
            })
        };

    } catch (error) {
        console.error('Prompt Builder Lambda error:', error);

        // Update job status to failed
        await updateJobStatus(job_id, 'failed', error.message);

        throw error;
    }
};

/**
 * Analyze user prompt with GPT-4 to determine image generation strategy
 */
async function analyzePromptWithGPT4(openai, userPrompt, config) {
    const maxImages = config.max_images || 10;

    const systemPrompt = `You are an AI assistant specializing in Google Responsive Display Ads (RDA) image generation.
Analyze the user's request and determine the optimal image generation strategy.

Requirements:
1. Determine the total number of images to generate (between 1 and ${maxImages})
2. Split between landscape (1.91:1 ratio) and square (1:1 ratio) formats
3. Landscape images are for desktop/tablet (typically 60-70%)
4. Square images are for mobile (typically 30-40%)
5. Consider the user's specific needs mentioned in the prompt

Respond with JSON only:
{
  "num_images": <number>,
  "landscape_count": <number>,
  "square_count": <number>,
  "reasoning": "<brief explanation>",
  "themes": ["<theme1>", "<theme2>", ...],
  "style_notes": "<visual style recommendations>"
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 500
        });

        const response = JSON.parse(completion.choices[0].message.content);

        // Validate and adjust the response
        const numImages = Math.min(Math.max(1, response.num_images || 10), maxImages);
        let landscapeCount = response.landscape_count || Math.ceil(numImages * 0.7);
        let squareCount = response.square_count || Math.floor(numImages * 0.3);

        // Ensure counts add up correctly
        if (landscapeCount + squareCount !== numImages) {
            landscapeCount = Math.ceil(numImages * 0.7);
            squareCount = numImages - landscapeCount;
        }

        return {
            num_images: numImages,
            landscape_count: landscapeCount,
            square_count: squareCount,
            reasoning: response.reasoning || 'Default distribution for optimal RDA performance',
            themes: response.themes || [],
            style_notes: response.style_notes || 'Professional, high-contrast, commercial photography'
        };

    } catch (error) {
        console.error('GPT-4 analysis error:', error);

        // Fallback to default distribution
        const fallbackImages = Math.min(maxImages, 10);
        return {
            num_images: fallbackImages,
            landscape_count: Math.ceil(fallbackImages * 0.7),
            square_count: Math.floor(fallbackImages * 0.3),
            reasoning: 'Using default distribution due to API error',
            themes: [],
            style_notes: 'Professional commercial photography'
        };
    }
}

/**
 * Generate refined prompts for each image
 */
async function generateRefinedPrompts(openai, userPrompt, analysis, inputImages) {
    const prompts = [];
    const { landscape_count, square_count, themes, style_notes } = analysis;

    // RDA-specific requirements
    const rdaRequirements = [
        'NO text overlays',
        'NO typography',
        'NO written words',
        'high contrast',
        'clear focal point',
        'professional quality',
        'commercial photography',
        'vibrant colors',
        'sharp details'
    ].join(', ');

    // Input images context
    const inputContext = inputImages.length > 0
        ? `Note: User has provided ${inputImages.length} input image(s) that should influence the style.`
        : '';

    // Generate landscape prompts
    for (let i = 0; i < landscape_count; i++) {
        const promptVariation = await generateSinglePrompt(
            openai,
            userPrompt,
            '1.91:1 landscape',
            i + 1,
            themes,
            style_notes,
            rdaRequirements,
            inputContext
        );

        prompts.push({
            index: i,
            aspect_ratio: '1.91:1',
            prompt: promptVariation
        });
    }

    // Generate square prompts
    for (let i = 0; i < square_count; i++) {
        const promptVariation = await generateSinglePrompt(
            openai,
            userPrompt,
            '1:1 square',
            landscape_count + i + 1,
            themes,
            style_notes,
            rdaRequirements,
            inputContext
        );

        prompts.push({
            index: landscape_count + i,
            aspect_ratio: '1:1',
            prompt: promptVariation
        });
    }

    return prompts;
}

/**
 * Generate a single refined prompt
 */
async function generateSinglePrompt(openai, userPrompt, aspectRatio, imageNumber, themes, styleNotes, rdaRequirements, inputContext) {
    const systemPrompt = `Create a detailed image generation prompt for Google Responsive Display Ads.
You are creating prompt ${imageNumber} in a series.

Requirements:
- Aspect ratio: ${aspectRatio}
- Style: ${styleNotes}
- Themes: ${themes.join(', ')}
- MUST include: ${rdaRequirements}
${inputContext}

Return ONLY the refined prompt text, no explanations.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Base request: ${userPrompt}\n\nCreate variation ${imageNumber} for ${aspectRatio} format.` }
            ],
            temperature: 0.8, // Higher temperature for more variation
            max_tokens: 200
        });

        let refinedPrompt = completion.choices[0].message.content.trim();

        // Ensure RDA requirements are included
        if (!refinedPrompt.includes('no text')) {
            refinedPrompt += ', no text overlays or typography';
        }

        // Add aspect ratio and quality markers
        const aspectRatioText = aspectRatio.includes('landscape') ? '1.91:1' : '1:1';
        refinedPrompt += `, ${aspectRatioText} aspect ratio, ultra high quality, 8K resolution, professional commercial photography`;

        return refinedPrompt;

    } catch (error) {
        console.error(`Error generating prompt ${imageNumber}:`, error);

        // Fallback prompt
        return `${userPrompt}, variation ${imageNumber}, ${aspectRatio} aspect ratio, ${rdaRequirements}, professional commercial style`;
    }
}

/**
 * Create SQS messages for each image
 */
function createSQSMessages(jobId, customerId, refinedPrompts, inputImages, createdAt) {
    return refinedPrompts.map(({ index, aspect_ratio, prompt }) => {
        const imageId = `img_${jobId}_${String(index + 1).padStart(3, '0')}`;

        return {
            Id: `msg_${index}`,
            MessageBody: JSON.stringify({
                job_id: jobId,
                customer_id: customerId,
                image_id: imageId,
                image_index: index,
                aspect_ratio,
                prompt,
                input_images: inputImages,
                created_at: createdAt,
                timestamp: new Date().toISOString()
            }),
            MessageAttributes: {
                JobId: {
                    DataType: 'String',
                    StringValue: jobId
                },
                ImageIndex: {
                    DataType: 'Number',
                    StringValue: String(index)
                },
                AspectRatio: {
                    DataType: 'String',
                    StringValue: aspect_ratio
                }
            }
        };
    });
}

/**
 * Send messages to SQS in batches
 */
async function sendMessagesToSQS(messages) {
    const batchSize = 10; // SQS maximum batch size
    const batches = [];

    for (let i = 0; i < messages.length; i += batchSize) {
        batches.push(messages.slice(i, i + batchSize));
    }

    for (const batch of batches) {
        try {
            const result = await sqs.sendMessageBatch({
                QueueUrl: SQS_QUEUE_URL,
                Entries: batch
            }).promise();

            if (result && result.Failed && result.Failed.length > 0) {
                console.error('Failed to send some messages:', result.Failed);
                throw new Error(`Failed to send ${result.Failed.length} messages to SQS`);
            }

            console.log(`Successfully sent batch of ${batch.length} messages`);
        } catch (error) {
            console.error('Error sending batch to SQS:', error);
            throw error;
        }
    }
}

/**
 * Update job status in DynamoDB
 */
async function updateJobStatus(jobId, status, errorMessage = null) {
    const updateExpression = errorMessage
        ? 'SET #status = :status, updated_at = :now, #error = :error'
        : 'SET #status = :status, updated_at = :now';

    const expressionAttributeNames = {
        '#status': 'status'
    };

    const expressionAttributeValues = {
        ':status': status,
        ':now': new Date().toISOString()
    };

    if (errorMessage) {
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = {
            message: errorMessage,
            timestamp: new Date().toISOString()
        };
    }

    try {
        await dynamodb.update({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }).promise();

        console.log(`Updated job ${jobId} status to ${status}`);
    } catch (error) {
        console.error(`Failed to update job ${jobId} status:`, error);
    }
}

/**
 * Update job progress with total image count
 */
async function updateJobProgress(jobId, totalImages, analysis) {
    try {
        await dynamodb.update({
            TableName: DYNAMODB_TABLE,
            Key: {
                PK: jobId,
                SK: 'JOB#metadata'
            },
            UpdateExpression: `
                SET progress.total = :total,
                    image_analysis = :analysis,
                    updated_at = :now
            `,
            ExpressionAttributeValues: {
                ':total': totalImages,
                ':analysis': analysis,
                ':now': new Date().toISOString()
            }
        }).promise();

        console.log(`Updated job ${jobId} with ${totalImages} total images`);
    } catch (error) {
        console.error(`Failed to update job ${jobId} progress:`, error);
    }
}