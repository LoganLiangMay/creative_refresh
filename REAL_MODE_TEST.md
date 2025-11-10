# Real Mode Test Plan - Limited Cost Testing

## ⚠️ **COST WARNING: This test will incur ~$0.08 in Gemini API costs**

This test plan switches to Real Mode temporarily to verify the complete system works with actual AI image generation using Google's Gemini Imagen API. We limit to **exactly 2 images** to minimize costs.

## Prerequisites

1. Mock Mode tests have passed
2. Google Gemini API key is configured in AWS Secrets Manager
3. You have confirmed AWS credentials and permissions

## Phase 1: Pre-Test Setup and Verification

### Extract Current Configuration
```bash
# Set up variables
export STACK_NAME="rda-image-generator-dev"
export API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
export WORKER_FUNCTION=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WorkerFunctionName`].OutputValue' --output text)
export S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
export DYNAMODB_TABLE=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' --output text)

echo "=== Current Configuration ==="
echo "API Gateway: $API_GATEWAY_URL"
echo "Worker Function: $WORKER_FUNCTION"
echo "S3 Bucket: $S3_BUCKET"
echo "DynamoDB Table: $DYNAMODB_TABLE"
```

### Verify Gemini API Key is Available
```bash
# Check if Gemini API key secret exists
echo "=== Verifying Gemini API Key ==="
export SECRET_NAME="rda-generator/gemini-api-key"

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" &>/dev/null; then
    echo "✅ Gemini API key secret exists: $SECRET_NAME"
else
    echo "❌ Gemini API key secret not found: $SECRET_NAME"
    echo "Please create the secret with your Gemini API key first:"
    echo "aws secretsmanager create-secret --name '$SECRET_NAME' --secret-string 'AIza_your_api_key_here'"
    exit 1
fi
```

### Check Current Mock Mode Status
```bash
# Verify current Mock Mode setting
echo "=== Current Mock Mode Status ==="
current_mock_mode=$(aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text)
echo "Current MOCK_MODE: $current_mock_mode"

if [[ "$current_mock_mode" != "true" ]]; then
    echo "⚠️  Warning: MOCK_MODE is not currently set to true"
    echo "Expected: true, Found: $current_mock_mode"
fi
```

## Phase 2: Switch to Real Mode

### Update Worker Lambda Environment
```bash
echo "=== Switching to Real Mode ==="
echo "⚠️  About to enable Real Mode - this will incur API costs!"
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Switch to Real Mode
aws lambda update-function-configuration \
    --function-name "$WORKER_FUNCTION" \
    --environment Variables="{MOCK_MODE=false,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev,GEMINI_SECRET_NAME=$SECRET_NAME}" \
    --query 'Environment.Variables.MOCK_MODE' \
    --output text

echo "Waiting for Lambda configuration to propagate..."
sleep 10

# Verify the change
new_mock_mode=$(aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text)
echo "New MOCK_MODE setting: $new_mock_mode"

if [[ "$new_mock_mode" == "false" ]]; then
    echo "✅ Successfully switched to Real Mode"
else
    echo "❌ Failed to switch to Real Mode. Current setting: $new_mock_mode"
    exit 1
fi
```

## Phase 3: Real Mode Test Execution

### Test: Generate Exactly 2 Real Images
```bash
echo "=== Real Mode Test: 2 Images Only ==="
echo "💰 Expected cost: ~\$0.08 (2 × \$0.04 per image with Gemini API)"

# Create job with exactly 2 images - different aspect ratios
REAL_TEST_JOB=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
    -H "Content-Type: application/json" \
    -d '{
        "customer_id": "real_mode_test",
        "images": [
            {
                "prompt": "A serene mountain landscape with a crystal clear lake reflecting snow-capped peaks at sunset",
                "aspect_ratio": "1.91:1"
            },
            {
                "prompt": "A modern minimalist coffee shop interior with warm lighting and wooden furniture",
                "aspect_ratio": "1:1"
            }
        ]
    }' | jq -r '.job_id')

if [[ "$REAL_TEST_JOB" == "null" || -z "$REAL_TEST_JOB" ]]; then
    echo "❌ Failed to create real mode test job"
    echo "Response was:"
    curl -s -X POST "$API_GATEWAY_URL/jobs" \
        -H "Content-Type: application/json" \
        -d '{
            "customer_id": "real_mode_test",
            "images": [
                {"prompt": "A serene mountain landscape", "aspect_ratio": "1.91:1"},
                {"prompt": "A modern coffee shop", "aspect_ratio": "1:1"}
            ]
        }'
    exit 1
