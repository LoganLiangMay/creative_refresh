#!/bin/bash

##############################################################################
# RDA Publisher - Quick Start Script
# Starts the localhost development server for testing
##############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║     🚀 RDA Publisher - Starting Localhost Server              ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env.local exists
if [ ! -f "../.env.local" ]; then
    echo "❌ Error: .env.local not found!"
    echo "Please create ../.env.local with your configuration."
    echo "See README.md for required environment variables."
    exit 1
fi

# Check for required environment variables
source ../.env.local

REQUIRED_VARS=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_S3_BUCKET_NAME"
    "GOOGLE_ADS_DEVELOPER_TOKEN"
    "GOOGLE_ADS_CLIENT_ID"
    "GOOGLE_ADS_CLIENT_SECRET"
    "GOOGLE_ADS_REFRESH_TOKEN"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update ../.env.local with all required values."
    echo "See README.md for details."
    exit 1
fi

# Check for optional but important variables
if [ -z "$GOOGLE_ADS_CUSTOMER_ID" ]; then
    echo "⚠️  Warning: GOOGLE_ADS_CUSTOMER_ID not configured"
    echo "   You won't be able to publish ads until this is set."
    echo ""
fi

if [ -z "$GOOGLE_ADS_AD_GROUP_ID" ]; then
    echo "⚠️  Warning: GOOGLE_ADS_AD_GROUP_ID not configured"
    echo "   You won't be able to publish ads until this is set."
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed!"
    echo ""
fi

echo "✅ All checks passed!"
echo ""
echo "Starting server..."
echo ""

# Start the server
npm start
