/**
 * Image Processor Utility
 * Handles input image processing for multi-modal image generation
 *
 * Features:
 * - Read images from local file paths or URLs
 * - Convert to base64 data URLs for Replicate API
 * - Validate image format and size
 * - Support multiple input images
 * - Comprehensive error handling
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
    MAX_IMAGES: 10
};

/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    };
    return mimeMap[ext] || null;
}

/**
 * Validate image format
 */
function validateFormat(mimeType, filePath) {
    if (!mimeType) {
        throw new Error(`Unsupported file extension: ${path.extname(filePath)}`);
    }
    if (!CONFIG.SUPPORTED_FORMATS.includes(mimeType)) {
        throw new Error(`Unsupported image format: ${mimeType}. Supported: ${CONFIG.SUPPORTED_FORMATS.join(', ')}`);
    }
}

/**
 * Validate file size
 */
function validateSize(size, filePath) {
    if (size > CONFIG.MAX_FILE_SIZE) {
        const sizeMB = (size / 1024 / 1024).toFixed(2);
        const maxMB = (CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(2);
        throw new Error(`Image too large: ${sizeMB}MB (max: ${maxMB}MB) - ${filePath}`);
    }
}

/**
 * Read image from URL
 */
function readImageFromURL(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = 30000; // 30 seconds

        const req = protocol.get(url, { timeout }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage} - ${url}`));
                return;
            }

            const chunks = [];
            let size = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                size += chunk.length;

                // Check size limit while downloading
                if (size > CONFIG.MAX_FILE_SIZE) {
                    req.destroy();
                    reject(new Error(`Image too large while downloading (max: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB) - ${url}`));
                }
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'];
                resolve({ buffer, contentType, size });
            });

            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout (${timeout}ms) - ${url}`));
        });

        req.on('error', reject);
    });
}

/**
 * Read image from local file
 */
async function readImageFromFile(filePath) {
    try {
        const stats = await fs.stat(filePath);
        validateSize(stats.size, filePath);

        const buffer = await fs.readFile(filePath);
        const contentType = getMimeType(filePath);

        return { buffer, contentType, size: stats.size };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found: ${filePath}`);
        }
        throw error;
    }
}

/**
 * Process a single image
 * @param {string} source - File path or URL
 * @returns {Promise<{dataUrl: string, source: string, size: number, format: string}>}
 */
async function processImage(source) {
    console.log(`📸 Processing image: ${source}`);

    let imageData;

    // Determine if source is URL or file path
    if (source.startsWith('http://') || source.startsWith('https://')) {
        imageData = await readImageFromURL(source);
    } else {
        imageData = await readImageFromFile(source);
    }

    const { buffer, contentType, size } = imageData;

    // Validate format
    validateFormat(contentType, source);

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`✅ Processed ${path.basename(source)} - ${contentType}, ${(size / 1024).toFixed(1)}KB`);

    return {
        dataUrl,
        source,
        size,
        format: contentType
    };
}

/**
 * Process multiple images
 * @param {string[]} sources - Array of file paths or URLs
 * @returns {Promise<Array>}
 */
async function processImages(sources) {
    if (!sources || sources.length === 0) {
        return [];
    }

    if (sources.length > CONFIG.MAX_IMAGES) {
        throw new Error(`Too many input images: ${sources.length} (max: ${CONFIG.MAX_IMAGES})`);
    }

    console.log(`📸 Processing ${sources.length} input image(s)...`);

    const results = [];
    for (const source of sources) {
        try {
            const result = await processImage(source);
            results.push(result);
        } catch (error) {
            console.error(`❌ Failed to process ${source}:`, error.message);
            throw new Error(`Failed to process image: ${source} - ${error.message}`);
        }
    }

    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    console.log(`✅ Processed ${results.length} images (total: ${(totalSize / 1024).toFixed(1)}KB)`);

    return results;
}

/**
 * Extract data URLs from processed images
 * @param {Array} processedImages - Results from processImages()
 * @returns {string[]}
 */
function extractDataUrls(processedImages) {
    return processedImages.map(img => img.dataUrl);
}

/**
 * Validate image array for Replicate API
 */
function validateForReplicate(processedImages) {
    if (processedImages.length === 0) {
        return { valid: true };
    }

    // Check total payload size (base64 encoded is ~33% larger than original)
    const totalSize = processedImages.reduce((sum, img) => sum + img.size, 0);
    const estimatedPayloadSize = totalSize * 1.33;
    const maxPayloadSize = 5 * 1024 * 1024; // 5MB recommended limit

    if (estimatedPayloadSize > maxPayloadSize) {
        return {
            valid: false,
            error: `Total image size too large: ${(estimatedPayloadSize / 1024 / 1024).toFixed(2)}MB (recommended max: 5MB)`
        };
    }

    return { valid: true };
}

/**
 * Get image info without processing
 */
async function getImageInfo(source) {
    try {
        let size, format;

        if (source.startsWith('http://') || source.startsWith('https://')) {
            const { buffer, contentType } = await readImageFromURL(source);
            size = buffer.length;
            format = contentType;
        } else {
            const stats = await fs.stat(source);
            size = stats.size;
            format = getMimeType(source);
        }

        return {
            source,
            size,
            format,
            sizeKB: (size / 1024).toFixed(1),
            sizeMB: (size / 1024 / 1024).toFixed(2)
        };
    } catch (error) {
        throw new Error(`Failed to get image info: ${source} - ${error.message}`);
    }
}

/**
 * Main export - convenience function
 */
async function prepareInputImages(sources) {
    if (!sources || sources.length === 0) {
        return {
            dataUrls: [],
            images: [],
            totalSize: 0
        };
    }

    const processedImages = await processImages(sources);
    const validation = validateForReplicate(processedImages);

    if (!validation.valid) {
        throw new Error(validation.error);
    }

    return {
        dataUrls: extractDataUrls(processedImages),
        images: processedImages,
        totalSize: processedImages.reduce((sum, img) => sum + img.size, 0)
    };
}

module.exports = {
    processImage,
    processImages,
    prepareInputImages,
    extractDataUrls,
    validateForReplicate,
    getImageInfo,
    CONFIG
};
