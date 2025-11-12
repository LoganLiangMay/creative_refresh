/**
 * Image Generator for Localhost Development
 * Uses Replicate API (google/nano-banana - Gemini 2.5 Flash) for AI image generation
 * Supports MOCK_MODE for free testing without API calls
 */

const Replicate = require('replicate');
const axios = require('axios');
const sharp = require('sharp');

// Replicate Configuration
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN; // From .env.local
const REPLICATE_MODEL = 'google/nano-banana'; // Gemini 2.5 Flash Image
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Initialize Replicate client
let replicateClient = null;
if (!MOCK_MODE && REPLICATE_API_TOKEN) {
  replicateClient = new Replicate({
    auth: REPLICATE_API_TOKEN
  });
}

console.log(`Image Generator initialized in ${MOCK_MODE ? 'MOCK' : 'REAL'} mode`);
if (!MOCK_MODE) {
  console.log(`Using Replicate model: ${REPLICATE_MODEL}`);
}

/**
 * Generate a mock image for testing (free, no API call)
 * @param {string} aspectRatio - '1.91:1' (landscape) or '1:1' (square)
 * @param {string} prompt - User's image generation prompt
 * @returns {Promise<Buffer>} - JPEG image buffer
 */
async function generateMockImage(aspectRatio, prompt) {
  console.log(`📸 Generating MOCK image (${aspectRatio})`);

  const dimensions =
    aspectRatio === '1.91:1' ? { width: 1200, height: 628 } : { width: 1200, height: 1200 };

  // Create a gradient background with text overlay
  const svg = `
    <svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(99,102,241);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(168,85,247);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#grad1)"/>
      <text x="50%" y="40%" text-anchor="middle" font-family="Arial" font-size="48" fill="white" font-weight="bold">
        MOCK IMAGE
      </text>
      <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="24" fill="white">
        ${aspectRatio === '1.91:1' ? 'Landscape (1200x628)' : 'Square (1200x1200)'}
      </text>
      <text x="50%" y="65%" text-anchor="middle" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.8)">
        ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}
      </text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();

  console.log(`✅ Mock image generated (${buffer.length} bytes)`);
  return buffer;
}

/**
 * Generate image using Replicate API (google/nano-banana - Gemini 2.5 Flash)
 * @param {string} aspectRatio - '1.91:1' (landscape) or '1:1' (square)
 * @param {string} prompt - User's image generation prompt
 * @param {Array<Buffer>} inputImages - Optional reference images for multi-modal generation
 * @returns {Promise<Buffer>} - JPEG image buffer
 */
async function generateRealImage(aspectRatio, prompt, inputImages = []) {
  console.log(`🎨 Generating REAL image using Replicate (${aspectRatio})`);

  if (!REPLICATE_API_TOKEN) {
    throw new Error(
      'REPLICATE_API_TOKEN not configured in .env.local. Set MOCK_MODE=true for testing without API.'
    );
  }

  if (!replicateClient) {
    throw new Error('Replicate client not initialized');
  }

  // Calculate target dimensions
  const targetDimensions =
    aspectRatio === '1.91:1' ? { width: 1200, height: 628 } : { width: 1200, height: 1200 };

  // Map our aspect ratios to Replicate's supported values
  // 1.91:1 (landscape for RDA) -> 16:9 (closest match, will resize to 1200x628)
  // 1:1 (square for RDA) -> 1:1 (exact match)
  const replicateAspectRatio = aspectRatio === '1.91:1' ? '16:9' : '1:1';

  // Enhance prompt based on whether reference image is provided
  let enhancedPrompt;
  if (inputImages && inputImages.length > 0) {
    // With reference image: emphasize preserving details
    if (aspectRatio === '1:1') {
      enhancedPrompt = `${prompt}. IMPORTANT: Keep all product details from the reference image exactly as shown. ${targetDimensions.width}x${targetDimensions.height} pixels square format, ensure the subject fills the frame completely. High quality, professional, marketing-ready.`;
    } else {
      enhancedPrompt = `${prompt}. Maintain product details from reference image. ${targetDimensions.width}x${targetDimensions.height} pixels landscape format. High quality, professional, marketing-ready.`;
    }
  } else {
    // Without reference image: standard enhancement
    enhancedPrompt = `${prompt}. ${targetDimensions.width}x${targetDimensions.height} pixels, ${aspectRatio === '1:1' ? 'square' : 'landscape'} format. High quality, professional, marketing-ready.`;
  }

  try {
    console.log(`Calling Replicate model: ${REPLICATE_MODEL}`);
    console.log(`Prompt: "${enhancedPrompt}"`);
    console.log(`Aspect ratio: ${replicateAspectRatio} (will be resized to ${targetDimensions.width}x${targetDimensions.height})`);

    // Build input for Replicate
    const input = {
      prompt: enhancedPrompt,
      aspect_ratio: replicateAspectRatio,
      output_format: 'jpg',
      output_quality: 90,
    };

    // Add reference images if provided (for multi-modal generation)
    // nano-banana expects 'image_input' as array of data URIs
    if (inputImages && inputImages.length > 0) {
      const imageSize = inputImages[0].length;
      console.log(`✅ INCLUDING REFERENCE IMAGE FOR nano-banana`);
      console.log(`   Image size: ${(imageSize / 1024).toFixed(2)} KB`);
      console.log(`   Parameter: image_input (array of data URIs)`);
      console.log(`   This image will guide product details in the generated output\n`);

      // Convert buffers to base64 data URLs and put in array
      const dataUrl = `data:image/jpeg;base64,${inputImages[0].toString('base64')}`;
      input.image_input = [dataUrl];
    } else {
      console.log(`ℹ️  No reference image - generating from prompt only\n`);
    }

    // Run Replicate model
    const output = await replicateClient.run(REPLICATE_MODEL, { input });

    // Validate response
    if (!output) {
      throw new Error('Replicate API returned no image');
    }

    let imageUrl;

    // Handle different output formats (same logic as Lambda worker)
    if (typeof output === 'string') {
      // Direct URL string
      imageUrl = output;
    } else if (typeof output === 'object' && output.url) {
      // FileOutput object - url might be a function
      imageUrl = typeof output.url === 'function' ? output.url() : output.url;
    } else if (Array.isArray(output) && output.length > 0) {
      // Fallback: array format
      const imageOutput = output[0];
      if (typeof imageOutput === 'string') {
        imageUrl = imageOutput;
      } else if (typeof imageOutput === 'object' && imageOutput.url) {
        imageUrl = typeof imageOutput.url === 'function' ? imageOutput.url() : imageOutput.url;
      }
    }

    if (!imageUrl) {
      throw new Error('Replicate API returned unexpected output format');
    }

    console.log(`Downloading image from: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    console.log(`✅ Image downloaded (${imageBuffer.length} bytes)`);

    // Ensure correct dimensions using Sharp
    const processedBuffer = await sharp(imageBuffer)
      .resize(targetDimensions.width, targetDimensions.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(`✅ Image processed to ${targetDimensions.width}x${targetDimensions.height}`);
    return processedBuffer;
  } catch (error) {
    console.error('❌ Replicate API error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to generate image via Replicate: ${error.message}`);
  }
}

/**
 * Generate both landscape and square images for RDA
 * @param {string|Object} promptInput - Either a single prompt string, or {landscape: string, square: string}
 * @param {Array<Buffer>} inputImages - Optional reference images
 * @returns {Promise<Object>} - { landscape: Buffer, square: Buffer, prompts: {landscape, square} }
 */
async function generateImagesForRDA(promptInput, inputImages = []) {
  console.log(`\n🚀 Generating images for RDA...`);
  console.log(`Mode: ${MOCK_MODE ? 'MOCK' : 'REAL (Replicate - google/nano-banana)'}\n`);

  // Handle both single prompt and separate prompts
  let landscapePrompt, squarePrompt;
  if (typeof promptInput === 'string') {
    // Legacy: single prompt for both
    landscapePrompt = promptInput;
    squarePrompt = promptInput;
    console.log(`Using single prompt for both formats:`);
    console.log(`"${promptInput}"\n`);
  } else {
    // New: separate prompts
    landscapePrompt = promptInput.landscape;
    squarePrompt = promptInput.square;
    console.log(`Using optimized prompts:`);
    console.log(`Landscape: "${landscapePrompt.substring(0, 100)}..."`);
    console.log(`Square: "${squarePrompt.substring(0, 100)}..."\n`);
  }

  const generateFn = MOCK_MODE ? generateMockImage : generateRealImage;

  try {
    // Generate both versions in parallel with their specific prompts
    const [landscape, square] = await Promise.all([
      generateFn('1.91:1', landscapePrompt, inputImages),
      generateFn('1:1', squarePrompt, inputImages),
    ]);

    console.log(`\n✅ Both images generated successfully!\n`);
    console.log(`   Landscape: ${landscape.length} bytes (1200x628)`);
    console.log(`   Square: ${square.length} bytes (1200x1200)\n`);

    return {
      landscape,
      square,
      prompts: {
        landscape: landscapePrompt,
        square: squarePrompt,
      },
    };
  } catch (error) {
    console.error('❌ Failed to generate images:', error.message);
    throw error;
  }
}

module.exports = {
  generateImagesForRDA,
  generateRealImage,
  generateMockImage,
};
