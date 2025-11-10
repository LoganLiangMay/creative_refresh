#!/bin/bash

# ==============================================================================
# setup-secrets.sh
# Store Replicate API token in AWS Secrets Manager
# Task 1.2 from PRD.md Section 2.2
# ==============================================================================

set -e  # Exit on any error

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${1:-dev}"
REPLICATE_TOKEN="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Secret name based on environment
SECRET_NAME="rda-generator/replicate-token-${ENVIRONMENT}"

# ==============================================================================
# Functions
# ==============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}  RDA Generator - Secrets Manager Setup${NC}"
    echo -e "${BLUE}===================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

validate_inputs() {
    echo -e "${BLUE}Step 1: Validating inputs...${NC}"

    # Check AWS CLI installation
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        echo "Please install AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
    print_success "AWS CLI found"

    # Check AWS credentials
    if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        echo "Please run: aws configure"
        exit 1
    fi

    # Get AWS account info
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    CALLER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    print_success "AWS credentials valid"
    print_info "Account: $ACCOUNT_ID"
    print_info "Caller: $CALLER_ARN"

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        echo "Valid environments: dev, staging, prod"
        exit 1
    fi
    print_success "Environment: $ENVIRONMENT"

    # Check if token provided
    if [ -z "$REPLICATE_TOKEN" ]; then
        print_warning "No Replicate token provided"
        echo ""
        echo "Using placeholder token. You can update it later with:"
        echo "  $0 $ENVIRONMENT your-actual-token"
        REPLICATE_TOKEN="r8_PLACEHOLDER_TOKEN_UPDATE_ME"
    else
        # Validate token format
        if [[ ! "$REPLICATE_TOKEN" =~ ^r8_ ]]; then
            print_warning "Token doesn't start with 'r8_' - this may not be a valid Replicate token"
            echo "Continue anyway? (y/n)"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                echo "Aborted."
                exit 1
            fi
        fi
        print_success "Token format appears valid"
    fi

    echo ""
}

check_existing_secret() {
    echo -e "${BLUE}Step 2: Checking for existing secret...${NC}"

    if aws secretsmanager describe-secret \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" &> /dev/null; then

        print_warning "Secret '$SECRET_NAME' already exists"
        echo ""
        echo "Options:"
        echo "  1) Update existing secret"
        echo "  2) Delete and recreate"
        echo "  3) Cancel"
        echo ""
        echo -n "Choose option (1/2/3): "
        read -r choice

        case $choice in
            1)
                return 1  # Update existing
                ;;
            2)
                echo "Deleting existing secret..."
                aws secretsmanager delete-secret \
                    --secret-id "$SECRET_NAME" \
                    --force-delete-without-recovery \
                    --region "$REGION" &> /dev/null
                print_success "Existing secret deleted"
                sleep 2  # Wait for deletion to propagate
                return 0  # Create new
                ;;
            3)
                echo "Operation cancelled."
                exit 0
                ;;
            *)
                print_error "Invalid option"
                exit 1
                ;;
        esac
    else
        print_info "No existing secret found"
        return 0  # Create new
    fi
}

create_secret() {
    echo -e "${BLUE}Step 3: Creating secret...${NC}"

    # Create the secret JSON
    SECRET_JSON=$(cat <<EOF
{
    "token": "$REPLICATE_TOKEN",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "created_by": "$CALLER_ARN"
}
EOF
)

    # Create the secret
    SECRET_ARN=$(aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Replicate API token for RDA Image Generator ($ENVIRONMENT environment)" \
        --secret-string "$SECRET_JSON" \
        --tags \
            Key=Environment,Value="$ENVIRONMENT" \
            Key=Application,Value=RDAGenerator \
            Key=Component,Value=Secret \
            Key=ManagedBy,Value=setup-secrets.sh \
        --region "$REGION" \
        --query ARN \
        --output text 2>/dev/null) || {
        print_error "Failed to create secret"
        exit 1
    }

    print_success "Secret created successfully"
    echo ""
}

update_secret() {
    echo -e "${BLUE}Step 3: Updating secret...${NC}"

    # Create the updated secret JSON
    SECRET_JSON=$(cat <<EOF
{
    "token": "$REPLICATE_TOKEN",
    "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "updated_by": "$CALLER_ARN"
}
EOF
)

    # Update the secret
    SECRET_ARN=$(aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION" \
        --query ARN \
        --output text 2>/dev/null) || {
        print_error "Failed to update secret"
        exit 1
    }

    print_success "Secret updated successfully"
    echo ""
}

