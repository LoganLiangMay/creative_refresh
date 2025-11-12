# RDA Publisher - Integration Guide

**AI-Powered Responsive Display Ad Publisher for Google Ads**

Version: 1.0
Last Updated: 2025-11-12

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
- [Integration Examples](#integration-examples)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Environment Configuration](#environment-configuration)
- [Deployment Guide](#deployment-guide)

---

## Overview

The RDA Publisher is a complete workflow for creating Google Ads Responsive Display Ads (RDAs) with AI-generated images. It combines:

1. **AI Image Generation** - Uses Gemini API (imagen-3.0-generate-002) to create images from text prompts
2. **AWS S3 Upload** - Automatically uploads and resizes images to landscape (1200x628) and square (1200x1200) formats
3. **Google Ads Publishing** - Creates RDAs in Google Ads via the Google Ads API

### Key Features

- ✅ AI-generated images from text prompts
- ✅ Optional reference image support for style guidance
- ✅ Automatic image resizing (landscape + square)
- ✅ Direct Google Ads API integration
- ✅ MOCK_MODE for free testing without API costs
- ✅ Real-time validation (character limits, field requirements)
- ✅ Two-column UI with live preview

### Technology Stack

- **Backend**: Node.js + Express.js
- **AI**: Google Gemini API (imagen-3.0-generate-002)
- **Storage**: AWS S3
- **Ads**: Google Ads API (google-ads-api npm package)
- **Image Processing**: Sharp

---

## Quick Start

### Prerequisites

```bash
# Required environment variables
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name

GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_CAMPAIGN_ID=campaign_id
GOOGLE_ADS_AD_GROUP_ID=ad_group_id

# Optional: For real AI generation (otherwise uses MOCK_MODE)
GEMINI_API_KEY=AIza_your_gemini_key
MOCK_MODE=false  # Set to true for free testing
```

### Installation

```bash
cd localhost-dev
npm install
node server.js
```

Server runs on `http://localhost:3001`

### Test the API

```bash
# Health check
curl http://localhost:3001/api/health

# Generate images (MOCK mode - free)
curl -X POST http://localhost:3001/api/generate-images \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Modern tech product on gradient background"}'
```

---

## API Endpoints

### 1. Generate Images Only

**Endpoint:** `POST /api/generate-images`

**Purpose:** Generate AI images from a text prompt (preview only, no S3 upload)

**Request:**
```json
{
  "prompt": "Modern minimalist headphones on clean white background"
}
```

**Response:**
```json
{
  "success": true,
  "mode": "MOCK",
  "images": {
    "landscape": {
      "data": "base64_encoded_image_data...",
      "dimensions": { "width": 1200, "height": 628 },
      "mimeType": "image/jpeg"
    },
    "square": {
      "data": "base64_encoded_image_data...",
      "dimensions": { "width": 1200, "height": 1200 },
      "mimeType": "image/jpeg"
    }
  },
  "prompt": "Modern minimalist headphones on clean white background"
}
```

**Use Case:** Preview AI-generated images before committing to full ad creation

---

### 2. Generate & Publish (Recommended)

**Endpoint:** `POST /api/generate-and-publish`

**Purpose:** Complete workflow - generate images → upload to S3 → publish RDA to Google Ads

**Request:**
```json
{
  "prompt": "Modern minimalist headphones on clean white background",
  "businessName": "TechBrand",
  "longHeadline": "Experience Pure Sound - Premium Wireless Headphones",
  "headlines": [
    "Premium Sound Quality",
    "Wireless Freedom",
    "All-Day Comfort"
  ],
  "descriptions": [
    "Immerse yourself in crystal-clear audio with our premium wireless headphones.",
    "Enjoy 30-hour battery life and active noise cancellation."
  ],
  "finalUrl": "https://example.com/products/headphones",
  "callToAction": "Shop Now",
  "adName": "AI_RDA_Headphones_2025",
  "status": "PAUSED"
}
```

**Response:**
```json
{
  "success": true,
  "resourceName": "customers/5533110357/adGroupAds/51907360302~783828561722",
  "assets": {
    "landscape": ["customers/5533110357/assets/308426117920"],
    "square": ["customers/5533110357/assets/308333152181"]
  },
  "ad": {
    "headlines": ["Premium Sound Quality", "Wireless Freedom", "All-Day Comfort"],
    "longHeadline": "Experience Pure Sound - Premium Wireless Headphones",
    "descriptions": [
      "Immerse yourself in crystal-clear audio with our premium wireless headphones.",
      "Enjoy 30-hour battery life and active noise cancellation."
    ],
    "businessName": "TechBrand"
  },
  "generatedImages": {
    "landscape": ["https://vid-ad-videos.s3.us-east-1.amazonaws.com/rda-ads/ai-generated-landscape-1762919765229.jpg"],
    "square": ["https://vid-ad-videos.s3.us-east-1.amazonaws.com/rda-ads/ai-generated-square-1762919765229.jpg"]
  },
  "mode": "MOCK",
  "prompt": "Modern minimalist headphones on clean white background"
}
```

**Use Case:** One-click ad creation from prompt to published ad

---

### 3. Upload Images to S3

**Endpoint:** `POST /api/upload-images`

**Purpose:** Upload images and get S3 URLs (no Google Ads publishing)

**Request:** `multipart/form-data`
```
images: [File, File, ...] (1-10 image files)
```

**Response:**
```json
{
  "success": true,
  "images": {
    "landscape": [
      {
        "url": "https://bucket.s3.region.amazonaws.com/rda-ads/uuid-timestamp.jpg",
        "dimensions": { "width": 1200, "height": 628 }
      }
    ],
    "square": [
      {
        "url": "https://bucket.s3.region.amazonaws.com/rda-ads/uuid-timestamp.jpg",
        "dimensions": { "width": 1200, "height": 1200 }
      }
    ]
  }
}
```

**Use Case:** Pre-upload images for later use, or get S3 URLs for manual ad creation

---

### 4. Publish RDA with Existing S3 URLs

**Endpoint:** `POST /api/publish-ad`

**Purpose:** Create Google Ads RDA using pre-existing S3 image URLs

**Request:**
```json
{
  "landscapeImageUrls": [
    "https://bucket.s3.amazonaws.com/rda-ads/image1.jpg"
  ],
  "squareImageUrls": [
    "https://bucket.s3.amazonaws.com/rda-ads/image2.jpg"
  ],
  "businessName": "TechBrand",
  "longHeadline": "Experience Pure Sound",
  "headlines": ["Premium Quality", "Wireless Freedom"],
  "descriptions": ["Description line 1", "Description line 2"],
  "finalUrl": "https://example.com",
  "callToAction": "Shop Now",
  "adName": "RDA_Custom_Name",
  "status": "PAUSED"
}
```

**Response:**
```json
{
  "success": true,
  "resourceName": "customers/ID/adGroupAds/ID~ID",
  "assets": {
    "landscape": ["customers/ID/assets/ASSET_ID"],
    "square": ["customers/ID/assets/ASSET_ID"]
  },
  "ad": { /* ad details */ }
}
```

**Use Case:** Publish ads using images you've already uploaded or processed separately

---

### 5. Upload & Publish (Full Flow)

**Endpoint:** `POST /api/publish-ad-full-flow`

**Purpose:** Upload user-provided images → S3 → publish to Google Ads

**Request:** `multipart/form-data`
```
images: [File, File, ...] (1-10 image files)
adData: JSON string with ad details (same as /api/publish-ad)
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3001/api/publish-ad-full-flow \
  -F "images=@headphone.jpg" \
  -F 'adData={"businessName":"TechBrand","longHeadline":"Experience Pure Sound","headlines":["Premium Quality"],"descriptions":["Great sound"],"finalUrl":"https://example.com"}'
```

**Response:** Same as `/api/publish-ad`

**Use Case:** Users upload their own images instead of using AI generation

---

### 6. List Google Ads Customers

**Endpoint:** `GET /api/customers`

**Purpose:** List all accessible Google Ads customer accounts

**Request:** None

**Response:**
```json
{
  "success": true,
  "customers": [
    "customers/1234567890",
    "customers/9876543210"
  ]
}
```

**Use Case:** Verify Google Ads API connectivity, discover customer IDs

---

## Integration Examples

### React/Frontend Integration

```javascript
// Example: Generate and publish ad from your React app

async function createAdWithAI(prompt, adDetails) {
  try {
    const response = await fetch('http://localhost:3001/api/generate-and-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        businessName: adDetails.businessName,
        longHeadline: adDetails.longHeadline,
        headlines: adDetails.headlines,
        descriptions: adDetails.descriptions,
        finalUrl: adDetails.finalUrl,
        callToAction: adDetails.callToAction,
        status: 'PAUSED', // Always start paused for review
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('Ad published!', result.resourceName);
      console.log('Image URLs:', result.generatedImages);
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to create ad:', error);
    throw error;
  }
}

// Usage
createAdWithAI(
  'Modern tech headphones with minimalist design',
  {
    businessName: 'TechBrand',
    longHeadline: 'Experience Pure Sound',
    headlines: ['Premium Quality', 'Wireless Freedom', 'All-Day Comfort'],
    descriptions: ['Crystal clear audio', 'Long battery life'],
    finalUrl: 'https://example.com/headphones',
    callToAction: 'Shop Now',
  }
);
```

### Node.js/Backend Integration

```javascript
const axios = require('axios');

// Example: Generate images only for preview
async function previewAIImages(prompt) {
  const response = await axios.post('http://localhost:3001/api/generate-images', {
    prompt,
  });

  if (response.data.success) {
    const { landscape, square } = response.data.images;

    // Save base64 images to files or display in UI
    const landscapeBuffer = Buffer.from(landscape.data, 'base64');
    const squareBuffer = Buffer.from(square.data, 'base64');

    console.log(`Generated ${response.data.mode} images`);
    return { landscapeBuffer, squareBuffer };
  }

  throw new Error('Image generation failed');
}

// Example: Upload existing images and publish
async function publishWithExistingImages(imagePaths, adDetails) {
  const FormData = require('form-data');
  const fs = require('fs');

  const formData = new FormData();

  // Append image files
  imagePaths.forEach((path) => {
    formData.append('images', fs.createReadStream(path));
  });

  // Append ad details
  formData.append('adData', JSON.stringify(adDetails));

  const response = await axios.post(
    'http://localhost:3001/api/publish-ad-full-flow',
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return response.data;
}
```

### Python Integration

```python
import requests

def generate_and_publish_ad(prompt, ad_details):
    """Generate AI images and publish to Google Ads"""

    url = "http://localhost:3001/api/generate-and-publish"

    payload = {
        "prompt": prompt,
        **ad_details
    }

    response = requests.post(url, json=payload)
    result = response.json()

    if result.get("success"):
        print(f"Ad published: {result['resourceName']}")
        print(f"Images: {result['generatedImages']}")
        return result
    else:
        raise Exception(f"Failed to publish ad: {result.get('error')}")

# Usage
generate_and_publish_ad(
    prompt="Modern tech headphones with minimalist design",
    ad_details={
        "businessName": "TechBrand",
        "longHeadline": "Experience Pure Sound",
        "headlines": ["Premium Quality", "Wireless Freedom"],
        "descriptions": ["Crystal clear audio with active noise cancellation"],
        "finalUrl": "https://example.com/headphones",
        "callToAction": "Shop Now",
        "status": "PAUSED"
    }
)
```

---

## Data Models

### Ad Data Model

```typescript
interface AdData {
  // Image Generation (for /api/generate-and-publish only)
  prompt?: string; // AI image generation prompt

  // Required Fields
  businessName: string; // ≤25 characters
  longHeadline: string; // ≤90 characters
  headlines: string[]; // 1-5 items, each ≤30 characters
  descriptions: string[]; // 1-5 items, each ≤90 characters
  finalUrl: string; // Valid URL

  // Optional Fields
  callToAction?: string; // e.g., "Shop Now", "Learn More", "Sign Up"
  adName?: string; // Auto-generated if not provided
  status?: "ENABLED" | "PAUSED"; // Default: "PAUSED"

  // Optional: Brand colors (Google Ads will auto-detect if not provided)
  mainColor?: string; // Hex color code
  accentColor?: string; // Hex color code
  allowFlexibleColor?: boolean; // Allow Google to adjust colors
}
```

### Validation Rules

| Field | Min | Max | Required | Notes |
|-------|-----|-----|----------|-------|
| `businessName` | 1 | 25 chars | ✅ | Company/brand name |
| `longHeadline` | 1 | 90 chars | ✅ | Main headline |
| `headlines` | 1 | 5 items | ✅ | Each ≤30 chars |
| `descriptions` | 1 | 5 items | ✅ | Each ≤90 chars |
| `finalUrl` | - | - | ✅ | Must be valid URL |
| `prompt` | 1 | - | ✅* | *Only for AI generation |
| `callToAction` | - | - | ❌ | Defaults to "Learn More" |
| `adName` | - | - | ❌ | Auto: `RDA_timestamp` |
| `status` | - | - | ❌ | Default: "PAUSED" |

### Image Requirements

**Generated Images:**
- Landscape: 1200x628 (1.91:1 ratio) - Minimum 600x314
- Square: 1200x1200 (1:1 ratio) - Minimum 300x300
- Format: JPEG, quality 90%
- Storage: AWS S3 (`rda-ads/` folder)

**File Upload:**
- Max 10 images per request
- Max 10MB per image
- Supported: JPEG, PNG, WebP
- Auto-resized to required dimensions

---

## Error Handling

### Common Error Responses

```json
// Missing required field
{
  "success": false,
  "error": "Business name is required"
}

// Validation error
{
  "success": false,
  "error": "Headline 1 must be ≤30 characters"
}

// Google Ads API error
{
  "success": false,
  "error": "Failed to create RDA: INVALID_FINAL_URL",
  "details": [
    {
      "message": "The final URL is not valid",
      "errorCode": "INVALID_FINAL_URL"
    }
  ]
}

// S3 upload error
{
  "success": false,
  "error": "Failed to upload to S3: Access Denied"
}

// AI generation error
{
  "success": false,
  "error": "Failed to generate image: API quota exceeded"
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | Ad published successfully |
| `400` | Bad Request | Missing required field, validation error |
| `500` | Server Error | Google Ads API error, S3 error, AI generation failed |

### Error Handling Best Practices

```javascript
async function safelyPublishAd(adData) {
  try {
    const response = await fetch('/api/generate-and-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adData),
    });

    const result = await response.json();

    if (!result.success) {
      // Handle application-level errors
      console.error('Application error:', result.error);

      if (result.details) {
        // Google Ads API specific errors
        result.details.forEach(err => {
          console.error(`- ${err.errorCode}: ${err.message}`);
        });
      }

      return { error: result.error };
    }

    // Success
    return result;

  } catch (error) {
    // Handle network/parse errors
    console.error('Network error:', error);
    return { error: 'Failed to connect to server' };
  }
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAT7GFUFQYSJOM2ANB
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=vid-ad-videos

# Google Ads API Configuration
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token
GOOGLE_ADS_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=1//your_refresh_token
GOOGLE_ADS_CUSTOMER_ID=5533110357  # No dashes
GOOGLE_ADS_CAMPAIGN_ID=1358949011  # Display campaign ID
GOOGLE_ADS_AD_GROUP_ID=51907360302  # Ad group within campaign

# AI Image Generation (Optional - uses MOCK mode if not set)
GEMINI_API_KEY=AIza_your_gemini_api_key
MOCK_MODE=true  # Set to false for real AI generation

# Server Configuration
LOCAL_SERVER_PORT=3001
ENVIRONMENT=dev
```

### S3 Bucket Configuration

**Bucket Policy Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForRDAFolder",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vid-ad-videos/rda-ads/*"
    }
  ]
}
```

**CORS Configuration:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Google Ads API Setup

1. **Get Developer Token**: https://developers.google.com/google-ads/api/docs/get-started/dev-token
2. **Create OAuth Client**: https://console.cloud.google.com/apis/credentials
3. **Generate Refresh Token**: Use Google OAuth Playground or `google-ads-api` CLI
4. **Find Campaign/Ad Group IDs**: Use `localhost-dev/find-display-campaigns.js`

---

## Deployment Guide

### Option 1: AWS Lambda + API Gateway

**Benefits:**
- Serverless, auto-scaling
- Pay per request
- No server management

**Required Changes:**
```javascript
// Lambda handler wrapper
exports.handler = async (event) => {
  // Parse API Gateway event
  const body = JSON.parse(event.body);

  // Call existing endpoint logic
  const result = await generateAndPublish(body);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
```

### Option 2: Docker Container

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

```bash
docker build -t rda-publisher .
docker run -p 3001:3001 --env-file .env rda-publisher
```

### Option 3: Direct Integration into Existing Platform

**Add to your Express app:**

```javascript
// your-app.js
const rdaPublisher = require('./rda-publisher');

// Mount RDA routes under /rda prefix
app.use('/rda', rdaPublisher);

// Now available at:
// POST /rda/generate-and-publish
// POST /rda/generate-images
// etc.
```

**Module exports needed:**

```javascript
// rda-publisher/index.js
const express = require('express');
const router = express.Router();

// Import handlers
const { generateAndPublish, generateImages } = require('./lib/handlers');

router.post('/generate-and-publish', generateAndPublish);
router.post('/generate-images', generateImages);

module.exports = router;
```

---

## Testing Utilities

### Test Connection to Google Ads

```bash
cd localhost-dev
node test-connection.js
```

Verifies:
- ✅ Google Ads API credentials
- ✅ Customer access
- ✅ Campaigns and ad groups

### Find Display Campaigns

```bash
node find-display-campaigns.js
```

Lists all Display campaigns and their ad groups with IDs you can use.

### View Published Ad

```bash
node view-ad.js customers/5533110357/adGroupAds/51907360302~783828561722
```

Fetches ad details from Google Ads API.

---

## FAQ

**Q: Can I use this without Google Ads?**
A: Yes! Use `/api/generate-images` or `/api/upload-images` endpoints to generate/process images without publishing to Google Ads.

**Q: What's MOCK_MODE?**
A: Free testing mode that generates gradient placeholder images instead of calling Gemini API. Perfect for development.

**Q: Can I customize the AI-generated images?**
A: Yes! Provide a reference image when generating to guide the AI's style. Also works in MOCK mode (shows reference in preview).

**Q: How much does it cost?**
A:
- MOCK mode: $0
- Gemini API: ~$0.04 per image
- Google Ads: Normal ad costs (set your own budget)
- AWS S3: ~$0.023/GB storage + $0.09/GB transfer

**Q: Can I regenerate images if I don't like them?**
A: Yes! Call `/api/generate-images` multiple times with different prompts until you're happy, then use `/api/publish-ad` with the URLs.

**Q: Are ads published live immediately?**
A: No - default status is `PAUSED`. Review in Google Ads UI before enabling.

**Q: Can I use my own images instead of AI generation?**
A: Yes! Use `/api/publish-ad-full-flow` with your image files.

---

## Support & Contact

**Issues:**
- AWS S3 errors: Check bucket policy and CORS configuration
- Google Ads errors: Verify campaign/ad group IDs are for Display campaigns
- AI generation errors: Check GEMINI_API_KEY or use MOCK_MODE

**Utilities:**
- Health check: `GET /api/health`
- Test Google Ads connection: `node test-connection.js`
- Find campaigns: `node find-display-campaigns.js`

**Repository Structure:**
```
localhost-dev/
├── server.js                 # Main Express server
├── lib/
│   ├── imageGenerator.js     # Gemini API integration
│   ├── s3Upload.js          # AWS S3 uploads
│   └── googleAdsClient.js   # Google Ads API
├── public/
│   └── index.html           # Web UI
└── tests/
    ├── test-connection.js   # Google Ads connectivity
    └── find-display-campaigns.js
```

---

**Ready to integrate? Start with `/api/generate-and-publish` for the complete workflow!**
