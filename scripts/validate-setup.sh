#!/bin/bash

set -e

echo "========================================="
echo "RDA Image Generator - Setup Validation"
echo "========================================="

# Check AWS CLI
echo -n "Checking AWS CLI... "
if command -v aws &> /dev/null; then
    echo "✓ Installed ($(aws --version 2>&1 | cut -d' ' -f1))"
else
    echo "✗ Not found"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check SAM CLI
echo -n "Checking SAM CLI... "
if command -v sam &> /dev/null; then
    echo "✓ Installed ($(sam --version | cut -d' ' -f4))"
else
    echo "✗ Not found"
    echo "Please install SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Installed ($NODE_VERSION)"
    if [[ ! "$NODE_VERSION" =~ ^v(18|20) ]]; then
        echo "  ⚠ Warning: Node.js 18.x or 20.x recommended"
    fi
else
    echo "✗ Not found"
    echo "Please install Node.js 20.x: https://nodejs.org/"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    echo "✓ Installed ($(npm --version))"
else
    echo "✗ Not found"
    exit 1
fi

# Check AWS credentials
echo -n "Checking AWS credentials... "
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REGION=$(aws configure get region || echo "us-east-1")
    echo "✓ Configured"
    echo "  Account: $ACCOUNT_ID"
    echo "  Region: $REGION"
else
    echo "✗ Not configured"
    echo "Please run: aws configure"
    exit 1
fi

# Check project structure
echo -n "Checking project structure... "
REQUIRED_DIRS=("lambdas/controller" "lambdas/prompt-builder" "lambdas/worker" "scripts")
MISSING_DIRS=()

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

if [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo "✓ Complete"
else
    echo "✗ Missing directories:"
    for dir in "${MISSING_DIRS[@]}"; do
        echo "  - $dir"
    done
    exit 1
fi

# Check template
echo -n "Checking SAM template... "
if [ -f "template.yaml" ]; then
    if sam validate &> /dev/null; then
        echo "✓ Valid"
    else
        echo "✗ Invalid"
        echo "Run: sam validate"
        exit 1
    fi
else
    echo "✗ Not found"
    exit 1
fi

# Check dependencies
echo -n "Checking Lambda dependencies... "
MISSING_DEPS=()

for lambda in controller prompt-builder worker; do
    if [ ! -d "lambdas/$lambda/node_modules" ]; then
        MISSING_DEPS+=("$lambda")
    fi
done

if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    echo "✓ Installed"
else
    echo "⚠ Not installed for: ${MISSING_DEPS[*]}"
    echo "  Run: npm install in each Lambda directory"
fi

echo ""
echo "========================================="
echo "Validation Summary"
echo "========================================="

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo ""
    echo "To install dependencies:"
    echo "  cd lambdas/controller && npm install && cd ../.."
    echo "  cd lambdas/prompt-builder && npm install && cd ../.."
    echo "  cd lambdas/worker && npm install && cd ../.."
fi

echo ""
echo "To deploy (with Mock Mode - FREE):"
echo "  sam build"
echo "  sam deploy --parameter-overrides Environment=dev MockMode=true"
echo ""
echo "To test:"
echo "  export OPENAI_API_KEY='sk-test-key'"
echo "  node scripts/test-integration.js"
echo ""
echo "========================================="