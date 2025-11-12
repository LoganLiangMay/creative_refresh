/**
 * AI Prompt Enhancer for RDA Image Generation
 * Uses OpenAI to generate optimized prompts for landscape and square ad images
 */

const OpenAI = require('openai');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ENABLE_PROMPT_ENHANCEMENT = process.env.ENABLE_PROMPT_ENHANCEMENT !== 'false';

let openaiClient = null;

// Initialize OpenAI client
if (ENABLE_PROMPT_ENHANCEMENT && OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  console.log(`Prompt Enhancer initialized with ${OPENAI_MODEL}`);
} else if (ENABLE_PROMPT_ENHANCEMENT) {
  console.warn('⚠️  Prompt enhancement enabled but OPENAI_API_KEY not found - using basic enhancement');
}

/**
 * Enhance user prompt with OpenAI to generate optimized prompts for both aspect ratios
 * @param {Object} input - User's input
 * @param {string} input.userPrompt - User's image description
 * @param {string} input.businessName - Business/brand name
 * @param {string} input.longHeadline - Main ad headline
 * @param {Array<string>} input.headlines - Additional headlines
 * @param {Array<string>} input.descriptions - Ad descriptions
 * @param {boolean} input.hasReferenceImage - Whether reference image is provided
 * @returns {Promise<Object>} - { landscape: string, square: string }
 */
async function enhancePromptForRDA(input) {
  const {
    userPrompt,
    businessName = '',
    longHeadline = '',
    headlines = [],
    descriptions = [],
    hasReferenceImage = false,
  } = input;

  // If OpenAI is not available, use basic enhancement
  if (!ENABLE_PROMPT_ENHANCEMENT || !openaiClient) {
    return generateBasicEnhancement(input);
  }

  try {
    console.log('\n🤖 Enhancing prompts with OpenAI...');

    // First, analyze user intent if reference image is provided
    let userIntent = 'creative';
    if (hasReferenceImage) {
      userIntent = analyzeUserIntent(userPrompt);
      console.log(`📊 Detected user intent: ${userIntent.toUpperCase()}`);
    }

    const systemPrompt = `You are an expert advertising creative director specializing in Google Display Ads (RDA).

Your task is to transform user input into TWO professional image generation prompts - one optimized for landscape format (1200x628) and one for square format (1200x1200).

IMPORTANT RULES:
1. Landscape (16:9): Emphasize horizontal composition, dynamic scenes, movement, storytelling
2. Square (1:1): Adapt composition for 1:1 format while HONORING user's creative vision. If user wants models/people/scenes, include them! Keep product prominent but allow dynamic, artsy compositions as requested.
3. Both prompts should be detailed, professional, and optimized for AI image generation (Replicate nano-banana model)
4. Include lighting, mood, style, and composition details
5. Keep brand identity and messaging consistent
6. For reference images - ADAPT INSTRUCTIONS BASED ON USER INTENT:

   ${
     userIntent === 'exact'
       ? `   USER WANTS EXACT REPLICATION (1-to-1):
   - START prompt with "Using the reference image as exact template"
   - Instruct: "Replicate the scene EXACTLY as shown - same composition, same lighting, same angle"
   - Instruct: "Product AND scene must be identical to reference"
   - For square: "Crop to 1:1 while maintaining exact composition"`
       : userIntent === 'preserve'
         ? `   USER WANTS TO PRESERVE PRODUCT IN NEW CONTEXT:
   - START prompt with "Using the reference image provided"
   - Instruct: "Preserve ALL product details (colors, design, features) EXACTLY as shown"
   - Instruct: "Product authenticity is critical - do NOT modify product appearance"
   - Instruct: "Place product in new context/composition as described by user"
   - For square: "Keep product prominent in 1:1 format while honoring user's vision (models, dynamic scenes, etc.)"`
         : `   USER WANTS CREATIVE INSPIRATION:
   - START prompt with "Inspired by the reference image style"
   - Instruct: "Use reference for style guidance, color palette, and mood"
   - Instruct: "Creative interpretation allowed while maintaining brand essence"
   - For square: "Adapt composition creatively for 1:1 format"`
   }
7. Make prompts specific, visual, and actionable
8. Avoid vague terms - be concrete about what to show
9. Use professional photography terminology (studio lighting, product photography, marketing shot, etc.)

Return ONLY a JSON object with this exact structure:
{
  "landscape": "detailed prompt for 1200x628 landscape image...",
  "square": "detailed prompt for 1200x1200 square image..."
}`;

    const userMessage = buildUserMessage(input, userIntent);

    const response = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log('✅ OpenAI prompt enhancement complete');
    console.log(`   Landscape: "${result.landscape.substring(0, 80)}..."`);
    console.log(`   Square: "${result.square.substring(0, 80)}..."\n`);

    return {
      landscape: result.landscape,
      square: result.square,
    };
  } catch (error) {
    console.error('❌ OpenAI prompt enhancement failed:', error.message);
    console.log('   Falling back to basic enhancement...\n');
    return generateBasicEnhancement(input);
  }
}

/**
 * Build user message for OpenAI
 */
