#!/bin/bash

##############################################################################
# RDA Image Generation API - Deployment Script
#
# This script automates the complete deployment process for the RDA Image
# Generation API, including Lambda functions, infrastructure, and verification.
#
# Usage:
#   ./deploy.sh <environment> <mock_mode>
#   ./deploy.sh dev true      # Deploy dev environment with mock mode
#   ./deploy.sh staging false # Deploy staging environment with real mode
#   ./deploy.sh prod false    # Deploy production environment with real mode
#
# Requirements:
#   - AWS CLI configured with appropriate permissions
#   - SAM CLI installed
#   - Node.js 18+ installed
#   - Docker installed (for SAM build)
##############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployment_${TIMESTAMP}.log"

# Deployment variables (will be set from parameters)
ENVIRONMENT=""
MOCK_MODE=""
STACK_NAME=""

# AWS Resource names (will be populated during deployment)
API_GATEWAY_URL=""
LAMBDA_FUNCTIONS=()
DYNAMODB_TABLE=""
S3_BUCKET=""
SQS_QUEUE=""

##############################################################################
# Utility Functions
##############################################################################

log() {
    echo "$(date '+%H:%M:%S') - $*" | tee -a "$DEPLOYMENT_LOG"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_header() {
    echo -e "${BOLD}$*${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# Error handler
error_exit() {
    local exit_code=$?
    log_error "Deployment failed at line $1"
    log_error "Check deployment log: $DEPLOYMENT_LOG"
    exit $exit_code
}

trap 'error_exit $LINENO' ERR

##############################################################################
# Validation Functions
##############################################################################

validate_parameters() {
    log_info "Validating deployment parameters..."

    if [[ $# -ne 2 ]]; then
        log_error "Usage: $0 <environment> <mock_mode>"
        log_error "  environment: dev, staging, or prod"
        log_error "  mock_mode: true or false"
        log_error ""
        log_error "Examples:"
        log_error "  $0 dev true      # Deploy dev with mock mode"
        log_error "  $0 prod false    # Deploy prod with real mode"
        exit 1
    fi

    ENVIRONMENT="$1"
    MOCK_MODE="$2"

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT"
        log_error "Must be one of: dev, staging, prod"
        exit 1
    fi

    # Validate mock mode
    if [[ ! "$MOCK_MODE" =~ ^(true|false)$ ]]; then
        log_error "Invalid mock_mode: $MOCK_MODE"
        log_error "Must be: true or false"
        exit 1
    fi

    STACK_NAME="rda-image-generator-${ENVIRONMENT}"

    log_success "Parameters validated:"
    log_success "  Environment: $ENVIRONMENT"
    log_success "  Mock Mode: $MOCK_MODE"
    log_success "  Stack Name: $STACK_NAME"
}

validate_prerequisites() {
    log_info "Validating prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi

    # Check SAM CLI
    if ! command -v sam &> /dev/null; then
        log_error "SAM CLI not found. Please install SAM CLI."
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    # Verify Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure'."
        exit 1
    fi

    # Check if template.yaml exists
    if [[ ! -f "$PROJECT_ROOT/template.yaml" ]]; then
        log_error "SAM template.yaml not found in project root."
        exit 1
    fi

    log_success "All prerequisites validated"
}

##############################################################################
# Build Functions
##############################################################################

build_lambda_functions() {
    log_header "Building Lambda Functions"

    local lambda_dirs=(
        "lambdas/scheduler"
        "lambdas/worker"
    )

    for lambda_dir in "${lambda_dirs[@]}"; do
        local full_path="$PROJECT_ROOT/$lambda_dir"

        if [[ -d "$full_path" ]]; then
            log_info "Building Lambda function: $lambda_dir"

            # Change to Lambda directory
            cd "$full_path"

            # Install production dependencies
            log_info "  Installing production dependencies..."
            npm install --production --silent

            # Remove development dependencies
            log_info "  Pruning development dependencies..."
            npm prune --production --silent

            # Verify package.json exists
            if [[ ! -f "package.json" ]]; then
                log_error "package.json not found in $lambda_dir"
                exit 1
            fi

            # Verify index.js exists
            if [[ ! -f "index.js" ]]; then
                log_error "index.js not found in $lambda_dir"
                exit 1
            fi

            log_success "  Built $lambda_dir successfully"
        else
            log_warning "Lambda directory not found: $lambda_dir"
        fi
    done

    # Return to project root
    cd "$PROJECT_ROOT"

    log_success "All Lambda functions built successfully"
}

build_sam_template() {
    log_header "Building SAM Template"

    cd "$PROJECT_ROOT"

    log_info "Running SAM build with container support..."

    # Build with container for consistency across environments
    if sam build --use-container --parallel; then
        log_success "SAM template built successfully"
    else
        log_error "SAM build failed"
        exit 1
    fi
}

##############################################################################
# Deployment Functions
##############################################################################

deploy_stack() {
    log_header "Deploying CloudFormation Stack"

    cd "$PROJECT_ROOT"

    log_info "Deploying stack: $STACK_NAME"
    log_info "Environment: $ENVIRONMENT"
    log_info "Mock Mode: $MOCK_MODE"

    # SAM deploy with parameters
    local deploy_params=(
        "--stack-name" "$STACK_NAME"
        "--capabilities" "CAPABILITY_IAM"
        "--parameter-overrides"
        "Environment=$ENVIRONMENT"
        "MockMode=$MOCK_MODE"
        "--region" "${AWS_DEFAULT_REGION:-us-east-1}"
        "--s3-prefix" "rda-sam-deployments"
        "--no-fail-on-empty-changeset"
        "--no-confirm-changeset"
    )

    if sam deploy "${deploy_params[@]}"; then
        log_success "Stack deployed successfully: $STACK_NAME"
    else
        log_error "Stack deployment failed"
        exit 1
    fi
}

##############################################################################
# Post-Deployment Verification
##############################################################################

extract_stack_outputs() {
    log_info "Extracting stack outputs..."

    # Get stack outputs
    local outputs
    if outputs=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs' \
        --output json 2>/dev/null); then

        # Extract specific outputs
        API_GATEWAY_URL=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="ApiGatewayUrl") | .OutputValue' 2>/dev/null || echo "")
        DYNAMODB_TABLE=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="DynamoDBTableName") | .OutputValue' 2>/dev/null || echo "")
        S3_BUCKET=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="S3BucketName") | .OutputValue' 2>/dev/null || echo "")
        SQS_QUEUE=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="SQSQueueName") | .OutputValue' 2>/dev/null || echo "")

        # Extract Lambda function names
        local scheduler_function=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="SchedulerFunctionName") | .OutputValue' 2>/dev/null || echo "")
        local worker_function=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="WorkerFunctionName") | .OutputValue' 2>/dev/null || echo "")

        if [[ -n "$scheduler_function" ]]; then
            LAMBDA_FUNCTIONS+=("$scheduler_function")
        fi

        if [[ -n "$worker_function" ]]; then
            LAMBDA_FUNCTIONS+=("$worker_function")
        fi

        log_success "Stack outputs extracted"
    else
        log_warning "Could not extract stack outputs - will attempt manual verification"
    fi
}

