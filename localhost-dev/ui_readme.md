# UI Integration Guide - AI-Powered RDA Publisher

**Version:** 1.0
**Last Updated:** 2025-11-12
**API Base URL:** `http://localhost:3001`

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [API Endpoints](#api-endpoints)
4. [Integration Workflows](#integration-workflows)
5. [Request/Response Examples](#requestresponse-examples)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Code Examples](#code-examples)

---

## Overview

This API provides three main capabilities:

1. **AI Image Generation** - Generate marketing images from text prompts using Replicate API with OpenAI prompt enhancement
2. **Image Upload** - Upload images to AWS S3 with automatic resizing (landscape + square)
3. **RDA Publishing** - Create Responsive Display Ads in Google Ads

### Key Features

- **Smart Prompt Enhancement**: Uses OpenAI to optimize your prompts with business context
- **Dual Aspect Ratios**: Automatically generates both landscape (1200x628) and square (1200x1200) images
- **Reference Image Support**: Upload a reference image to guide AI generation
- **One-Click Publishing**: Generate images and publish ads in a single workflow
- **Base64 Preview**: Get instant previews before publishing

---

## Quick Start

### 1. Health Check

```javascript
const response = await fetch('http://localhost:3001/api/health');
const data = await response.json();
console.log(data);
// { status: 'ok', message: 'RDA Publisher API is running', ... }
```

### 2. Generate AI Images

```javascript
const response = await fetch('http://localhost:3001/api/generate-images', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Modern wireless headphones on white background',
    businessName: 'Audio Co',
    longHeadline: 'Premium Sound Quality',
    headlines: ['Best Headphones', 'Free Shipping'],
    descriptions: ['Experience crystal clear audio']
  })
});

const result = await response.json();
// result.images.landscape.data = base64 encoded image
// result.images.square.data = base64 encoded image
```

### 3. Publish Ad (Full Flow)

```javascript
const response = await fetch('http://localhost:3001/api/generate-and-publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Modern wireless headphones',
    businessName: 'Audio Co',
    longHeadline: 'Premium Sound Quality',
    headlines: ['Best Headphones', 'Free Shipping'],
    descriptions: ['Experience crystal clear audio'],
    finalUrl: 'https://example.com'
  })
});

const result = await response.json();
// { success: true, resourceName: '...', generatedImages: {...} }
```

---

## API Endpoints

### 1. GET `/api/health`

Health check endpoint to verify API status.

**Response:**
```json
{
  "status": "ok",
  "message": "RDA Publisher API is running",
  "timestamp": "2025-11-12T10:30:00.000Z",
  "config": {
    "s3Bucket": "your-bucket-name",
    "googleAdsCustomerId": "123-456-7890",
    "googleAdsAdGroupId": "98765432"
  }
}
```

---

### 2. POST `/api/generate-images`

Generate AI images from a text prompt. Supports optional reference image.

**Request (JSON):**
```json
{
  "prompt": "Modern wireless headphones on clean white background",
  "businessName": "Audio Co",
  "longHeadline": "Premium Sound Quality",
  "headlines": ["Best Headphones", "Free Shipping"],
  "descriptions": ["Experience crystal clear audio"]
}
```

**Request (With Reference Image - multipart/form-data):**
```javascript
const formData = new FormData();
formData.append('prompt', 'Modern headphones matching this style');
formData.append('businessName', 'Audio Co');
formData.append('headlines', 'Best Headphones\nFree Shipping');
formData.append('referenceImage', fileInput.files[0]);

fetch('/api/generate-images', {
  method: 'POST',
  body: formData // Don't set Content-Type, browser handles it
});
```

**Response:**
```json
{
  "success": true,
  "mode": "REAL",
  "images": {
    "landscape": {
      "data": "base64-encoded-jpeg-data...",
      "dimensions": { "width": 1200, "height": 628 },
      "mimeType": "image/jpeg"
    },
    "square": {
      "data": "base64-encoded-jpeg-data...",
      "dimensions": { "width": 1200, "height": 1200 },
      "mimeType": "image/jpeg"
    }
  },
  "prompts": {
    "user": "Modern wireless headphones on clean white background",
    "landscape": "Optimized prompt for landscape aspect ratio...",
    "square": "Optimized prompt for square aspect ratio..."
  }
}
```

**Display Images:**
```javascript
const img = document.createElement('img');
img.src = `data:${result.images.landscape.mimeType};base64,${result.images.landscape.data}`;
document.body.appendChild(img);
```

---

### 3. POST `/api/upload-images`

Upload images to S3. Automatically creates both landscape and square versions.

**Request (multipart/form-data):**
```javascript
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2);

const response = await fetch('/api/upload-images', {
  method: 'POST',
  body: formData
});
```

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 2 images (2 landscape + 2 square)",
  "images": {
    "landscape": [
      {
        "url": "https://s3.amazonaws.com/bucket/landscape_uuid.jpg",
        "dimensions": { "width": 1200, "height": 628 }
      }
    ],
    "square": [
      {
        "url": "https://s3.amazonaws.com/bucket/square_uuid.jpg",
        "dimensions": { "width": 1200, "height": 1200 }
      }
    ]
  }
}
```

---

### 4. POST `/api/publish-ad`

Create a Responsive Display Ad in Google Ads using existing S3 image URLs.

**Request:**
```json
{
  "landscapeImageUrls": [
    "https://s3.amazonaws.com/bucket/landscape_uuid.jpg"
  ],
  "squareImageUrls": [
    "https://s3.amazonaws.com/bucket/square_uuid.jpg"
  ],
  "headlines": [
    "Premium Wireless Headphones",
    "Free Shipping Today"
  ],
  "longHeadline": "Experience Crystal Clear Sound Quality",
  "descriptions": [
    "Premium audio with 30-hour battery life"
  ],
  "businessName": "Audio Co",
  "finalUrl": "https://example.com/headphones",
  "callToAction": "Shop Now",
  "mainColor": "#0000ff",
  "accentColor": "#ffff00",
  "allowFlexibleColor": true,
  "adName": "RDA_Headphones_2025",
  "status": "PAUSED"
}
```

**Response:**
```json
{
  "success": true,
  "resourceName": "customers/123/adGroupAds/456~789",
  "assets": {
    "landscape": ["customers/123/assets/1001"],
    "square": ["customers/123/assets/1002"]
  },
  "ad": {
    "businessName": "Audio Co",
    "longHeadline": "Experience Crystal Clear Sound Quality",
    "headlines": ["Premium Wireless Headphones", "Free Shipping Today"],
    "descriptions": ["Premium audio with 30-hour battery life"]
  }
}
```

---

### 5. POST `/api/generate-and-publish`

Complete workflow: Generate images → Upload to S3 → Publish RDA.

**Request:**
```json
{
  "prompt": "Modern wireless headphones on white background",
  "businessName": "Audio Co",
  "longHeadline": "Premium Sound Quality",
  "headlines": ["Best Headphones", "Free Shipping"],
  "descriptions": ["Experience crystal clear audio"],
  "finalUrl": "https://example.com",
  "callToAction": "Shop Now",
  "adName": "RDA_AI_Generated",
  "status": "PAUSED"
}
```

**Response:**
```json
{
  "success": true,
  "resourceName": "customers/123/adGroupAds/456~789",
  "generatedImages": {
    "landscape": ["https://s3.amazonaws.com/bucket/landscape_uuid.jpg"],
    "square": ["https://s3.amazonaws.com/bucket/square_uuid.jpg"]
  },
  "mode": "REAL",
  "prompt": "Modern wireless headphones on white background",
  "assets": {
    "landscape": ["customers/123/assets/1001"],
    "square": ["customers/123/assets/1002"]
  }
}
```

---

## Integration Workflows

### Workflow 1: Preview Then Publish (Recommended)

**Best for:** Users who want to see generated images before publishing

```
1. User enters prompt + ad details
2. Call /api/generate-images → Get base64 previews
3. User reviews images
4. Call /api/generate-and-publish → Creates ad with same prompt
```

**Why this works:** The API uses the same prompt enhancement logic, so final images will match previews.

### Workflow 2: One-Click Publish

**Best for:** Automated workflows or users who trust the AI

```
1. User enters prompt + ad details
2. Call /api/generate-and-publish → Everything happens in one call
```

### Workflow 3: Upload Your Own Images

**Best for:** Users with existing brand assets

```
1. Call /api/upload-images → Get S3 URLs
2. Call /api/publish-ad with those URLs
```

---

## Request/Response Examples

### Example 1: Generate Images with Reference

```javascript
// HTML file input
<input type="file" id="refImage" accept="image/*">

// JavaScript
const formData = new FormData();
formData.append('prompt', 'Luxury product photography');
formData.append('businessName', 'Luxury Brand');
formData.append('longHeadline', 'Premium Quality Guaranteed');
formData.append('headlines', 'Free Shipping\nBest Price');
formData.append('referenceImage', document.getElementById('refImage').files[0]);

const response = await fetch('/api/generate-images', {
  method: 'POST',
  body: formData
});

const result = await response.json();

if (result.success) {
  // Display landscape image
  const landscapeImg = document.getElementById('preview-landscape');
  landscapeImg.src = `data:${result.images.landscape.mimeType};base64,${result.images.landscape.data}`;

  // Display square image
  const squareImg = document.getElementById('preview-square');
  squareImg.src = `data:${result.images.square.mimeType};base64,${result.images.square.data}`;

  // Show enhanced prompts
  console.log('Landscape prompt:', result.prompts.landscape);
  console.log('Square prompt:', result.prompts.square);
}
```

### Example 2: Complete Publishing Flow

```javascript
async function publishAd() {
  try {
    // Step 1: Show loading state
    showLoading('Generating images...');

    // Step 2: Generate and publish
    const response = await fetch('/api/generate-and-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: document.getElementById('prompt').value,
        businessName: document.getElementById('businessName').value,
        longHeadline: document.getElementById('longHeadline').value,
        headlines: document.getElementById('headlines').value.split('\n').filter(h => h.trim()),
        descriptions: document.getElementById('descriptions').value.split('\n').filter(d => d.trim()),
        finalUrl: document.getElementById('finalUrl').value,
        callToAction: document.getElementById('cta').value
      })
    });

    const result = await response.json();

    if (result.success) {
      // Step 3: Show success with details
      showSuccess(`
        ✅ Ad Published!
        Resource: ${result.resourceName}

        Generated Images:
        - Landscape: ${result.generatedImages.landscape[0]}
        - Square: ${result.generatedImages.square[0]}
      `);
    } else {
      showError(result.error);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}
```

---

## Error Handling

### Common Errors

| Status Code | Error | Solution |
|-------------|-------|----------|
| 400 | `Prompt is required` | Provide `prompt` field |
| 400 | `Business name is required` | Provide `businessName` field |
| 400 | `At least one headline is required` | Provide `headlines` array with ≥1 item |
| 400 | Headline too long (>30 chars) | Shorten headlines to ≤30 characters |
| 400 | Description too long (>90 chars) | Shorten descriptions to ≤90 characters |
| 500 | API key missing | Check `.env.local` configuration |
| 500 | Replicate API error | Check API quota/status |

### Error Response Format

```json
{
  "success": false,
  "error": "Prompt is required"
}
```

### Validation Rules

**Business Name:**
- Required
- Max 25 characters

**Long Headline:**
- Required
- Max 90 characters

**Headlines:**
- At least 1 required
- Max 5 recommended
- Each max 30 characters

**Descriptions:**
- At least 1 required
- Max 5 recommended
- Each max 90 characters

**Final URL:**
- Required
- Must be valid URL format

### Client-Side Validation Example

```javascript
function validateAdData(data) {
  const errors = [];

  // Business name
  if (!data.businessName) {
    errors.push('Business name is required');
  } else if (data.businessName.length > 25) {
    errors.push('Business name must be ≤25 characters');
  }

  // Headlines
  if (!data.headlines || data.headlines.length === 0) {
    errors.push('At least one headline is required');
  } else {
    const longHeadlines = data.headlines.filter(h => h.length > 30);
    if (longHeadlines.length > 0) {
      errors.push(`${longHeadlines.length} headline(s) exceed 30 characters`);
    }
  }

  // Descriptions
  const longDescriptions = data.descriptions.filter(d => d.length > 90);
  if (longDescriptions.length > 0) {
    errors.push(`${longDescriptions.length} description(s) exceed 90 characters`);
  }

  // Long headline
  if (!data.longHeadline) {
    errors.push('Long headline is required');
  } else if (data.longHeadline.length > 90) {
    errors.push('Long headline must be ≤90 characters');
  }

  return errors;
}
```

---

## Best Practices

### 1. Show Real-Time Character Counts

```javascript
// Add character counter to input
const businessNameInput = document.getElementById('businessName');
const counter = document.getElementById('businessNameCount');

businessNameInput.addEventListener('input', (e) => {
  const length = e.target.value.length;
  counter.textContent = `${length}/25`;
  counter.classList.toggle('warning', length > 20);
  counter.classList.toggle('error', length > 25);
});
```

### 2. Provide Loading Feedback

```javascript
// Show spinner during image generation
button.innerHTML = '<div class="spinner"></div> Generating...';
button.disabled = true;

// API call...

button.innerHTML = 'Generate Images';
button.disabled = false;
```

### 3. Cache Generated Images

```javascript
// Store generated images in state
let generatedImages = null;

async function generateImages() {
  const result = await fetch('/api/generate-images', {...});
  generatedImages = result.images; // Cache for later use
}

async function publishAd() {
  if (!generatedImages) {
    alert('Please generate images first');
    return;
  }
  // Use cached images...
}
```

### 4. Handle Reference Images Properly

```javascript
// Preview reference image before upload
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be less than 10MB');
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview').src = e.target.result;
  };
  reader.readAsDataURL(file);
}
```

### 5. Display Enhanced Prompts

```javascript
// Show users how their prompt was enhanced
if (result.prompts) {
  console.log('Original:', result.prompts.user);
  console.log('Enhanced (landscape):', result.prompts.landscape);
  console.log('Enhanced (square):', result.prompts.square);

  // Display in UI
  document.getElementById('promptComparison').innerHTML = `
    <div>
      <strong>Your Prompt:</strong>
      <p>${result.prompts.user}</p>
    </div>
    <div>
      <strong>AI-Enhanced (Landscape):</strong>
      <p>${result.prompts.landscape}</p>
    </div>
  `;
}
```

### 6. Handle Mode Indicators

The API returns a `mode` field to indicate if you're in MOCK or REAL mode:

```javascript
if (result.mode === 'MOCK') {
  showWarning('⚠️ Running in MOCK mode - no real API calls made');
} else {
  showSuccess('✅ Real images generated with Replicate API');
}
```

---

## Code Examples

### Complete React Component Example

```jsx
import React, { useState } from 'react';

function AIImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [longHeadline, setLongHeadline] = useState('');
  const [headlines, setHeadlines] = useState('');
  const [descriptions, setDescriptions] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let requestBody;
      let headers = {};

      const adContext = {
        prompt,
        businessName,
        longHeadline,
        headlines: headlines.split('\n').filter(h => h.trim()),
        descriptions: descriptions.split('\n').filter(d => d.trim()),
      };

      if (referenceImage) {
        // With reference image
        const formData = new FormData();
        formData.append('prompt', adContext.prompt);
        formData.append('businessName', adContext.businessName);
        formData.append('longHeadline', adContext.longHeadline);
        formData.append('headlines', adContext.headlines.join('\n'));
        formData.append('descriptions', adContext.descriptions.join('\n'));
        formData.append('referenceImage', referenceImage);
        requestBody = formData;
      } else {
        // Without reference image
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(adContext);
      }

      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers,
        body: requestBody,
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedImages(result.images);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>AI Image Generator</h2>

      <input
        type="text"
        placeholder="Image prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <input
        type="text"
        placeholder="Business Name (max 25 chars)"
        value={businessName}
        maxLength={25}
        onChange={(e) => setBusinessName(e.target.value)}
      />

      <input
        type="text"
        placeholder="Long Headline (max 90 chars)"
        value={longHeadline}
        maxLength={90}
        onChange={(e) => setLongHeadline(e.target.value)}
      />

      <textarea
        placeholder="Headlines (one per line, max 30 chars each)"
        value={headlines}
        onChange={(e) => setHeadlines(e.target.value)}
      />

      <textarea
        placeholder="Descriptions (one per line, max 90 chars each)"
        value={descriptions}
        onChange={(e) => setDescriptions(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setReferenceImage(e.target.files[0])}
      />

      <button onClick={handleGenerate} disabled={loading || !prompt}>
        {loading ? 'Generating...' : 'Generate Images'}
      </button>

      {generatedImages && (
        <div>
          <h3>Generated Images</h3>
          <div>
            <h4>Landscape (1200x628)</h4>
            <img
              src={`data:${generatedImages.landscape.mimeType};base64,${generatedImages.landscape.data}`}
              alt="Landscape"
              style={{ width: '100%', maxWidth: '600px' }}
            />
          </div>
          <div>
            <h4>Square (1200x1200)</h4>
            <img
              src={`data:${generatedImages.square.mimeType};base64,${generatedImages.square.data}`}
              alt="Square"
              style={{ width: '100%', maxWidth: '400px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AIImageGenerator;
```

### Vanilla JavaScript Form Submission

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI RDA Publisher</title>
</head>
<body>
  <form id="adForm">
    <input type="text" id="prompt" placeholder="Image prompt" required>
    <input type="text" id="businessName" placeholder="Business Name" maxlength="25" required>
    <input type="text" id="longHeadline" placeholder="Long Headline" maxlength="90" required>
    <textarea id="headlines" placeholder="Headlines (one per line)" required></textarea>
    <textarea id="descriptions" placeholder="Descriptions (one per line)" required></textarea>
    <input type="url" id="finalUrl" placeholder="https://example.com" required>
    <button type="submit">Publish Ad</button>
  </form>

  <div id="result"></div>

  <script>
    document.getElementById('adForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        prompt: document.getElementById('prompt').value,
        businessName: document.getElementById('businessName').value,
        longHeadline: document.getElementById('longHeadline').value,
        headlines: document.getElementById('headlines').value.split('\n').filter(h => h.trim()),
        descriptions: document.getElementById('descriptions').value.split('\n').filter(d => d.trim()),
        finalUrl: document.getElementById('finalUrl').value,
      };

      try {
        const response = await fetch('/api/generate-and-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          document.getElementById('result').innerHTML = `
            <h3>✅ Success!</h3>
            <p>Ad Resource: ${result.resourceName}</p>
            <p>Landscape Image: ${result.generatedImages.landscape[0]}</p>
            <p>Square Image: ${result.generatedImages.square[0]}</p>
          `;
        } else {
          document.getElementById('result').innerHTML = `
            <h3>❌ Error</h3>
            <p>${result.error}</p>
          `;
        }
      } catch (error) {
        document.getElementById('result').innerHTML = `
          <h3>❌ Error</h3>
          <p>${error.message}</p>
        `;
      }
    });
  </script>
</body>
</html>
```

---

## Environment Variables

The following environment variables control API behavior (set in `.env.local`):

```bash
# Mock Mode (for testing without API calls)
MOCK_MODE=false  # Set to 'true' for testing

# Replicate API
REPLICATE_API_TOKEN=your_token_here

# OpenAI API (for prompt enhancement)
OPENAI_API_KEY=your_key_here

# AWS S3
AWS_S3_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Google Ads
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
GOOGLE_ADS_AD_GROUP_ID=98765432
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
```

---

## Testing Tips

### 1. Use Mock Mode for Development

Set `MOCK_MODE=true` in `.env.local` to get placeholder images without API calls.

### 2. Test Character Limits

```javascript
// Test headlines
const testHeadlines = [
  'Short',
  'This is exactly 30 characters!',
  'This headline is way too long and will fail' // Should fail
];
```

### 3. Test Reference Image Upload

```javascript
// Test with different image formats
const testFiles = [
  new File([''], 'test.jpg', { type: 'image/jpeg' }),
  new File([''], 'test.png', { type: 'image/png' }),
  new File([''], 'test.webp', { type: 'image/webp' }),
];
```

---

## Support

For issues or questions:
- Check server logs at `http://localhost:3001`
- Review `INTEGRATION.md` for backend details
- Test endpoints with `/api/health` first

---

## Changelog

**v1.0** (2025-11-12)
- Initial release
- AI image generation with Replicate
- OpenAI prompt enhancement
- Reference image support
- Full RDA publishing workflow
