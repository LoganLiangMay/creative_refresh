/**
 * Local Test Runner
 * Run Worker Lambda locally without AWS deployment
 *
 * Usage:
 *   node tests/local/local-runner.js [options]
 *
 * Options:
 *   --mock-mode         Use mock mode (free, no API calls)
 *   --real-mode         Use real Replicate API (costs money)
 *   --clear             Clear previous test data
 *   --prompt "..."      Custom prompt
 *   --aspect-ratio      1:1 or 1.91:1
 *   --input-image       Path to input image (for multi-modal)
 */

const path = require('path');
const fs = require('fs').promises;

// Mock AWS services
const MockS3 = require('./mock-s3');
const MockDynamoDB = require('./mock-dynamodb');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '../../../../.env.local') });

// Override AWS SDK with mocks for local testing
const AWS = require('aws-sdk');
const mockS3 = new MockS3();
const mockDynamoDB = new MockDynamoDB();

// Patch AWS SDK
AWS.S3 = class { constructor() { return mockS3; } };
AWS.DynamoDB.DocumentClient = class { constructor() { return mockDynamoDB; } };
AWS.Rekognition = class {
    detectModerationLabels() {
        return {
            promise: () => Promise.resolve({ ModerationLabels: [] })
        };
    }
    detectText() {
        return {
            promise: () => Promise.resolve({ TextDetections: [] })
        };
    }
    detectLabels() {
        return {
            promise: () => Promise.resolve({
                Labels: [
                    { Name: 'Outdoors', Confidence: 95 },
                    { Name: 'Nature', Confidence: 92 },
                    { Name: 'Sky', Confidence: 88 }
                ]
            })
        };
    }
};

// Force local dev mode
process.env.IS_LOCAL_DEV = 'true';
process.env.DYNAMODB_TABLE = 'RDAImageJobs-local';
process.env.S3_BUCKET = 'rda-images-local';

// IMPORTANT: Set MOCK_MODE from command line args BEFORE requiring worker
// The worker module reads MOCK_MODE when it's first loaded
const args = process.argv.slice(2);
const shouldUseMockMode = !args.includes('--real-mode');
process.env.MOCK_MODE = shouldUseMockMode ? 'true' : 'false';

// Now require the worker Lambda (AFTER setting MOCK_MODE)
const worker = require('../../index');

class LocalTestRunner {
    constructor(options = {}) {
        this.options = {
            mockMode: options.mockMode !== false,
            clearData: options.clearData || false,
            prompt: options.prompt || 'A beautiful professional product photograph',
            aspectRatio: options.aspectRatio || '1:1',
            inputImages: options.inputImages || [],
            ...options
        };
    }

    /**
     * Initialize local environment
     */
    async initialize() {
        console.log('\n🚀 Local Test Runner Starting...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Mode: ${this.options.mockMode ? '🎭 MOCK (Free)' : '💰 REAL (Costs Money)'}`);
        console.log(`Prompt: "${this.options.prompt}"`);
        console.log(`Aspect Ratio: ${this.options.aspectRatio}`);
        console.log(`Input Images: ${this.options.inputImages.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Initialize mock services
        await mockS3.initialize();
        await mockDynamoDB.initialize();

        // Clear previous data if requested
        if (this.options.clearData) {
            await mockS3.clear();
            await mockDynamoDB.clear();
            console.log('✅ Cleared previous test data\n');
        }

        // Update MOCK_MODE based on options and reload worker module
        // This is needed when using the interactive tool or programmatic API
        const newMockMode = this.options.mockMode ? 'true' : 'false';
        if (process.env.MOCK_MODE !== newMockMode) {
            process.env.MOCK_MODE = newMockMode;
            // Clear require cache and reload worker to pick up new MOCK_MODE
            delete require.cache[require.resolve('../../index')];
            const reloadedWorker = require('../../index');
            // Update the module.exports to use the reloaded version
            Object.assign(worker, reloadedWorker);
        }
    }

    /**
     * Run a single test
     */
    async runTest(testConfig = {}) {
        const jobId = `test-job-${Date.now()}`;
        const customerId = 'test-customer';
        const imageId = `img-${Date.now()}`;

        const message = {
            job_id: jobId,
            customer_id: customerId,
            image_id: imageId,
            image_index: 0,
            aspect_ratio: testConfig.aspectRatio || this.options.aspectRatio || '1:1',
            prompt: testConfig.prompt || this.options.prompt,
            input_images: testConfig.inputImages || this.options.inputImages,
            created_at: new Date().toISOString()
        };

        console.log('📦 Test Message:', JSON.stringify(message, null, 2));
        console.log('');

        const startTime = Date.now();

        try {
            // Create SQS-like event
            const event = {
                Records: [{
                    body: JSON.stringify(message)
                }]
            };

            // Run the Lambda handler
            const result = await worker.handler(event);

            const duration = Date.now() - startTime;

            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ TEST COMPLETED SUCCESSFULLY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Duration: ${duration}ms`);
            console.log(`Job ID: ${jobId}`);
            console.log(`Image ID: ${imageId}`);
            console.log('');

            // Show where files are saved
            const outputBase = path.join(__dirname, 'output');
            console.log('📁 Output Locations:');
            console.log(`   Images: ${path.join(outputBase, 's3', 'rda-images-local', customerId, jobId)}`);
            console.log(`   Metadata: ${path.join(outputBase, 'dynamodb', 'RDAImageJobs-local.json')}`);
            console.log('');

            return {
                success: true,
                jobId,
                imageId,
                duration,
                result
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('❌ TEST FAILED');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Duration: ${duration}ms`);
            console.log(`Error: ${error.message}`);
            console.log('');
            console.error('Full Error:', error);
            console.log('');

            return {
                success: false,
                jobId,
                imageId,
                duration,
                error: error.message
            };
        }
    }

    /**
     * Run multiple tests
     */
    async runMultiple(count = 3, options = {}) {
        console.log(`\n🔄 Running ${count} tests...\n`);

        const results = [];
        for (let i = 0; i < count; i++) {
            console.log(`\n[Test ${i + 1}/${count}]\n`);
            const result = await this.runTest({
                prompt: options.prompts ? options.prompts[i] : `${this.options.prompt} (${i + 1})`,
                ...options
            });
            results.push(result);

            if (i < count - 1) {
                // Brief pause between tests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TEST SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total Tests: ${count}`);
        console.log(`Successful: ${successful} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Average Duration: ${avgDuration.toFixed(0)}ms`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return results;
    }

    /**
     * View test results
     */
    async viewResults() {
        console.log('\n📊 Viewing Test Results...\n');

        // Load DynamoDB data
        const table = await mockDynamoDB.loadTable('RDAImageJobs-local');
        console.log(`Found ${table.items.length} items in DynamoDB\n`);

        // Group by job
        const jobs = {};
        table.items.forEach(item => {
            if (!jobs[item.PK]) {
                jobs[item.PK] = [];
            }
            jobs[item.PK].push(item);
        });

        // Display each job
        Object.keys(jobs).forEach(jobId => {
            const items = jobs[jobId];
            console.log(`Job: ${jobId}`);
            items.forEach(item => {
                if (item.SK.startsWith('IMAGE#')) {
                    console.log(`  └─ ${item.SK}: ${item.status} - ${item.s3_url || 'N/A'}`);
                }
            });
            console.log('');
        });

        return jobs;
    }

    /**
     * Export results to JSON
     */
    async exportResults(outputPath) {
        const table = await mockDynamoDB.loadTable('RDAImageJobs-local');
        await fs.writeFile(outputPath, JSON.stringify(table.items, null, 2));
        console.log(`✅ Exported ${table.items.length} items to ${outputPath}`);
        return table.items;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);

    // Collect all --input-image arguments (can be specified multiple times)
    const inputImages = [];
    args.forEach((arg, i) => {
        if (args[i - 1] === '--input-image') {
            inputImages.push(arg);
        }
    });

    const options = {
        mockMode: !args.includes('--real-mode'),
        clearData: args.includes('--clear'),
        prompt: args.find((arg, i) => args[i - 1] === '--prompt') || undefined,
        aspectRatio: args.find((arg, i) => args[i - 1] === '--aspect-ratio') || undefined,
        inputImages: inputImages.length > 0 ? inputImages : undefined,
    };

    const runner = new LocalTestRunner(options);

    runner.initialize()
        .then(() => runner.runTest())
        .then(() => runner.viewResults())
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = LocalTestRunner;
