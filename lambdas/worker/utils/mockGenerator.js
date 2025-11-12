/**
 * Mock Image Generator Module
 * Alternative implementation from TECH_STACK.md Section 3.3.1
 *
 * Generates SVG-based mock images for zero-cost testing
 */

const sharp = require('sharp');

class MockGenerator {
    /**
     * Generate a mock image for testing
     * @param {string} aspectRatio - Either '1.91:1' or '1:1'
     * @param {string} prompt - The original prompt (for display)
     * @param {number} imageIndex - Index of the image in the batch
     * @param {Array} inputImages - Optional input images for multi-modal generation
     * @returns {Promise<{buffer: Buffer, generationTime: number}>}
     */
    static async generateImage(aspectRatio, prompt, imageIndex, inputImages = []) {
        const startTime = Date.now();

        // Simulate processing delay (500-1000ms for mock, NOT 30-60s like real)
        // Add extra time if input images provided (to simulate multi-modal processing)
        const baseDelay = inputImages.length > 0 ? 1000 : 500;
        const maxDelay = inputImages.length > 0 ? 2000 : 1000;
        await this.simulateDelay(baseDelay, maxDelay);

        // Determine dimensions
        let width, height;
        if (aspectRatio === '1.91:1') {
            width = 1200;
            height = 628;
        } else if (aspectRatio === '1:1') {
            width = 1200;
            height = 1200;
        } else {
            throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
        }

        // Create SVG with mock content
        const svg = this.createSVG(width, height, aspectRatio, prompt, imageIndex, inputImages);

        // Convert SVG to JPEG buffer using Sharp
        const buffer = await sharp(Buffer.from(svg))
            .jpeg({
                quality: 85,
                progressive: true
            })
            .toBuffer();

        const generationTime = Date.now() - startTime;

        console.log(`Mock image ${imageIndex + 1} generated in ${generationTime}ms for aspect ratio ${aspectRatio}`);

        return {
            buffer,
            generationTime
        };
    }

    /**
     * Create SVG markup for mock image
     * @private
     */
    static createSVG(width, height, aspectRatio, prompt, imageIndex, inputImages = []) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
        const truncatedPrompt = prompt.substring(0, 60) + (prompt.length > 60 ? '...' : '');
        const isMultiModal = inputImages.length > 0;

        // Calculate font sizes based on image dimensions
        const titleFontSize = Math.min(width, height) * 0.06; // 6% of smaller dimension
        const subtitleFontSize = titleFontSize * 0.6;
        const detailsFontSize = titleFontSize * 0.4;
        const promptFontSize = titleFontSize * 0.35;

        // SVG with blue background and white text
        const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Blue background -->
    <rect width="${width}" height="${height}" fill="#4A90E2"/>

    <!-- Decorative border -->
    <rect x="20" y="20" width="${width - 40}" height="${height - 40}"
          fill="none" stroke="white" stroke-width="3" stroke-dasharray="10,5" opacity="0.5"/>

    <!-- Center group for text -->
    <g text-anchor="middle" fill="white">
        <!-- Main title -->
        <text x="${width / 2}" y="${height * 0.35}"
              font-family="Arial, sans-serif" font-size="${titleFontSize}" font-weight="bold">
            Mock RDA Image
        </text>

        <!-- Aspect ratio -->
        <text x="${width / 2}" y="${height * 0.45}"
              font-family="Arial, sans-serif" font-size="${subtitleFontSize}">
            ${aspectRatio} (${width}×${height})
        </text>

        <!-- Image number and timestamp -->
        <text x="${width / 2}" y="${height * 0.52}"
              font-family="Arial, sans-serif" font-size="${detailsFontSize}" opacity="0.8">
            Image #${imageIndex + 1} • ${timestamp}
        </text>

        <!-- Prompt preview -->
        <text x="${width / 2}" y="${height * 0.60}"
              font-family="Arial, sans-serif" font-size="${promptFontSize}" opacity="0.6">
            "${truncatedPrompt}"
        </text>

        <!-- Multi-modal indicator (if input images provided) -->
        ${isMultiModal ? `
        <text x="${width / 2}" y="${height * 0.67}"
              font-family="Arial, sans-serif" font-size="${detailsFontSize}" fill="#66FF66" opacity="0.9">
            🖼️  Multi-Modal (${inputImages.length} input image${inputImages.length > 1 ? 's' : ''})
        </text>
        ` : ''}

        <!-- Mock mode indicator -->
        <text x="${width / 2}" y="${height * (isMultiModal ? 0.75 : 0.70)}"
              font-family="Arial, sans-serif" font-size="${detailsFontSize}" fill="#FFE066">
            ⚡ MOCK MODE - $0.00 ⚡
        </text>
    </g>

    <!-- Corner badges -->
    <g>
        <!-- Top-left: Environment -->
        <rect x="0" y="0" width="120" height="40" fill="rgba(0,0,0,0.3)"/>
        <text x="10" y="25" font-family="Arial, sans-serif" font-size="14" fill="white">
            DEV MODE
        </text>

        <!-- Top-right: RDA Compliant -->
        <rect x="${width - 150}" y="0" width="150" height="40" fill="rgba(0,255,0,0.2)"/>
        <text x="${width - 140}" y="25" font-family="Arial, sans-serif" font-size="14" fill="white">
            ✓ RDA Compliant
        </text>

        <!-- Bottom-left: No Text Overlay -->
        <rect x="0" y="${height - 40}" width="150" height="40" fill="rgba(0,0,0,0.3)"/>
        <text x="10" y="${height - 15}" font-family="Arial, sans-serif" font-size="14" fill="white">
            No Text Overlay
        </text>

        <!-- Bottom-right: Mock indicator -->
        <rect x="${width - 120}" y="${height - 40}" width="120" height="40" fill="rgba(255,0,0,0.2)"/>
        <text x="${width - 110}" y="${height - 15}" font-family="Arial, sans-serif" font-size="14" fill="white">
            MOCK
        </text>
    </g>

    <!-- Grid pattern for visual interest -->
    <defs>
        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" stroke-width="1" opacity="0.1"/>
        </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grid)"/>
</svg>`;

        return svg.trim();
    }

    /**
     * Simulate processing delay
     * @param {number} minMs - Minimum delay in milliseconds
     * @param {number} maxMs - Maximum delay in milliseconds
     * @returns {Promise<void>}
     */
    static async simulateDelay(minMs, maxMs) {
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    /**
     * Generate a placeholder URL (fallback method)
     * @param {string} aspectRatio - Either '1.91:1' or '1:1'
     * @returns {string} Placeholder service URL
     */
    static getPlaceholderUrl(aspectRatio) {
        if (aspectRatio === '1.91:1') {
            return 'https://via.placeholder.com/1200x628/4A90E2/FFFFFF?text=Mock+RDA+Image+1.91:1';
        } else if (aspectRatio === '1:1') {
            return 'https://via.placeholder.com/1200x1200/4A90E2/FFFFFF?text=Mock+RDA+Image+1:1';
        } else {
            throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
        }
    }
}

module.exports = MockGenerator;