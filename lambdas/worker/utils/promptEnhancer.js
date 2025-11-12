/**
 * Prompt Enhancer
 * Uses OpenAI to enhance and optimize image generation prompts
 */

const { OpenAI } = require('openai');
const { getOpenAIKey, getAppConfig } = require('./config');

// Cache for OpenAI client
let openaiClient = null;

/**
 * Initialize OpenAI client
 */
async function initializeOpenAI() {
    if (openaiClient) {
        return openaiClient;
    }

    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        console.log('OpenAI not configured - prompt enhancement will be skipped');
        return null;
    }

    openaiClient = new OpenAI({
        apiKey: apiKey,
    });

    console.log('OpenAI client initialized successfully');
    return openaiClient;
}

/**
 * Enhance a prompt for better image generation
 *
 * @param {string} originalPrompt - The original user prompt
 * @param {string} aspectRatio - Image aspect ratio (1:1 or 1.91:1)
 * @param {object} context - Additional context (optional)
 * @returns {Promise<object>} Enhanced prompt and metadata
 */
async function enhancePrompt(originalPrompt, aspectRatio, context = {}) {
    const config = getAppConfig();

    // Skip if prompt enhancement is disabled
    if (!config.enablePromptEnhancement) {
        console.log('Prompt enhancement disabled - using original prompt');
        return {
            enhanced: originalPrompt,
            original: originalPrompt,
            wasEnhanced: false,
            reasoning: 'Enhancement disabled'
        };
    }

    try {
        const client = await initializeOpenAI();
        if (!client) {
            return {
                enhanced: originalPrompt,
                original: originalPrompt,
                wasEnhanced: false,
                reasoning: 'OpenAI not configured'
            };
        }

        const startTime = Date.now();

        // Prepare the system message based on aspect ratio
        const aspectRatioGuidance = aspectRatio === '1.91:1'
            ? 'wide landscape format (suitable for banner ads, horizontal compositions)'
            : 'square format (suitable for social media posts, balanced compositions)';

        // Determine enhancement strategy based on whether input images are present
        const isMultiModal = context.hasInputImages === true;
        const enhancementMode = isMultiModal ? 'preservation (multi-modal)' : 'creative (text-to-image)';
        console.log(`Enhancing prompt with OpenAI using ${enhancementMode} strategy...`);

        let systemMessage;

        if (isMultiModal) {
            // Multi-modal mode: Preservation-focused for image fusion
            systemMessage = `You are an expert at writing prompts for Gemini 2.5 Flash Image (nano-banana) for multi-modal image fusion.

The user is providing input images that contain products/objects that MUST be preserved exactly as-is.

Your task: Enhance the prompt to preserve object details while integrating into a scene.

Guidelines:
- START with explicit preservation instructions: "Preserve all details from the input image(s)"
- Use phrases like: "maintain exact proportions", "keep sharp focus on [object]", "preserve exact features"
- Use photography terms for precision: "sharp focus", "macro detail", "high-resolution", "crisp detail"
- Specify detail hierarchy: object identity FIRST, then scene integration
- THEN add scene/environment context that complements the object
- Use conversational, semantic descriptions (not keyword lists)
- Optimize for the ${aspectRatioGuidance}
- Keep it concise but descriptive (max 150 words)
- Avoid creative reinterpretation of the product/object itself
- Maintain the user's core intent

Structure: [Preservation instructions] + [Scene description] + [Technical quality terms]

Return ONLY the enhanced prompt, nothing else.`;
        } else {
            // Text-to-image mode: Creative, artistic enhancements
            systemMessage = `You are an expert at writing prompts for AI image generation models like FLUX and Stable Diffusion.

Your task is to take a user's basic prompt and enhance it to produce high-quality, professional images for advertising purposes.

Guidelines:
- Add artistic details (lighting, composition, style, mood)
- Specify quality terms (professional, high resolution, detailed)
- Optimize for the ${aspectRatioGuidance}
- Keep it concise but descriptive (max 150 words)
- Focus on visual elements that work well in ads
- Avoid mentioning text or words in images
- Maintain the user's core intent

Return ONLY the enhanced prompt, nothing else.`;
        }

        const response = await client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: originalPrompt }
            ],
            temperature: 0.7,
            max_tokens: 200,
        });

        const enhancedPrompt = response.choices[0].message.content.trim();
        const enhancementTime = Date.now() - startTime;

        console.log(`Prompt enhanced in ${enhancementTime}ms`);
        console.log(`Original: "${originalPrompt.substring(0, 50)}..."`);
        console.log(`Enhanced: "${enhancedPrompt.substring(0, 50)}..."`);

        return {
            enhanced: enhancedPrompt,
            original: originalPrompt,
            wasEnhanced: true,
            enhancementTime,
            model: config.openaiModel,
            reasoning: 'Enhanced with OpenAI'
        };

    } catch (error) {
        console.error('Error enhancing prompt:', error);
        // Fall back to original prompt on error
        return {
            enhanced: originalPrompt,
            original: originalPrompt,
            wasEnhanced: false,
            error: error.message,
            reasoning: 'Enhancement failed, using original'
        };
    }
}

/**
 * Batch enhance multiple prompts
 *
 * @param {Array<object>} prompts - Array of {prompt, aspectRatio} objects
 * @returns {Promise<Array<object>>} Array of enhancement results
 */
async function enhancePromptBatch(prompts) {
    console.log(`Batch enhancing ${prompts.length} prompts...`);

    const results = await Promise.all(
        prompts.map(({ prompt, aspectRatio, context }) =>
            enhancePrompt(prompt, aspectRatio, context)
        )
    );

    const enhancedCount = results.filter(r => r.wasEnhanced).length;
    console.log(`Batch enhancement complete: ${enhancedCount}/${prompts.length} prompts enhanced`);

    return results;
}

/**
 * Analyze a prompt and suggest improvements
 * (For future use - provides feedback without modifying)
 *
 * @param {string} prompt - The prompt to analyze
 * @returns {Promise<object>} Analysis and suggestions
 */
async function analyzePrompt(prompt) {
    const config = getAppConfig();
    const client = await initializeOpenAI();

    if (!client) {
        return {
            score: 5,
            suggestions: ['OpenAI not configured']
        };
    }

    try {
        const response = await client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: 'system',
                    content: 'Analyze this image generation prompt and provide a quality score (1-10) and 3 specific suggestions for improvement. Format: SCORE: X\nSUGGESTIONS:\n1. ...\n2. ...\n3. ...'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 200,
        });

        const analysis = response.choices[0].message.content;

        // Parse the response
        const scoreMatch = analysis.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;

        const suggestions = analysis
            .split('SUGGESTIONS:')[1]
            ?.split('\n')
            .filter(line => line.trim().match(/^\d+\./))
            .map(line => line.trim()) || [];

        return {
            score,
            suggestions,
            fullAnalysis: analysis
        };

    } catch (error) {
        console.error('Error analyzing prompt:', error);
        return {
            score: 5,
            suggestions: ['Analysis failed'],
            error: error.message
        };
    }
}

module.exports = {
    enhancePrompt,
    enhancePromptBatch,
    analyzePrompt,
    initializeOpenAI,
};