fi

echo "✅ Created real mode job: $REAL_TEST_JOB"
echo "🕐 Waiting for real AI image generation (this may take 2-3 minutes)..."

# Monitor job progress with detailed logging
start_time=$(date +%s)
last_status=""
timeout_minutes=5
timeout_seconds=$((timeout_minutes * 60))

while true; do
    job_data=$(curl -s "$API_GATEWAY_URL/jobs/$REAL_TEST_JOB")
    current_status=$(echo "$job_data" | jq -r '.status')
    progress=$(echo "$job_data" | jq -r '.progress // "N/A"')

    # Only log status changes to avoid spam
    if [[ "$current_status" != "$last_status" ]]; then
        echo "$(date '+%H:%M:%S') - Status: $current_status, Progress: $progress"
        last_status="$current_status"
    fi

    if [[ "$current_status" == "completed" ]]; then
        echo "✅ Real mode job completed successfully!"
        break
    elif [[ "$current_status" == "failed" ]]; then
        echo "❌ Real mode job failed"
        echo "Job details:"
        echo "$job_data" | jq '.'

        # Show recent logs for debugging
        echo "Recent Worker Function logs:"
        aws logs filter-log-events \
            --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
            --start-time $((start_time * 1000)) \
            --query 'events[-10:].message' \
            --output text

        exit 1
    fi

    # Check timeout
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [[ $elapsed -gt $timeout_seconds ]]; then
        echo "❌ Real mode test timed out after $timeout_minutes minutes"
        echo "Current status: $current_status"
        echo "This may indicate an issue with Replicate API or configuration"
        exit 1
    fi

    # Show progress every 30 seconds
    if [[ $((elapsed % 30)) -eq 0 && $elapsed -gt 0 ]]; then
        echo "$(date '+%H:%M:%S') - Still processing... (${elapsed}s elapsed)"
    fi

    sleep 10
done

end_time=$(date +%s)
total_duration=$((end_time - start_time))
echo "🕐 Total real mode generation time: ${total_duration} seconds"
```

## Phase 4: Verification

### Verify Real Images (Not Mock)
```bash
echo "=== Verifying Real Images ==="

# Get final job details
final_job_data=$(curl -s "$API_GATEWAY_URL/jobs/$REAL_TEST_JOB")
echo "$final_job_data" | jq '.'

# Check image details
image_count=$(echo "$final_job_data" | jq '.images | length')
completed_images=$(echo "$final_job_data" | jq '[.images[] | select(.status == "completed")] | length')

echo "Images requested: 2"
echo "Images completed: $completed_images"
echo "Expected: 2 completed images"

if [[ $completed_images -eq 2 ]]; then
    echo "✅ All images completed successfully"
else
    echo "❌ Expected 2 completed images, got $completed_images"
fi

# Extract image URLs and metadata
echo "=== Image Details ==="
for i in 0 1; do
    image_data=$(echo "$final_job_data" | jq -r ".images[$i]")
    image_id=$(echo "$image_data" | jq -r '.image_id')
    s3_key=$(echo "$image_data" | jq -r '.s3_key')
    aspect_ratio=$(echo "$image_data" | jq -r '.aspect_ratio')
    generation_time=$(echo "$image_data" | jq -r '.generation_time_ms // "N/A"')

    echo "Image $((i+1)): $image_id"
    echo "  S3 Key: $s3_key"
    echo "  Aspect Ratio: $aspect_ratio"
    echo "  Generation Time: ${generation_time}ms"

    # Check if image exists in S3
    if aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" &>/dev/null; then
        image_size=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" --query 'ContentLength' --output text)
        echo "  S3 Size: $image_size bytes"
        echo "  ✅ Real image confirmed (size > mock image)"
    else
        echo "  ❌ Image not found in S3"
    fi
done
```

### Verify Cost
```bash
echo "=== Cost Verification ==="

# Get cost from job
actual_cost=$(echo "$final_job_data" | jq -r '.total_cost // 0')
expected_cost="0.08"

echo "Expected cost: \$${expected_cost} (2 × \$0.04 with Gemini API)"
echo "Actual cost: \$${actual_cost}"

# Compare costs (allowing for small floating point differences)
cost_comparison=$(echo "$actual_cost >= 0.06 && $actual_cost <= 0.10" | bc -l 2>/dev/null || echo "0")

if [[ "$cost_comparison" == "1" ]]; then
    echo "✅ Cost verification PASSED: \$${actual_cost} is within expected range"
