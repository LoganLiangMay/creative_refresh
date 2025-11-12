# RDA Image Generator - Viewer

A web-based viewer to browse and inspect generated images and metadata stored in S3 and DynamoDB.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Browser   │─────▶│ S3 Static    │─────▶│ API Gateway  │
│   (User)    │      │ Website      │      │              │
└─────────────┘      └──────────────┘      └──────┬───────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │   Viewer     │
                                            │   Lambda     │
                                            └──────┬───────┘
                                                    │
                          ┌─────────────────────────┼─────────────────┐
                          ▼                         ▼                 ▼
                    ┌──────────┐            ┌──────────┐      ┌──────────┐
                    │ DynamoDB │            │    S3    │      │ Signed   │
                    │ (Metadata)│            │ (Images) │      │   URLs   │
                    └──────────┘            └──────────┘      └──────────┘
```

## Features

✅ **Real-time Job Viewing**
- View all generated image jobs from DynamoDB
- Filter by status (completed, processing, failed)
- Search by job ID, prompt, or customer ID

✅ **Image Display**
- Generated images loaded from S3 via signed URLs
- Modal view for detailed inspection
- Download full-resolution images

✅ **Metadata Display**
- Job details (ID, status, timestamps)
- Generation metrics (duration, cost)
- Prompt information (original + enhanced)
- Progress tracking

✅ **Responsive Design**
- Works on desktop and mobile
- Clean, modern interface
- Real-time statistics

## Deployment

### Prerequisites

1. **AWS CLI** - Configured with credentials
2. **SAM CLI** - For serverless deployment
3. **Active AWS Account** - With appropriate permissions

### Deploy to AWS

```bash
# Deploy to dev environment (default)
./deploy-viewer.sh

# Deploy to staging
./deploy-viewer.sh staging

# Deploy to production
./deploy-viewer.sh prod
```

### What the deployment does:

1. **Builds and deploys CloudFormation stack**
   - Viewer Lambda function
   - API Gateway REST API
   - S3 bucket for static website

2. **Retrieves API endpoint**
   - Gets API Gateway URL from stack outputs

3. **Updates viewer configuration**
   - Injects API endpoint into app.js

4. **Uploads static files**
   - Syncs HTML/JS/CSS to S3 bucket
   - Sets appropriate cache headers

5. **Provides access URLs**
   - Website URL for viewing
   - API URL for testing

## Local Development

For local testing, you can use a simple HTTP server:

```bash
cd viewer/public

# Manually update app.js with your API endpoint
sed -i '' "s|API_GATEWAY_URL_PLACEHOLDER|YOUR_API_URL|g" app.js

# Start local server
python3 -m http.server 8000

# Open browser
open http://localhost:8000
```

## API Endpoints

The viewer uses the following API endpoints:

### List Jobs
```
GET /jobs?limit=50&status=completed
```

Returns a list of jobs with their metadata and preview images.

**Query Parameters:**
- `limit` (optional): Maximum number of jobs to return (default: 50)
- `status` (optional): Filter by status (completed, processing, failed)

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "job_abc123",
      "customer_id": "customer-456",
      "prompt": "Professional advertisement...",
      "status": "completed",
      "aspect_ratio": "1.91:1",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:30:05Z",
      "duration_ms": 5000,
      "image_count": 1,
      "output_url": "https://s3.amazonaws.com/...",
      "s3_key": "customer-456/job_abc123/img_xyz_v1.jpg"
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### Get Job Details
```
GET /jobs/{jobId}
```

Returns detailed information about a specific job including all images.

**Response:**
```json
{
  "job": {
    "job_id": "job_abc123",
    "customer_id": "customer-456",
    "prompt": "Professional advertisement...",
    "status": "completed",
    "aspect_ratio": "1.91:1",
    "created_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:30:05Z",
    "progress": {
      "total": 1,
      "completed": 1,
      "processing": 0,
      "failed": 0
    }
  },
  "images": [
    {
      "image_id": "img_xyz",
      "image_index": 0,
      "status": "completed",
      "s3_url": "https://...",
      "s3_key": "customer-456/job_abc123/img_xyz_v1.jpg",
      "aspect_ratio": "1.91:1",
      "dimensions": "1200x628",
      "cost": 0.003,
      "generation_time": 4500,
      "processing_time": 5000,
      "mock_mode": false,
      "generated_at": "2024-01-15T10:30:05Z",
      "prompt_metadata": {
        "original_prompt": "Professional advertisement...",
        "enhanced_prompt": "Highly detailed professional...",
        "was_enhanced": true
      }
    }
  ],
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### Health Check
```
GET /health
```

Returns API health status.

## Security Considerations

### S3 Signed URLs
- Images are accessed via **signed URLs** generated by the Viewer Lambda
- URLs expire after **1 hour** for security
- Direct S3 bucket access is **not** public

### Static Website
- Viewer website is **publicly accessible** (read-only)
- No authentication required for viewing
- Suitable for internal tools or add authentication layer if needed

### API Gateway
- **CORS enabled** for browser access
- Rate limiting via AWS default throttling
- Consider adding API keys for production use

## Data Storage

### Images: S3
- **Bucket:** `rda-images-{environment}-{account-id}`
- **Path Structure:** `{customer_id}/{job_id}/{image_id}_v1.jpg`
- **Retention:** 30 days (configurable in template.yaml)
- **Access:** Via signed URLs only

### Metadata: DynamoDB
- **Table:** `RDAImageJobs-{environment}`
- **Structure:** Single-table design with PK/SK
- **Items:**
  - Job metadata: `PK=job_id, SK=JOB#metadata`
  - Images: `PK=job_id, SK=IMAGE#001, IMAGE#002, etc.`

### Local Testing
- **Images:** `tests/local/output/s3/{bucket}/{key}`
- **Metadata:** `tests/local/output/dynamodb/{table}.json`
- Same structure as AWS for consistency

## Troubleshooting

### Viewer shows "No jobs found"
1. Check if jobs exist in DynamoDB
2. Verify API Gateway URL in app.js
3. Check browser console for errors
4. Test API directly: `curl {API_URL}/jobs`

### Images not loading
1. Verify S3 bucket has the images
2. Check Lambda has S3 GetObject permissions
3. Ensure signed URLs are being generated
4. Check CORS configuration

### API errors
1. Check CloudWatch Logs for Viewer Lambda
2. Verify DynamoDB table name in environment variables
3. Test Lambda permissions (DynamoDB read, S3 GetObject)
4. Check API Gateway deployment stage

### Deployment fails
1. Verify AWS credentials are configured
2. Check SAM CLI is installed
3. Ensure no resource name conflicts
4. Review CloudFormation events for errors

## Cost Estimation

### AWS Services Used:
- **S3 (Static Website):** ~$0.01/month (minimal traffic)
- **S3 (Image Storage):** ~$0.023/GB/month
- **API Gateway:** $3.50 per million requests + $0.09/GB data transfer
- **Lambda (Viewer):** Free tier covers most usage
- **DynamoDB:** Free tier (25 GB, 200M requests/month)

**Estimated monthly cost for dev/staging:** < $5/month

## Next Steps

### Enhancements:
- [ ] Add authentication (Cognito or API keys)
- [ ] Implement pagination for large datasets
- [ ] Add real-time updates (WebSocket or polling)
- [ ] Export functionality (CSV, JSON)
- [ ] Bulk operations (delete, re-generate)
- [ ] Image comparison view
- [ ] Cost analytics dashboard

### Production Considerations:
- Add CloudFront for CDN
- Implement proper authentication
- Add rate limiting
- Set up monitoring/alarms
- Enable access logging
- Configure backup strategy