verify_lambda_functions() {
    log_info "Verifying Lambda functions..."

    local functions_found=0

    # If we have function names from outputs, check those
    if [[ ${#LAMBDA_FUNCTIONS[@]} -gt 0 ]]; then
        for func_name in "${LAMBDA_FUNCTIONS[@]}"; do
            if aws lambda get-function --function-name "$func_name" &>/dev/null; then
                log_success "  ✓ Lambda function exists: $func_name"
                functions_found=$((functions_found + 1))
            else
                log_error "  ✗ Lambda function not found: $func_name"
            fi
        done
    else
        # Fallback: try to find functions by naming pattern
        local expected_functions=(
            "${STACK_NAME}-SchedulerFunction-*"
            "${STACK_NAME}-WorkerFunction-*"
        )

        for pattern in "${expected_functions[@]}"; do
            local func_name
            if func_name=$(aws lambda list-functions --query "Functions[?starts_with(FunctionName, '$(echo "$pattern" | cut -d'-' -f1,2,3)')].FunctionName" --output text); then
                if [[ -n "$func_name" ]]; then
                    log_success "  ✓ Lambda function found: $func_name"
                    LAMBDA_FUNCTIONS+=("$func_name")
                    functions_found=$((functions_found + 1))
                fi
            fi
        done
    fi

    if [[ $functions_found -lt 2 ]]; then
        log_error "Expected at least 2 Lambda functions, found $functions_found"
        return 1
    fi

    log_success "All Lambda functions verified ($functions_found functions)"
}

verify_dynamodb_table() {
    log_info "Verifying DynamoDB table..."

    local table_name="$DYNAMODB_TABLE"

    # If table name not found in outputs, try standard naming pattern
    if [[ -z "$table_name" ]]; then
        table_name="RDAImageJobs-${ENVIRONMENT}"
    fi

    if aws dynamodb describe-table --table-name "$table_name" &>/dev/null; then
        log_success "  ✓ DynamoDB table exists: $table_name"
        DYNAMODB_TABLE="$table_name"
    else
        log_error "  ✗ DynamoDB table not found: $table_name"
        return 1
    fi
}

verify_s3_bucket() {
    log_info "Verifying S3 bucket..."

    local bucket_name="$S3_BUCKET"

    # If bucket name not found in outputs, try standard naming pattern
    if [[ -z "$bucket_name" ]]; then
        bucket_name="rda-generated-images-${ENVIRONMENT}"
    fi

    if aws s3 ls "s3://$bucket_name" &>/dev/null; then
        log_success "  ✓ S3 bucket exists: $bucket_name"
        S3_BUCKET="$bucket_name"
    else
        log_error "  ✗ S3 bucket not found: $bucket_name"
        return 1
    fi
}

verify_sqs_queue() {
    log_info "Verifying SQS queue..."

    local queue_name="$SQS_QUEUE"

    # If queue name not found in outputs, try to find it
    if [[ -z "$queue_name" ]]; then
        local queue_url
        if queue_url=$(aws sqs list-queues --queue-name-prefix "rda-image-" --query "QueueUrls[0]" --output text 2>/dev/null); then
            if [[ "$queue_url" != "None" && -n "$queue_url" ]]; then
                queue_name=$(basename "$queue_url")
            fi
        fi
    fi

    if [[ -n "$queue_name" ]]; then
        # Get queue URL to verify it exists
        local queue_url
        if queue_url=$(aws sqs get-queue-url --queue-name "$queue_name" --output text 2>/dev/null); then
            log_success "  ✓ SQS queue exists: $queue_name"
            SQS_QUEUE="$queue_name"
        else
            log_error "  ✗ SQS queue not accessible: $queue_name"
            return 1
        fi
    else
        log_warning "  ? SQS queue name not determined - may not be required"
    fi
}

post_deployment_verification() {
    log_header "Post-Deployment Verification"

    # Extract outputs first
    extract_stack_outputs

    # Verify all components
    local verification_results=()

    if verify_lambda_functions; then
        verification_results+=("Lambda Functions: ✓")
    else
        verification_results+=("Lambda Functions: ✗")
    fi

    if verify_dynamodb_table; then
        verification_results+=("DynamoDB Table: ✓")
    else
        verification_results+=("DynamoDB Table: ✗")
    fi

    if verify_s3_bucket; then
        verification_results+=("S3 Bucket: ✓")
    else
        verification_results+=("S3 Bucket: ✗")
    fi

    if verify_sqs_queue; then
        verification_results+=("SQS Queue: ✓")
    else
        verification_results+=("SQS Queue: ✓ (Optional)")
    fi

    # Check if any critical verifications failed
    local failed_verifications=0
    for result in "${verification_results[@]}"; do
        if [[ "$result" =~ ✗ ]]; then
            failed_verifications=$((failed_verifications + 1))
        fi
    done

    if [[ $failed_verifications -gt 0 ]]; then
        log_error "Post-deployment verification failed ($failed_verifications issues found)"
        return 1
    else
        log_success "All post-deployment verifications passed"
    fi
}

##############################################################################
# Output and Reporting
##############################################################################

display_deployment_summary() {
    log_header "Deployment Summary"

    echo ""
    echo "========================================="
    echo -e "${BOLD}RDA IMAGE GENERATOR DEPLOYMENT COMPLETE${NC}"
    echo "========================================="
    echo ""

    echo -e "${GREEN}✅ Environment:${NC} $ENVIRONMENT"
    echo -e "${GREEN}✅ Mock Mode:${NC} $MOCK_MODE"
    echo -e "${GREEN}✅ Stack Name:${NC} $STACK_NAME"
    echo ""

    if [[ -n "$API_GATEWAY_URL" ]]; then
        echo -e "${BOLD}🌐 API Gateway URL:${NC}"
        echo "   $API_GATEWAY_URL"
        echo ""
    fi

    if [[ ${#LAMBDA_FUNCTIONS[@]} -gt 0 ]]; then
        echo -e "${BOLD}⚡ Lambda Functions:${NC}"
        for func in "${LAMBDA_FUNCTIONS[@]}"; do
            echo "   • $func"
        done
        echo ""
    fi

    if [[ -n "$DYNAMODB_TABLE" ]]; then
        echo -e "${BOLD}🗄️  DynamoDB Table:${NC}"
        echo "   $DYNAMODB_TABLE"
        echo ""
    fi

    if [[ -n "$S3_BUCKET" ]]; then
        echo -e "${BOLD}🪣 S3 Bucket:${NC}"
        echo "   $S3_BUCKET"
        echo ""
    fi

    if [[ -n "$SQS_QUEUE" ]]; then
        echo -e "${BOLD}📬 SQS Queue:${NC}"
        echo "   $SQS_QUEUE"
        echo ""
    fi

    echo -e "${GREEN}🚀 Deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Full deployment log: $DEPLOYMENT_LOG${NC}"
    echo ""
}

##############################################################################
# Main Deployment Flow
##############################################################################

main() {
    echo "========================================="
    echo -e "${BOLD}RDA IMAGE GENERATOR - DEPLOYMENT SCRIPT${NC}"
    echo "========================================="
    echo ""

    log_info "Starting deployment at $(date)"
    log_info "Deployment log: $DEPLOYMENT_LOG"
    echo ""

    # Phase 1: Validation
    validate_parameters "$@"
    validate_prerequisites
    echo ""

    # Phase 2: Build
    build_lambda_functions
    echo ""

    build_sam_template
    echo ""

    # Phase 3: Deploy
    deploy_stack
    echo ""

    # Phase 4: Verify
    post_deployment_verification
    echo ""

    # Phase 5: Report
    display_deployment_summary

    log_success "Deployment completed successfully!"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi