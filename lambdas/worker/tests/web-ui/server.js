/**
 * Simple Web UI Test Server
 * Local web interface for testing Worker Lambda with visual feedback
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Mock AWS services
const MockS3 = require('../local/mock-s3');
const MockDynamoDB = require('../local/mock-dynamodb');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../../.env.local') });

// Override AWS SDK with mocks
const AWS = require('aws-sdk');
const mockS3 = new MockS3();
const mockDynamoDB = new MockDynamoDB();

AWS.S3 = class { constructor() { return mockS3; } };
AWS.DynamoDB.DocumentClient = class { constructor() { return mockDynamoDB; } };
AWS.Rekognition = class {
    detectModerationLabels() {
        return { promise: () => Promise.resolve({ ModerationLabels: [] }) };
    }
    detectText() {
        return { promise: () => Promise.resolve({ TextDetections: [] }) };
    }
    detectLabels() {
        return {
            promise: () => Promise.resolve({
                Labels: [
                    { Name: 'Outdoors', Confidence: 95 },
                    { Name: 'Nature', Confidence: 92 }
                ]
            })
        };
    }
};

// Force local dev mode
process.env.IS_LOCAL_DEV = 'true';
process.env.DYNAMODB_TABLE = 'RDAImageJobs-local';
process.env.S3_BUCKET = 'rda-images-local';

const app = express();
const PORT = 3000;

// Configure multer for file uploads (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize mock services
let initialized = false;
async function initializeMocks() {
    if (initialized) return;
    await mockS3.initialize();
    await mockDynamoDB.initialize();
    initialized = true;
}

/**
 * POST /api/generate
 * Generate image with optional input images
 */
app.post('/api/generate', upload.array('inputImages', 10), async (req, res) => {
    try {
        await initializeMocks();

        const { prompt, aspectRatio, mockMode } = req.body;
        const inputFiles = req.files || [];

        // Set MOCK_MODE environment variable
        process.env.MOCK_MODE = mockMode === 'true' ? 'true' : 'false';

        // Clear require cache and reload worker module
        delete require.cache[require.resolve('../../index')];
        const worker = require('../../index');

        console.log('\n📸 Web UI Request:');
        console.log(`Mode: ${mockMode === 'true' ? 'MOCK' : 'REAL'}`);
        console.log(`Prompt: "${prompt}"`);
        console.log(`Aspect Ratio: ${aspectRatio}`);
        console.log(`Input Images: ${inputFiles.length}`);

        // Save uploaded files temporarily
        const inputImagePaths = [];
        for (let i = 0; i < inputFiles.length; i++) {
            const file = inputFiles[i];
            const tempPath = path.join(__dirname, '../local/output/uploads', `upload-${Date.now()}-${i}${path.extname(file.originalname)}`);
            await fs.mkdir(path.dirname(tempPath), { recursive: true });
            await fs.writeFile(tempPath, file.buffer);
            inputImagePaths.push(tempPath);
            console.log(`  Saved: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB)`);
        }

        // Create test message
        const jobId = `test-job-${Date.now()}`;
        const imageId = `img-${Date.now()}`;

        const message = {
            job_id: jobId,
            customer_id: 'test-customer',
            image_id: imageId,
            image_index: 0,
            aspect_ratio: aspectRatio,
            prompt: prompt,
            input_images: inputImagePaths,
            created_at: new Date().toISOString()
        };

        const startTime = Date.now();

        // Call worker Lambda
        const result = await worker.handler({
            Records: [{
                messageId: 'test-message-1',
                body: JSON.stringify(message)
            }]
        });

        const duration = Date.now() - startTime;

        // Get the generated image path
        const outputPath = path.join(__dirname, '../local/output/s3/rda-images-local/test-customer', jobId, `${imageId}_v1.jpg`);
        const imageExists = await fs.access(outputPath).then(() => true).catch(() => false);

        // Get metadata from DynamoDB
        const table = await mockDynamoDB.loadTable('RDAImageJobs-local');
        const imageRecord = table.items.find(item => item.PK === jobId && item.SK === 'IMAGE#001');

        res.json({
            success: true,
            jobId,
            imageId,
            duration,
            mode: mockMode === 'true' ? 'mock' : 'real',
            cost: mockMode === 'true' ? 0 : 0.003,
            outputPath: imageExists ? `/api/image/${jobId}/${imageId}` : null,
            metadata: imageRecord || null,
            inputImages: inputFiles.map(f => ({
                name: f.originalname,
                size: f.size
            }))
        });

        // Clean up uploaded files
        for (const tempPath of inputImagePaths) {
            await fs.unlink(tempPath).catch(() => {});
        }

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * GET /api/image/:jobId/:imageId
 * Retrieve generated image
 */
app.get('/api/image/:jobId/:imageId', async (req, res) => {
    try {
        const { jobId, imageId } = req.params;
        const imagePath = path.join(__dirname, '../local/output/s3/rda-images-local/test-customer', jobId, `${imageId}_v1.jpg`);

        const exists = await fs.access(imagePath).then(() => true).catch(() => false);
        if (!exists) {
            return res.status(404).json({ error: 'Image not found' });
        }

        res.sendFile(imagePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/results
 * Get all test results
 */
app.get('/api/results', async (req, res) => {
    try {
        await initializeMocks();
        const table = await mockDynamoDB.loadTable('RDAImageJobs-local');

        // Group by job
        const jobs = {};
        table.items.forEach(item => {
            if (!jobs[item.PK]) {
                jobs[item.PK] = [];
            }
            jobs[item.PK].push(item);
        });

        res.json({
            success: true,
            count: Object.keys(jobs).length,
            jobs: jobs
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/results
 * Clear all test data
 */
app.delete('/api/results', async (req, res) => {
    try {
        await initializeMocks();
        await mockDynamoDB.clearTable('RDAImageJobs-local');

        // Clear S3 output
        const outputDir = path.join(__dirname, '../local/output/s3');
        await fs.rm(outputDir, { recursive: true, force: true });
        await fs.mkdir(outputDir, { recursive: true });

        res.json({ success: true, message: 'All test data cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('\n🌐 Web UI Test Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Open your browser to: http://localhost:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Features:');
    console.log('  ✅ Visual image upload (drag & drop)');
    console.log('  ✅ Real-time prompt enhancement preview');
    console.log('  ✅ Mock/Real mode toggle');
    console.log('  ✅ Side-by-side image comparison');
    console.log('  ✅ Test history viewer');
    console.log('\nPress Ctrl+C to stop the server\n');
});