function buildUserMessage(input, userIntent = 'creative') {
  const {
    userPrompt,
    businessName,
    longHeadline,
    headlines,
    descriptions,
    hasReferenceImage,
  } = input;

  const intentLabels = {
    exact: 'EXACT REPLICATION (1-to-1 copy)',
    preserve: 'PRESERVE PRODUCT in new composition',
    creative: 'CREATIVE INSPIRATION from reference',
  };

  let message = `Create professional image generation prompts for a Google Display Ad.

⚠️ CRITICAL: READ AND HONOR THE USER'S DESCRIPTION BELOW!
If user mentions models, people, wearing, dynamic scenes, artsy compositions - INCLUDE THESE IN BOTH PROMPTS!

USER'S IMAGE DESCRIPTION:
"${userPrompt}"

BRAND CONTEXT:
- Business Name: ${businessName || 'N/A'}
- Main Headline: ${longHeadline || 'N/A'}
- Key Messages: ${headlines.length > 0 ? headlines.join(', ') : 'N/A'}
- Ad Copy: ${descriptions.length > 0 ? descriptions[0] : 'N/A'}

${
  hasReferenceImage
    ? `
⚠️ CRITICAL: A REFERENCE IMAGE IS PROVIDED

DETECTED USER INTENT: ${intentLabels[userIntent] || 'CREATIVE INSPIRATION'}

${
  userIntent === 'exact'
    ? `The user wants to REPLICATE the reference image exactly:
- Same composition, lighting, angle as reference
- Product AND scene should be identical
- Minimal creative changes
- For square: Crop to 1:1 while maintaining the exact look`
    : userIntent === 'preserve'
      ? `The user wants to PRESERVE the product but create NEW composition:
- Keep ALL product details (colors, design, features) EXACTLY as shown
- Product authenticity is CRITICAL - do NOT modify product
- Place product in new context as user describes (models wearing it, dynamic scenes, artsy composition, etc.)
- For square: Keep product prominent but HONOR user's vision (models, movement, creative framing allowed)`
      : `The user wants CREATIVE INSPIRATION from reference:
- Use reference for style, mood, color palette guidance
- Creative interpretation is allowed
- Maintain brand essence but freedom in execution`
}
`
    : ''
}

Generate TWO distinct prompts:

1. LANDSCAPE PROMPT (1200x628, 16:9):
   - Optimize for horizontal storytelling
   - Dynamic composition with movement or action
   - Context and environment around the product
   - Professional advertising photography style
   ${hasReferenceImage ? '- Use reference image product but in landscape scene' : ''}

2. SQUARE PROMPT (1200x1200, 1:1):
   - HONOR USER'S CREATIVE VISION: If they want models/people/dynamic scenes, include them!
   - Adapt composition for square format (1:1 aspect ratio)
   - Keep product prominent and visible if reference image provided
   - Match the style, mood, and energy described by user (minimalist, artsy, dynamic, etc.)
   - Professional advertising photography style
   ${hasReferenceImage ? '- Product from reference should be visible but composition can be creative' : ''}

Both should be marketing-ready, high-quality, professional advertising images.`;

  return message;
}

/**
 * Analyze user intent from prompt to understand how to use reference image
 * @param {string} prompt - User's prompt
 * @returns {string} - 'exact' | 'preserve' | 'creative'
 */
function analyzeUserIntent(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // Keywords indicating EXACT replication (1-to-1 placement)
  const exactKeywords = [
    'exact',
    'exactly',
    'same as',
    'identical',
    'copy',
    'duplicate',
    'as shown',
    'as is',
    '1-to-1',
    '1:1',
    'verbatim',
    'precise',
    'replica',
  ];

  // Keywords indicating PRESERVE product but creative composition
  const preserveKeywords = [
    'from the reference',
    'wearing',
    'holding',
    'using',
    'with the',
    'from reference',
    'in reference',
    'shown in',
    'preserve',
    'keep',
    'maintain',
    'don\'t change',
    'do not change',
  ];

  // Check for exact replication intent
  for (const keyword of exactKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return 'exact';
    }
  }

  // Check for preserve product intent
  for (const keyword of preserveKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return 'preserve';
    }
  }

  // Default: creative inspiration
  return 'creative';
}

/**
 * Fallback: Basic prompt enhancement without OpenAI
 */
function generateBasicEnhancement(input) {
  const {
    userPrompt,
    businessName,
    longHeadline,
    headlines,
    hasReferenceImage,
  } = input;

  let basePrompt = userPrompt;

  // Add brand context
  if (businessName) {
    basePrompt += `. Brand: ${businessName}`;
  }
  if (longHeadline) {
    basePrompt += `. Message: ${longHeadline}`;
  }
  if (headlines.length > 0) {
    basePrompt += `. Keywords: ${headlines.slice(0, 3).join(', ')}`;
  }

  // Create landscape prompt
  const landscape = hasReferenceImage
    ? `${basePrompt}. Maintain product details from reference image. 1200x628 pixels landscape format, dynamic horizontal composition. High quality, professional, marketing-ready.`
    : `${basePrompt}. 1200x628 pixels landscape format. High quality, professional, marketing-ready.`;

  // Create square prompt
  const square = hasReferenceImage
    ? `${basePrompt}. IMPORTANT: Keep all product details from the reference image exactly as shown. 1200x1200 pixels square format, ensure the subject fills the frame completely, centered composition. High quality, professional, marketing-ready.`
    : `${basePrompt}. 1200x1200 pixels square format, subject fills frame. High quality, professional, marketing-ready.`;

  console.log('✅ Basic prompt enhancement complete (OpenAI not available)\n');

  return { landscape, square };
}

module.exports = {
  enhancePromptForRDA,
};