verify_secret() {
    echo -e "${BLUE}Step 4: Verifying secret...${NC}"

    # Get the secret value
    SECRET_VALUE=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" \
        --query SecretString \
        --output text 2>/dev/null) || {
        print_error "Failed to retrieve secret"
        exit 1
    }

    # Parse the token from JSON
    RETRIEVED_TOKEN=$(echo "$SECRET_VALUE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

    # Verify token matches
    if [ "$RETRIEVED_TOKEN" = "$REPLICATE_TOKEN" ]; then
        print_success "Secret verified - token matches"
    else
        print_error "Secret verification failed - token mismatch"
        exit 1
    fi

    # Get secret metadata
    SECRET_META=$(aws secretsmanager describe-secret \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" 2>/dev/null)

    SECRET_VERSION=$(echo "$SECRET_META" | grep -o '"VersionId":"[^"]*"' | cut -d'"' -f4)

    print_success "Secret is accessible"
    print_info "Version ID: $SECRET_VERSION"
    echo ""
}

output_configuration() {
    echo -e "${BLUE}Step 5: Configuration Output${NC}"
    echo ""
    echo -e "${GREEN}✨ Secret successfully configured!${NC}"
    echo ""
    echo "========================================="
    echo "Secret Details:"
    echo "========================================="
    echo "Name:        $SECRET_NAME"
    echo "ARN:         $SECRET_ARN"
    echo "Region:      $REGION"
    echo "Environment: $ENVIRONMENT"
    echo ""

    if [[ "$REPLICATE_TOKEN" == "r8_PLACEHOLDER_TOKEN_UPDATE_ME" ]]; then
        echo "========================================="
        echo -e "${YELLOW}⚠️  IMPORTANT: Using placeholder token${NC}"
        echo "========================================="
        echo ""
        echo "To update with your real Replicate token:"
        echo -e "${BLUE}  $0 $ENVIRONMENT your-actual-token${NC}"
        echo ""
        echo "Or use AWS CLI:"
        echo -e "${BLUE}  aws secretsmanager update-secret \\
    --secret-id $SECRET_NAME \\
    --secret-string '{\"token\":\"r8_YOUR_ACTUAL_TOKEN\"}' \\
    --region $REGION${NC}"
    fi

    echo ""
    echo "========================================="
    echo "Lambda Environment Variables:"
    echo "========================================="
    echo "Add to your Lambda configuration:"
    echo ""
    echo "REPLICATE_API_TOKEN_SECRET=$SECRET_ARN"
    echo ""

    # Save to .env file for reference
    ENV_FILE=".env.${ENVIRONMENT}"
    cat > "$ENV_FILE" <<EOF
# Auto-generated by setup-secrets.sh on $(date)
# Environment: $ENVIRONMENT

REPLICATE_API_TOKEN_SECRET=$SECRET_ARN
SECRET_NAME=$SECRET_NAME
AWS_REGION=$REGION
ENVIRONMENT=$ENVIRONMENT
EOF

    print_success "Configuration saved to $ENV_FILE"
    echo ""
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    print_header

    # Validate inputs
    validate_inputs

    # Check for existing secret
    if check_existing_secret; then
        # Create new secret
        create_secret
    else
        # Update existing secret
        update_secret
    fi

    # Verify the secret
    verify_secret

    # Output configuration
    output_configuration

    echo -e "${GREEN}✅ Setup complete!${NC}"
    echo ""
}

# Show usage if --help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "Usage: $0 [environment] [replicate-token]"
    echo ""
    echo "Arguments:"
    echo "  environment      The deployment environment (dev|staging|prod). Default: dev"
    echo "  replicate-token  Your Replicate API token (starts with r8_). Optional."
    echo ""
    echo "Examples:"
    echo "  $0                    # Use dev environment with placeholder token"
    echo "  $0 prod               # Use prod environment with placeholder token"
    echo "  $0 dev r8_abc123...   # Use dev environment with actual token"
    echo ""
    exit 0
fi

# Run main function
main