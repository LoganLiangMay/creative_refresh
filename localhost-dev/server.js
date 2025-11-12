/**
 * Localhost Development Server
 * For testing Google Ads Responsive Display Ad publishing with AWS S3
 */

require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const { uploadImagesForRDA } = require('./lib/s3Upload');
const { createResponsiveDisplayAd, listAccessibleCustomers } = require('./lib/googleAdsClient');
const { generateImagesForRDA } = require('./lib/imageGenerator');
const { enhancePromptForRDA } = require('./lib/promptEnhancer');

const app = express();
const PORT = process.env.LOCAL_SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'RDA Publisher API is running',
    timestamp: new Date().toISOString(),
    config: {
      s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'Not configured',
      googleAdsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || 'Not configured',
      googleAdsAdGroupId: process.env.GOOGLE_ADS_AD_GROUP_ID || 'Not configured',
    },
  });
});

/**
 * GET /api/customers
 * List accessible Google Ads customers
 */
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await listAccessibleCustomers();
    res.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error('Error listing customers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/upload-images
 * Upload images to S3 and return URLs
 * Automatically creates both landscape and square versions
 */
app.post('/api/upload-images', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images provided',
      });
    }

    console.log(`\n📤 Uploading ${req.files.length} image(s) to S3...`);

    // Prepare images for upload
    const images = req.files.map((file) => ({
      buffer: file.buffer,
      name: file.originalname,
    }));

    // Upload to S3 (creates both landscape and square versions)
    const results = await uploadImagesForRDA(images);

    res.json({
      success: true,
      message: `Uploaded ${images.length} images (${results.landscape.length} landscape + ${results.square.length} square)`,
      images: {
        landscape: results.landscape.map((r) => ({
          url: r.url,
          dimensions: r.dimensions,
        })),
        square: results.square.map((r) => ({
          url: r.url,
          dimensions: r.dimensions,
        })),
      },
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/publish-ad
 * Create Responsive Display Ad in Google Ads
 *
 * Request body:
 * {
 *   landscapeImageUrls: string[],  // S3 URLs from /api/upload-images
 *   squareImageUrls: string[],     // S3 URLs from /api/upload-images
 *   headlines: string[],           // Max 5, ≤30 chars each
 *   longHeadline: string,          // ≤90 chars
 *   descriptions: string[],        // Max 5, ≤90 chars each
 *   businessName: string,          // ≤25 chars
 *   finalUrl: string,              // Landing page URL
 *   callToAction: string?,         // Optional, e.g. "Learn More"
 *   mainColor: string?,            // Optional, e.g. "#0000ff"
 *   accentColor: string?,          // Optional, e.g. "#ffff00"
 * }
 */
app.post('/api/publish-ad', async (req, res) => {
  try {
    const {
      landscapeImageUrls,
      squareImageUrls,
      headlines,
      longHeadline,
      descriptions,
      businessName,
      finalUrl,
      callToAction,
      mainColor,
      accentColor,
      allowFlexibleColor,
      adName,
      status,
    } = req.body;

    // Validate required fields
    if (!landscapeImageUrls || !Array.isArray(landscapeImageUrls) || landscapeImageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one landscape image URL is required',
      });
    }

    if (!squareImageUrls || !Array.isArray(squareImageUrls) || squareImageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one square image URL is required',
      });
    }

    if (!headlines || !Array.isArray(headlines) || headlines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one headline is required',
      });
    }

    if (!longHeadline) {
      return res.status(400).json({
        success: false,
        error: 'Long headline is required',
      });
    }

    if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one description is required',
      });
    }

    if (!businessName) {
      return res.status(400).json({
        success: false,
        error: 'Business name is required',
      });
    }

    if (!finalUrl) {
      return res.status(400).json({
        success: false,
        error: 'Final URL is required',
      });
    }

    // Check environment configuration
    if (!process.env.GOOGLE_ADS_CUSTOMER_ID) {
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_ADS_CUSTOMER_ID not configured in .env.local',
      });
    }

    if (!process.env.GOOGLE_ADS_AD_GROUP_ID) {
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_ADS_AD_GROUP_ID not configured in .env.local',
      });
    }

    console.log('\n🚀 Publishing Responsive Display Ad to Google Ads...');

    // Create RDA
    const result = await createResponsiveDisplayAd(
      {
        landscapeImageUrls,
        squareImageUrls,
        headlines,
        longHeadline,
        descriptions,
        businessName,
        finalUrl,
        callToAction,
        mainColor,
        accentColor,
        allowFlexibleColor,
      },
      {
        adName,
        status,
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Error publishing ad:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || null,
    });
  }
});

/**
 * POST /api/publish-ad-full-flow
 * Upload images to S3 AND create RDA in one request
 * Combines both /api/upload-images and /api/publish-ad
 */
app.post('/api/publish-ad-full-flow', upload.array('images', 10), async (req, res) => {
  try {
    // Step 1: Upload images to S3
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images provided',
      });
    }

    console.log(`\n📤 Step 1: Uploading ${req.files.length} image(s) to S3...`);

    const images = req.files.map((file) => ({
      buffer: file.buffer,
      name: file.originalname,
    }));

    const uploadResults = await uploadImagesForRDA(images);

    // Step 2: Extract ad data from request body
    const adData = JSON.parse(req.body.adData || '{}');

    const {
      headlines,
      longHeadline,
      descriptions,
      businessName,
      finalUrl,
      callToAction,
      mainColor,
      accentColor,
      allowFlexibleColor,
      adName,
      status,
    } = adData;

    // Validate required fields
    if (!headlines || !longHeadline || !descriptions || !businessName || !finalUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required ad fields: headlines, longHeadline, descriptions, businessName, finalUrl',
      });
    }

    console.log('\n🚀 Step 2: Publishing Responsive Display Ad to Google Ads...');

    // Step 3: Create RDA with uploaded image URLs
    const result = await createResponsiveDisplayAd(
      {
        landscapeImageUrls: uploadResults.landscape.map((r) => r.url),
        squareImageUrls: uploadResults.square.map((r) => r.url),
        headlines,
        longHeadline,
        descriptions,
        businessName,
        finalUrl,
        callToAction,
        mainColor,
        accentColor,
        allowFlexibleColor,
      },
      {
        adName,
        status,
      }
    );

    res.json({
      ...result,
      uploadedImages: {
        landscape: uploadResults.landscape.length,
        square: uploadResults.square.length,
      },
    });
  } catch (error) {
    console.error('Error in full flow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || null,
    });
  }
});

/**
 * POST /api/generate-images
 * Generate AI images from a prompt (landscape + square for RDA)
 * Uses OpenAI to create optimized prompts, then Replicate API for generation
 * Supports optional reference image for context-aware generation
 */
