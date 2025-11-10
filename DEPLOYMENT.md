# RDA Image Generator - Deployment Guide

## Overview

The `deploy.sh` script automates the complete deployment process for the RDA Image Generation API, including Lambda functions, infrastructure setup, and post-deployment verification.

## Prerequisites

Before running the deployment script, ensure you have the following installed and configured:

### Required Tools
- **AWS CLI** - For interacting with AWS services
- **SAM CLI** - For building and deploying serverless applications
- **Node.js 18+** - For running Lambda functions
- **Docker** - For SAM container builds
- **jq** - For JSON parsing (usually pre-installed on most systems)

### AWS Configuration
```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### Install Tools (macOS)
```bash
# Install AWS CLI
brew install awscli

# Install SAM CLI
brew install aws-sam-cli

# Install Node.js
brew install node@18

# Install Docker Desktop
brew install --cask docker
```

## Usage

### Basic Syntax
```bash
./deploy.sh <environment> <mock_mode>
```

### Parameters
- **environment**: Target environment (`dev`, `staging`, or `prod`)
- **mock_mode**: Enable mock mode (`true` or `false`)

### Examples

#### Development Deployment with Mock Mode
```bash
./deploy.sh dev true
```
- Deploys to development environment
- Enables mock image generation (no real API calls)
- Zero cost for testing

#### Production Deployment with Real Mode
```bash
./deploy.sh prod false
```
- Deploys to production environment
- Uses real Replicate API for image generation
- Standard API costs apply

#### Staging Environment
```bash
./deploy.sh staging false
```
- Deploys to staging environment
- Uses real API for realistic testing
- Separate from production resources

## Deployment Process

The script follows a comprehensive 5-phase deployment process:

### Phase 1: Validation
- ✅ Validates input parameters
- ✅ Checks for required tools (AWS CLI, SAM CLI, Node.js, Docker)
- ✅ Verifies AWS credentials and permissions
- ✅ Confirms SAM template exists

### Phase 2: Build Lambda Functions
- 📦 Installs production dependencies in each Lambda directory
- 🧹 Removes development dependencies (`npm prune`)
- ✅ Validates required files (`package.json`, `index.js`)

### Phase 3: Build SAM Template
- 🐳 Builds using SAM with container support
- 📋 Ensures consistent builds across environments
- 🏗️ Prepares deployment artifacts

### Phase 4: Deploy CloudFormation Stack
- ☁️ Deploys infrastructure using SAM
- 📝 Passes environment and mock mode parameters
- 🔧 Configures all AWS resources

### Phase 5: Post-Deployment Verification
- 🔍 Verifies Lambda functions are deployed
- 🗄️ Confirms DynamoDB table exists
- 🪣 Checks S3 bucket creation
- 📬 Validates SQS queue setup
- 📊 Extracts and displays deployment information

## Output

Upon successful deployment, you'll see a comprehensive summary:

```
=========================================
RDA IMAGE GENERATOR DEPLOYMENT COMPLETE
=========================================

✅ Environment: dev
✅ Mock Mode: true
✅ Stack Name: rda-image-generator-dev

🌐 API Gateway URL:
   https://abc123.execute-api.us-east-1.amazonaws.com/dev

⚡ Lambda Functions:
   • rda-image-generator-dev-SchedulerFunction-XYZ
   • rda-image-generator-dev-WorkerFunction-ABC

🗄️  DynamoDB Table:
   RDAImageJobs-dev

🪣 S3 Bucket:
   rda-generated-images-dev

📬 SQS Queue:
   rda-image-processing-queue-dev

🚀 Deployment completed successfully!
```

## Troubleshooting

### Common Issues

#### AWS CLI Not Configured
```
[ERROR] AWS credentials not configured. Please run 'aws configure'.
```
**Solution**: Run `aws configure` and provide your AWS access key and secret.

#### Docker Not Running
```
[ERROR] Docker is not running. Please start Docker.
```
**Solution**: Start Docker Desktop application.

#### SAM CLI Missing
```
[ERROR] SAM CLI not found. Please install SAM CLI.
```
**Solution**: Install SAM CLI using `brew install aws-sam-cli`.

#### Permission Denied
```
[ERROR] An error occurred (AccessDenied) when calling...
```
**Solution**: Ensure your AWS user has appropriate IAM permissions for CloudFormation, Lambda, S3, DynamoDB, and SQS.

#### Stack Already Exists
If a stack with the same name exists and deployment fails, you can:
1. Delete the existing stack: `aws cloudformation delete-stack --stack-name rda-image-generator-dev`
2. Wait for deletion to complete, then re-run deployment

### Logs and Debugging

- **Deployment Log**: Each deployment creates a timestamped log file (e.g., `deployment_20231110_091942.log`)
- **SAM Logs**: Use `sam logs` to view Lambda function logs
- **CloudFormation Events**: Check AWS Console → CloudFormation → Stack Events for detailed deployment progress

## Environment-Specific Configuration

### Development (`dev`)
- Typically uses mock mode for cost-free testing
- Reduced resource provisioning
- Enhanced logging for debugging

### Staging (`staging`)
- Mirror of production configuration
- Real API calls for realistic testing
- Full validation pipeline

### Production (`prod`)
- Optimized for performance and cost
- Real API integrations
- Comprehensive monitoring and alerting

## Security Considerations

- **API Keys**: Stored in AWS Secrets Manager
- **IAM Roles**: Minimal required permissions
- **VPC**: Optional VPC deployment for enhanced security
- **Encryption**: S3 buckets and DynamoDB encrypted at rest

## Cost Optimization

### Mock Mode Benefits
- Zero API costs during development
- Fast iteration cycles
- No external API dependencies

### Production Monitoring
- CloudWatch cost alerts
- DynamoDB on-demand pricing
- S3 lifecycle policies for cost management

## Next Steps After Deployment

1. **Test API Endpoints**: Use the provided API Gateway URL
2. **Monitor Logs**: Check CloudWatch logs for Lambda functions
3. **Validate Functionality**: Run integration tests
4. **Configure Monitoring**: Set up CloudWatch alarms
5. **Update DNS**: Point custom domain to API Gateway (if applicable)

## Support

For deployment issues or questions:
1. Check the deployment log file for detailed error information
2. Review AWS CloudFormation events in the AWS Console
3. Verify all prerequisites are properly installed and configured