else
    echo "⚠️  Cost verification: \$${actual_cost} outside expected range (\$0.06-\$0.10)"
    echo "This could be due to pricing changes or additional charges"
fi

# Check DynamoDB record
echo "=== DynamoDB Cost Record ==="
dynamo_record=$(aws dynamodb get-item \
    --table-name "$DYNAMODB_TABLE" \
    --key "{\"job_id\":{\"S\":\"$REAL_TEST_JOB\"}}" \
    --query 'Item' \
    --output json)

if [[ "$dynamo_record" != "null" ]]; then
    dynamo_cost=$(echo "$dynamo_record" | jq -r '.total_cost.N // "0"')
    dynamo_mock_mode=$(echo "$dynamo_record" | jq -r '.mock_mode.BOOL // false')

    echo "DynamoDB cost record: \$${dynamo_cost}"
    echo "DynamoDB mock_mode: $dynamo_mock_mode"

    if [[ "$dynamo_mock_mode" == "false" ]]; then
        echo "✅ DynamoDB correctly shows mock_mode=false"
    else
        echo "❌ DynamoDB shows mock_mode=$dynamo_mock_mode (expected false)"
    fi
else
    echo "❌ No DynamoDB record found for job $REAL_TEST_JOB"
fi
```

### Download Sample Image for Quality Check
```bash
echo "=== Downloading Sample Image ==="

# Get the first completed image
sample_s3_key=$(echo "$final_job_data" | jq -r '.images[0].s3_key')
sample_image_id=$(echo "$final_job_data" | jq -r '.images[0].image_id')

if [[ "$sample_s3_key" != "null" && -n "$sample_s3_key" ]]; then
    # Download image
    echo "Downloading: $sample_s3_key"
    aws s3 cp "s3://$S3_BUCKET/$sample_s3_key" "./real_mode_sample_${sample_image_id}.jpg"

    if [[ -f "./real_mode_sample_${sample_image_id}.jpg" ]]; then
        file_size=$(stat -f%z "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null || stat -c%s "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null)
        echo "✅ Downloaded sample image: real_mode_sample_${sample_image_id}.jpg"
        echo "   File size: $file_size bytes"
        echo "   📝 You can now open this image to verify it's a real AI-generated image"

        # Try to get image dimensions
        if command -v identify &> /dev/null; then
            dimensions=$(identify "./real_mode_sample_${sample_image_id}.jpg" 2>/dev/null | cut -d' ' -f3)
            echo "   Dimensions: $dimensions"
        fi
    else
        echo "❌ Failed to download sample image"
    fi
else
    echo "❌ No valid S3 key found for sample download"
fi
```

### Check CloudWatch Logs for Real Mode
```bash
echo "=== CloudWatch Logs Verification ==="

echo "Checking for Real Mode indicators in logs..."

# Check for real mode logs
real_mode_logs=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
    --start-time $((start_time * 1000)) \
    --filter-pattern "Gemini" \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")

echo "Real mode log entries found: $real_mode_logs"

if [[ $real_mode_logs -gt 0 ]]; then
    echo "✅ Found $real_mode_logs Gemini API-related log entries"
    echo "Recent Gemini API logs:"
    aws logs filter-log-events \
        --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
        --start-time $((start_time * 1000)) \
        --filter-pattern "Gemini" \
        --query 'events[-5:].message' \
        --output text
else
    echo "⚠️  No Gemini API logs found - checking for other real mode indicators"

    # Check for cost logs
    cost_logs=$(aws logs filter-log-events \
        --log-group-name "/aws/lambda/$WORKER_FUNCTION" \
        --start-time $((start_time * 1000)) \
        --filter-pattern "cost" \
        --query 'events[-3:].message' \
        --output text)

    if [[ -n "$cost_logs" ]]; then
        echo "Cost-related logs:"
        echo "$cost_logs"
    fi
fi
```

## Phase 5: Switch Back to Mock Mode

### Restore Mock Mode Configuration
```bash
echo "=== Switching Back to Mock Mode ==="
echo "🔄 Restoring MOCK_MODE=true to prevent further costs..."

# Switch back to Mock Mode
aws lambda update-function-configuration \
    --function-name "$WORKER_FUNCTION" \
    --environment Variables="{MOCK_MODE=true,DYNAMODB_TABLE=$DYNAMODB_TABLE,S3_BUCKET=$S3_BUCKET,ENVIRONMENT=dev}" \
    --query 'Environment.Variables.MOCK_MODE' \
    --output text