app.post('/api/generate-images', upload.single('referenceImage'), async (req, res) => {
  try {
    const userPrompt = req.body.prompt || req.body.userPrompt;
    const businessName = req.body.businessName || '';
    const longHeadline = req.body.longHeadline || '';
    const headlines = req.body.headlines ? (Array.isArray(req.body.headlines) ? req.body.headlines : req.body.headlines.split('\n').filter(h => h.trim())) : [];
    const descriptions = req.body.descriptions ? (Array.isArray(req.body.descriptions) ? req.body.descriptions : req.body.descriptions.split('\n').filter(d => d.trim())) : [];

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    console.log(`\n📸 Image Generation Request`);
    console.log(`   User Prompt: "${userPrompt}"`);
    console.log(`   Business: ${businessName || 'N/A'}`);
    console.log(`   Reference Image: ${req.file ? 'Yes' : 'No'}\n`);

    // Use OpenAI to generate optimized prompts for both aspect ratios
    const enhancedPrompts = await enhancePromptForRDA({
      userPrompt,
      businessName,
      longHeadline,
      headlines,
      descriptions,
      hasReferenceImage: !!req.file,
    });

    // Generate both landscape and square images with optimized prompts
    const inputImages = req.file ? [req.file.buffer] : [];
    const result = await generateImagesForRDA(enhancedPrompts, inputImages);

    // Return base64 encoded images for preview
    const response = {
      success: true,
      mode: process.env.MOCK_MODE === 'true' ? 'MOCK' : 'REAL',
      images: {
        landscape: {
          data: result.landscape.toString('base64'),
          dimensions: { width: 1200, height: 628 },
          mimeType: 'image/jpeg',
        },
        square: {
          data: result.square.toString('base64'),
          dimensions: { width: 1200, height: 1200 },
          mimeType: 'image/jpeg',
        },
      },
      prompts: {
        user: userPrompt,
        landscape: result.prompts.landscape,
        square: result.prompts.square,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating images:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/generate-and-publish
 * Complete workflow: Generate images from prompt → Upload to S3 → Publish RDA
 * This is the unified flow combining image generation + RDA publishing
 */
app.post('/api/generate-and-publish', async (req, res) => {
  try {
    const {
      prompt,
      businessName,
      longHeadline,
      headlines,
      descriptions,
      finalUrl,
      callToAction,
      adName,
      status,
      mainColor,
      accentColor,
      allowFlexibleColor,
    } = req.body;

    // Validate required fields
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }
    if (!businessName) {
      return res.status(400).json({ success: false, error: 'Business name is required' });
    }
    if (!longHeadline) {
      return res.status(400).json({ success: false, error: 'Long headline is required' });
    }
    if (!headlines || headlines.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one headline is required' });
    }
    if (!descriptions || descriptions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one description is required',
      });
    }
    if (!finalUrl) {
      return res.status(400).json({ success: false, error: 'Final URL is required' });
    }

    console.log(`\n🎬 Starting complete workflow: Generate → Upload → Publish\n`);

    // Step 1: Generate images using AI
    console.log(`📸 Step 1: Generating images from prompt...`);
    const generatedImages = await generateImagesForRDA(prompt);

    // Step 2: Upload images to S3
    console.log(`\n📤 Step 2: Uploading images to S3...`);
    const uploadResults = await uploadImagesForRDA([
      {
        buffer: generatedImages.landscape,
        name: `ai-generated-landscape-${Date.now()}.jpg`,
      },
      {
        buffer: generatedImages.square,
        name: `ai-generated-square-${Date.now()}.jpg`,
      },
    ]);

    const landscapeUrls = uploadResults.landscape.map((r) => r.url);
    const squareUrls = uploadResults.square.map((r) => r.url);

    console.log(`✅ Uploaded ${landscapeUrls.length} landscape + ${squareUrls.length} square images\n`);

    // Step 3: Publish RDA to Google Ads
    console.log(`🚀 Step 3: Publishing Responsive Display Ad to Google Ads...\n`);
    const result = await createResponsiveDisplayAd(
      {
        landscapeImageUrls: landscapeUrls,
        squareImageUrls: squareUrls,
        headlines,
        longHeadline,
        descriptions,
        businessName,
        finalUrl,
        callToAction,
        mainColor,
        accentColor,
        allowFlexibleColor,
      },
      {
        adName: adName || `AI_RDA_${Date.now()}`,
        status: status || 'PAUSED',
      }
    );

    res.json({
      ...result,
      generatedImages: {
        landscape: landscapeUrls,
        square: squareUrls,
      },
      mode: process.env.MOCK_MODE === 'true' ? 'MOCK' : 'REAL',
      prompt,
    });

    console.log(`\n✅ Complete workflow finished successfully!\n`);
  } catch (error) {
    console.error('Error in generate-and-publish workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || null,
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     🚀 RDA Publisher API Server                                ║
║                                                                ║
║     Server running at: http://localhost:${PORT}                    ║
║     UI available at:   http://localhost:${PORT}                    ║
║                                                                ║
║     Endpoints:                                                 ║
║     - GET  /api/health                                         ║
║     - GET  /api/customers                                      ║
║     - POST /api/upload-images                                  ║
║     - POST /api/publish-ad                                     ║
║     - POST /api/publish-ad-full-flow                           ║
║                                                                ║
║     Configuration:                                             ║
║     - S3 Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'Not configured'.padEnd(44)}  ║
║     - Customer ID: ${process.env.GOOGLE_ADS_CUSTOMER_ID || 'Not configured'.padEnd(42)}  ║
║     - Ad Group ID: ${process.env.GOOGLE_ADS_AD_GROUP_ID || 'Not configured'.padEnd(42)}  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
