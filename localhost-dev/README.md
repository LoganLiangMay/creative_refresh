# RDA Publisher - Localhost Development

Localhost development server for testing Google Ads Responsive Display Ad (RDA) publishing with AWS S3 integration.

## Overview

This development environment allows you to:

1. **Upload images to AWS S3** - Automatically creates both landscape (1200x628) and square (1200x1200) versions
2. **Create Responsive Display Ads** - Publishes RDAs to Google Ads using the official API
3. **Test the full flow** - End-to-end testing of the image upload → ad creation pipeline

## Architecture

```
┌─────────────┐
│   Browser   │
│     UI      │
└──────┬──────┘
       │
       ▼
┌─────────────┐       ┌──────────┐       ┌─────────────┐
│   Express   │──────▶│ AWS S3   │       │ Google Ads  │
│   Server    │       │ (Images) │       │     API     │
│  localhost  │       └──────────┘       │   (RDAs)    │
│   :3001     │                           └─────────────┘
└─────────────┘
```

## Prerequisites

1. **Node.js** - v20.x or later
2. **AWS Account** - With S3 bucket configured
3. **Google Ads Account** - With API access enabled
4. **Environment Variables** - Configure in `../.env.local`

## Setup

### 1. Configure Environment Variables

Update `../.env.local` with the following:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token

# Required: Your Google Ads account details
GOOGLE_ADS_CUSTOMER_ID=1234567890  # No dashes
GOOGLE_ADS_CAMPAIGN_ID=123456789
GOOGLE_ADS_AD_GROUP_ID=987654321

# Server Port
LOCAL_SERVER_PORT=3001
```

### 2. Get Google Ads Customer ID

Run this command to list your accessible customers:

```bash
curl http://localhost:3001/api/customers
```

### 3. Create Campaign & Ad Group

You need an active campaign and ad group in Google Ads. Get their IDs from:
- Google Ads UI → Campaign → Settings → Copy Campaign ID
- Google Ads UI → Ad Group → Settings → Copy Ad Group ID

## Running the Server

### Start the development server:

```bash
cd localhost-dev
npm start
```

### Or with auto-reload:

```bash
npm run dev
```

The server will start at: **http://localhost:3001**

## Using the UI

1. **Open your browser** to http://localhost:3001

2. **Upload Images**
   - Drag & drop 1-10 images
   - Images will automatically be resized to:
     - Landscape: 1200x628 (for marketing_images)
     - Square: 1200x1200 (for square_marketing_images)

3. **Fill Ad Text**
   - **Business Name** (≤25 chars) - Your company name
   - **Long Headline** (≤90 chars) - Main headline
   - **Headlines** (≤30 chars each, max 5) - Short attention-grabbing text
   - **Descriptions** (≤90 chars each, max 5) - Supporting text
   - **Final URL** - Landing page for your ad
   - **Call to Action** - Button text (optional)

4. **Publish**
   - Click "Publish Responsive Display Ad"
   - Images are uploaded to S3
   - Ad is created in Google Ads (starts as PAUSED for review)

5. **Review Results**
   - See the created ad resource name
   - View asset URLs
   - Check ad details

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "RDA Publisher API is running",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "config": {
    "s3Bucket": "rda-images-dev-...",
    "googleAdsCustomerId": "1234567890",
    "googleAdsAdGroupId": "987654321"
  }
}
```

### GET /api/customers
List accessible Google Ads customers.

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

### POST /api/upload-images
Upload images to S3 (creates landscape + square versions).

