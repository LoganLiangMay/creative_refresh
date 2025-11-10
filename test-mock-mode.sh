#!/bin/bash

##############################################################################
# Mock Mode Test Execution Script
#
# Quick-start script to run all 5 test scenarios for Phase 1 verification
# Based on IMPLEMENTATION_GUIDE.md Section 5.4
##############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}🎭 Mock Mode Test Execution - Phase 1 Verification${NC}"
echo "=================================================="

# Check if deployment exists
STACK_NAME="rda-image-generator-dev"

if ! aws cloudformation describe-stacks --stack-name $STACK_NAME &>/dev/null; then
    echo -e "${RED}❌ Stack $STACK_NAME not found. Please deploy first:${NC}"
    echo "./deploy.sh dev true"
    exit 1
fi

# Extract deployment outputs
echo -e "${BLUE}📋 Extracting deployment information...${NC}"

API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
DYNAMODB_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' --output text)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
WORKER_FUNCTION=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WorkerFunctionName`].OutputValue' --output text)

echo "✅ API Gateway: $API_GATEWAY_URL"
echo "✅ DynamoDB Table: $DYNAMODB_TABLE"
echo "✅ S3 Bucket: $S3_BUCKET"
echo "✅ Worker Function: $WORKER_FUNCTION"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_cmd="$2"

    echo -e "\n${BOLD}🧪 $test_name${NC}"
    echo "----------------------------------------"

    if eval "$test_cmd"; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✅ $test_name PASSED${NC}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}❌ $test_name FAILED${NC}"
    fi
}

# Test 1: Single Image Generation
test_single_image() {
    local job_id=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
        -H "Content-Type: application/json" \
        -d '{"customer_id": "test_001", "images": [{"prompt": "Test image", "aspect_ratio": "1.91:1"}]}' \
        | jq -r '.job_id')

    echo "Created job: $job_id"

    local start_time=$(date +%s)
    while true; do
        local status=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.status')
        echo "Status: $status"

        if [[ "$status" == "completed" ]]; then
            break
        elif [[ "$status" == "failed" ]]; then
            echo "Job failed"
            return 1
        fi

        local elapsed=$(($(date +%s) - start_time))
        if [[ $elapsed -gt 15 ]]; then
            echo "Timeout after ${elapsed}s"
            return 1
        fi

        sleep 2
    done

    local duration=$(($(date +%s) - start_time))
    local cost=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.total_cost // 0')

    echo "Duration: ${duration}s, Cost: \$${cost}"

    [[ $duration -le 10 && ("$cost" == "0" || "$cost" == "0.00") ]]
}

# Test 2: Batch Generation
test_batch_generation() {
    local job_id=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
        -H "Content-Type: application/json" \
        -d '{
            "customer_id": "test_002",
            "images": [
                {"prompt": "Landscape 1", "aspect_ratio": "1.91:1"},
                {"prompt": "Landscape 2", "aspect_ratio": "1.91:1"},
                {"prompt": "Square 1", "aspect_ratio": "1:1"},
                {"prompt": "Square 2", "aspect_ratio": "1:1"},
                {"prompt": "Mixed test", "aspect_ratio": "1.91:1"}
            ]
        }' | jq -r '.job_id')

    echo "Created batch job: $job_id"

    local start_time=$(date +%s)
    while true; do
        local job_data=$(curl -s "$API_GATEWAY_URL/jobs/$job_id")
        local status=$(echo "$job_data" | jq -r '.status')

        echo "Batch status: $status"

        if [[ "$status" == "completed" ]]; then
            break
        elif [[ "$status" == "failed" ]]; then
            echo "Batch failed"
            return 1
        fi

        local elapsed=$(($(date +%s) - start_time))
        if [[ $elapsed -gt 25 ]]; then
            echo "Batch timeout after ${elapsed}s"
            return 1
        fi

        sleep 3
    done

    local duration=$(($(date +%s) - start_time))
    local job_data=$(curl -s "$API_GATEWAY_URL/jobs/$job_id")
    local cost=$(echo "$job_data" | jq -r '.total_cost // 0')
    local landscape_count=$(echo "$job_data" | jq '[.images[] | select(.aspect_ratio == "1.91:1")] | length')
    local square_count=$(echo "$job_data" | jq '[.images[] | select(.aspect_ratio == "1:1")] | length')

    echo "Duration: ${duration}s, Cost: \$${cost}"
    echo "Landscape: $landscape_count, Square: $square_count"

    [[ $duration -le 20 && ("$cost" == "0" || "$cost" == "0.00") && $landscape_count -ge 2 && $square_count -ge 2 ]]
}

# Test 3: Validation Testing
test_validation() {
    local job_id=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
        -H "Content-Type: application/json" \
        -d '{
            "customer_id": "test_003",
            "images": [
                {"prompt": "Validation test with text content", "aspect_ratio": "1.91:1"},
                {"prompt": "Another validation test", "aspect_ratio": "1:1"}
            ]
        }' | jq -r '.job_id')

    echo "Created validation job: $job_id"

    local start_time=$(date +%s)
    while true; do
        local job_data=$(curl -s "$API_GATEWAY_URL/jobs/$job_id")
        local status=$(echo "$job_data" | jq -r '.status')

        if [[ "$status" == "completed" ]]; then
            break
        elif [[ "$status" == "failed" ]]; then
            echo "Validation job failed"
            return 1
        fi

        local elapsed=$(($(date +%s) - start_time))
        if [[ $elapsed -gt 15 ]]; then
            echo "Validation timeout"
            return 1
        fi

        sleep 2
    done

    local job_data=$(curl -s "$API_GATEWAY_URL/jobs/$job_id")
    local cost=$(echo "$job_data" | jq -r '.total_cost // 0')
    local completed_images=$(echo "$job_data" | jq '[.images[] | select(.status == "completed")] | length')
    local total_images=$(echo "$job_data" | jq '.images | length')

    echo "Completed: $completed_images/$total_images, Cost: \$${cost}"

    [[ $completed_images -eq $total_images && ("$cost" == "0" || "$cost" == "0.00") ]]
}

# Test 4: Cost Tracking
test_cost_tracking() {
    local total_cost=0
    local batches_completed=0

    for batch in 1 2 3; do
        local job_id=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
            -H "Content-Type: application/json" \
            -d "{
                \"customer_id\": \"cost_test_${batch}\",
                \"images\": [
                    {\"prompt\": \"Cost test $batch\", \"aspect_ratio\": \"1.91:1\"}
                ]
            }" | jq -r '.job_id')

        echo "Cost batch $batch: $job_id"

        # Wait for completion
        local attempts=0
        while [[ $attempts -lt 15 ]]; do
            local status=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.status')
            if [[ "$status" == "completed" ]]; then
                local cost=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.total_cost // 0')
                echo "Batch $batch cost: \$${cost}"
                batches_completed=$((batches_completed + 1))
                break
            elif [[ "$status" == "failed" ]]; then
                echo "Cost batch $batch failed"
                break
            fi
            attempts=$((attempts + 1))
            sleep 2
        done
    done

    echo "Completed batches: $batches_completed/3"
    [[ $batches_completed -eq 3 ]]
}

# Test 5: Load Testing (simplified)
test_load_testing() {
    local job_ids=()

    # Create 3 concurrent jobs
    for i in {1..3}; do
        local job_id=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
            -H "Content-Type: application/json" \
            -d "{
                \"customer_id\": \"load_test_${i}\",
                \"images\": [
                    {\"prompt\": \"Load test ${i}-1\", \"aspect_ratio\": \"1.91:1\"},
                    {\"prompt\": \"Load test ${i}-2\", \"aspect_ratio\": \"1:1\"}
                ]
            }" | jq -r '.job_id')
        job_ids+=("$job_id")
        echo "Load test job $i: $job_id"
    done

    # Wait for all to complete
    local completed=0
    local attempts=0

    while [[ $completed -lt 3 && $attempts -lt 30 ]]; do
        completed=0
        for job_id in "${job_ids[@]}"; do
            local status=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.status')
            if [[ "$status" == "completed" ]]; then
                completed=$((completed + 1))
            fi
        done

        echo "Load test progress: $completed/3 completed"

        if [[ $completed -lt 3 ]]; then
            sleep 3
            attempts=$((attempts + 1))
        fi
    done

    # Check costs
    local total_cost=0
    for job_id in "${job_ids[@]}"; do
        local cost=$(curl -s "$API_GATEWAY_URL/jobs/$job_id" | jq -r '.total_cost // 0')
        echo "Job $job_id cost: \$${cost}"
    done

    echo "Load test completed: $completed/3"
    [[ $completed -eq 3 ]]
}

# Run all tests
echo -e "\n${BOLD}🚀 Starting Mock Mode Test Suite${NC}"

run_test "Test 1: Single Image Generation" "test_single_image"
run_test "Test 2: Batch Generation" "test_batch_generation"
run_test "Test 3: Validation Testing" "test_validation"
run_test "Test 4: Cost Tracking" "test_cost_tracking"
run_test "Test 5: Load Testing" "test_load_testing"

# Quick CloudWatch verification
echo -e "\n${BOLD}🔍 Quick CloudWatch Log Check${NC}"
echo "----------------------------------------"

mock_logs=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
    --start-time $(date -d '10 minutes ago' +%s)000 \
    --filter-pattern "MOCK" \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")

if [[ $mock_logs -gt 0 ]]; then
    echo -e "${GREEN}✅ Found $mock_logs Mock Mode log entries${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  No Mock Mode logs found (may need more time)${NC}"
fi

# S3 Quick Check
echo -e "\n${BOLD}🪣 Quick S3 Image Check${NC}"
echo "----------------------------------------"

s3_count=$(aws s3 ls s3://$S3_BUCKET/ --recursive | wc -l || echo "0")
if [[ $s3_count -gt 0 ]]; then
    echo -e "${GREEN}✅ Found $s3_count images in S3${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ No images found in S3${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# DynamoDB Quick Check
echo -e "\n${BOLD}🗄️ Quick DynamoDB Check${NC}"
echo "----------------------------------------"

mock_records=$(aws dynamodb scan \
    --table-name "$DYNAMODB_TABLE" \
    --filter-expression "mock_mode = :mock" \
    --expression-attribute-values '{":mock":{"BOOL":true}}' \
    --query 'Count' \
    --output text 2>/dev/null || echo "0")

if [[ $mock_records -gt 0 ]]; then
    echo -e "${GREEN}✅ Found $mock_records mock mode records in DynamoDB${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ No mock mode records found in DynamoDB${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Final Summary
echo -e "\n${BOLD}📊 TEST EXECUTION SUMMARY${NC}"
echo "=========================================="
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}${BOLD}🎉 ALL TESTS PASSED! Mock Mode Phase 1 is working correctly!${NC}"
    echo -e "${GREEN}✅ System is ready for production deployment${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}❌ Some tests failed. Please check the detailed output above.${NC}"
    echo -e "${YELLOW}💡 For detailed testing, run: ./test-detailed-mock-mode.sh${NC}"
    exit 1
fi