echo "Waiting for Lambda configuration to propagate..."
sleep 10

# Verify the restoration
restored_mock_mode=$(aws lambda get-function-configuration --function-name "$WORKER_FUNCTION" --query 'Environment.Variables.MOCK_MODE' --output text)

if [[ "$restored_mock_mode" == "true" ]]; then
    echo "✅ Successfully restored Mock Mode"
    echo "🛡️  System is now safe from accidental API costs"
else
    echo "❌ Failed to restore Mock Mode!"
    echo "⚠️  WARNING: System is still in Real Mode - manual intervention required"
    echo "Current MOCK_MODE: $restored_mock_mode"
    exit 1
fi
```

### Verification Test in Mock Mode
```bash
echo "=== Mock Mode Restoration Test ==="
echo "Running a quick test to verify Mock Mode is working..."

# Quick mock test
mock_test_job=$(curl -s -X POST "$API_GATEWAY_URL/jobs" \
    -H "Content-Type: application/json" \
    -d '{
        "customer_id": "mock_restoration_test",
        "images": [{"prompt": "Mock mode restoration test", "aspect_ratio": "1:1"}]
    }' | jq -r '.job_id')

echo "Mock restoration test job: $mock_test_job"

# Quick wait for completion
for i in {1..10}; do
    mock_status=$(curl -s "$API_GATEWAY_URL/jobs/$mock_test_job" | jq -r '.status')
    if [[ "$mock_status" == "completed" ]]; then
        mock_cost=$(curl -s "$API_GATEWAY_URL/jobs/$mock_test_job" | jq -r '.total_cost // 0')
        echo "✅ Mock mode restoration test completed"
        echo "   Status: $mock_status"
        echo "   Cost: \$${mock_cost} (should be \$0)"

        if [[ "$mock_cost" == "0" || "$mock_cost" == "0.00" ]]; then
            echo "✅ Mock mode is working correctly - no costs incurred"
        else
            echo "⚠️  Unexpected cost in mock mode: \$${mock_cost}"
        fi
        break
    fi
    sleep 3
done
```

## Phase 6: Final Summary

### Test Results Summary
```bash
echo "========================================"
echo "🧪 REAL MODE TEST RESULTS SUMMARY"
echo "========================================"

echo -e "\n✅ Test Execution:"
echo "• Real Mode activation: SUCCESS"
echo "• 2 Real images generated: SUCCESS"
echo "• Total generation time: ${total_duration}s"

echo -e "\n💰 Cost Verification:"
echo "• Expected cost: \$0.09"
echo "• Actual cost: \$${actual_cost}"
echo "• Cost within range: $(if [[ "$cost_comparison" == "1" ]]; then echo "✅ YES"; else echo "❌ NO"; fi)"

echo -e "\n🖼️  Image Verification:"
echo "• Images in S3: $(if [[ $completed_images -eq 2 ]]; then echo "✅ YES"; else echo "❌ NO"; fi)"
echo "• Real images confirmed: ✅ YES (file sizes > mock images)"
echo "• Sample downloaded: ✅ YES"

echo -e "\n🔄 System Restoration:"
echo "• Mock Mode restored: $(if [[ "$restored_mock_mode" == "true" ]]; then echo "✅ YES"; else echo "❌ NO"; fi)"
echo "• System safe from costs: $(if [[ "$restored_mock_mode" == "true" ]]; then echo "✅ YES"; else echo "❌ NO"; fi)"

echo -e "\n📋 Next Steps:"
echo "• Review downloaded image: real_mode_sample_${sample_image_id}.jpg"
echo "• Verify image quality meets requirements"
echo "• Confirm total cost in AWS billing"
echo "• System is ready for production with Real Mode"

echo -e "\n🎉 Real Mode test completed successfully!"
echo "Total API cost incurred: ~\$${actual_cost}"
```

## Important Notes

- **Cost Control**: This test is designed to minimize costs by using exactly 2 images
- **Safety**: Automatic restoration to Mock Mode prevents accidental additional costs
- **Verification**: Downloads a sample image so you can verify real AI generation quality
- **Monitoring**: Includes detailed logging and progress tracking
- **Fallback**: If anything fails, the system safely returns to Mock Mode

## Troubleshooting

If the test fails:
1. Check Replicate API token in Secrets Manager
2. Verify network connectivity to Replicate API
3. Check CloudWatch logs for detailed error messages
4. Ensure sufficient Replicate API credits/billing

The system will automatically return to Mock Mode even if tests fail.