**Request:**
```
Content-Type: multipart/form-data

images: [File, File, ...]
```

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 2 images (2 landscape + 2 square)",
  "images": {
    "landscape": [
      {
        "url": "https://bucket.s3.amazonaws.com/rda-ads/...",
        "dimensions": { "width": 1200, "height": 628 }
      }
    ],
    "square": [
      {
        "url": "https://bucket.s3.amazonaws.com/rda-ads/...",
        "dimensions": { "width": 1200, "height": 1200 }
      }
    ]
  }
}
```

### POST /api/publish-ad
Create Responsive Display Ad with pre-uploaded S3 URLs.

**Request Body:**
```json
{
  "landscapeImageUrls": ["https://..."],
  "squareImageUrls": ["https://..."],
  "headlines": ["Headline 1", "Headline 2"],
  "longHeadline": "Your Long Headline Here",
  "descriptions": ["Description 1", "Description 2"],
  "businessName": "Your Company",
  "finalUrl": "https://www.example.com",
  "callToAction": "Learn More",
  "mainColor": "#0000ff",
  "accentColor": "#ffff00"
}
```

### POST /api/publish-ad-full-flow
Upload images AND create ad in one request (recommended).

**Request:**
```
Content-Type: multipart/form-data

images: [File, File, ...]
adData: {
  "headlines": [...],
  "longHeadline": "...",
  "descriptions": [...],
  "businessName": "...",
  "finalUrl": "...",
  "callToAction": "..."
}
```

## Required RDA Fields (MVP)

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `marketing_images` | Array | ✅ Yes (≥1) | - | Landscape images (600x314 min) |
| `square_marketing_images` | Array | ✅ Yes (≥1) | - | Square images (300x300 min) |
| `headlines` | Array | ✅ Yes (≥1, ≤5) | 30 chars each | Short headlines |
| `long_headline` | String | ✅ Yes | 90 chars | Expanded headline |
| `descriptions` | Array | ✅ Yes (≥1, ≤5) | 90 chars each | Supporting text |
| `business_name` | String | ✅ Yes | 25 chars | Brand/company name |
| `final_urls` | Array | ✅ Yes | - | Landing page URL(s) |

## Troubleshooting

### "GOOGLE_ADS_CUSTOMER_ID not configured"

Make sure you've set `GOOGLE_ADS_CUSTOMER_ID` in `../.env.local` without dashes.

Example: `1234567890` (not `123-456-7890`)

### "Failed to upload image asset"

- Check that S3 URLs are publicly accessible
- Verify image dimensions meet Google Ads requirements:
  - Landscape: min 600x314
  - Square: min 300x300
- Ensure images are in supported formats (JPG, PNG)

### "Ad Group not found"

- Verify `GOOGLE_ADS_AD_GROUP_ID` is correct
- Make sure the ad group exists and is active
- Check that it belongs to a Display campaign

### "Invalid credentials"

- Verify all Google Ads API credentials in `.env.local`
- Ensure refresh token is still valid
- Check developer token is approved (not test account)

### Images not appearing in S3

- Check AWS credentials are correct
- Verify S3 bucket exists and is accessible
- Check bucket permissions allow uploads
- View S3 bucket in AWS Console to confirm uploads

## File Structure

```
localhost-dev/
├── lib/
│   ├── s3Upload.js           # S3 upload utilities
│   └── googleAdsClient.js    # Google Ads API integration
├── public/
│   └── index.html            # Frontend UI
├── server.js                 # Express server
├── package.json              # Dependencies
└── README.md                 # This file
```

## Next Steps

### Testing

1. Upload a few test images
2. Fill in ad text with test content
3. Publish the ad (starts as PAUSED)
4. Review the ad in Google Ads UI
5. Activate the ad when ready

### Integration

Once tested, integrate with your production workflow:

1. Replace the simple UI with your actual frontend
2. Add authentication/authorization
3. Implement ad approval workflow
4. Add ad performance tracking
5. Enable batch ad creation

### Production Considerations

- Add rate limiting to API endpoints
- Implement proper error handling and logging
- Set up monitoring and alerts
- Add database for ad tracking
- Implement webhook for ad status updates
- Add ad preview functionality
- Enable A/B testing capabilities

## Support

For Google Ads API documentation:
- [Responsive Display Ads Guide](https://developers.google.com/google-ads/api/docs/responsive-display-ads)
- [ResponsiveDisplayAdInfo Reference](https://developers.google.com/google-ads/api/reference/rpc/v22/ResponsiveDisplayAdInfo)
- [google-ads-api npm package](https://www.npmjs.com/package/google-ads-api)

## License

ISC
