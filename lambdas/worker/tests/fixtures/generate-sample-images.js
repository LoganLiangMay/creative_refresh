/**
 * Generate Sample Input Images for Testing
 * Creates realistic-looking sample images for testing multi-modal image generation
 */

const { createCanvas } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'input-images');

/**
 * Create a product photo sample
 */
function createProductPhoto() {
    const canvas = createCanvas(800, 800);
    const ctx = canvas.getContext('2d');

    // Background - neutral gradient
    const gradient = ctx.createLinearGradient(0, 0, 800, 800);
    gradient.addColorStop(0, '#f5f5f5');
    gradient.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 800);

    // Product (simplified coffee mug representation)
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(400, 650, 120, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mug body
    const mugGradient = ctx.createLinearGradient(300, 200, 500, 600);
    mugGradient.addColorStop(0, '#8B4513');
    mugGradient.addColorStop(0.5, '#A0522D');
    mugGradient.addColorStop(1, '#704214');
    ctx.fillStyle = mugGradient;
    ctx.fillRect(300, 300, 200, 300);

    // Mug handle
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(500, 400, 50, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Mug rim (highlight)
    ctx.fillStyle = '#D2691E';
    ctx.fillRect(300, 280, 200, 20);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SAMPLE', 400, 450);
    ctx.font = '20px Arial';
    ctx.fillText('Product Photo', 400, 480);

    return canvas;
}

/**
 * Create a brand logo sample
 */
function createBrandLogo() {
    const canvas = createCanvas(600, 600);
    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.clearRect(0, 0, 600, 600);

    // Logo circle
    const logoGradient = ctx.createRadialGradient(300, 300, 50, 300, 300, 150);
    logoGradient.addColorStop(0, '#FF6B35');
    logoGradient.addColorStop(1, '#F7931E');
    ctx.fillStyle = logoGradient;
    ctx.beginPath();
    ctx.arc(300, 300, 150, 0, Math.PI * 2);
    ctx.fill();

    // Logo text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BRAND', 300, 280);

    ctx.font = '24px Arial';
    ctx.fillText('TEST LOGO', 300, 330);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(300, 300, 145, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
}

/**
 * Create a stock image sample
 */
function createStockImage() {
    const canvas = createCanvas(1200, 800);
    const ctx = canvas.getContext('2d');

    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 400);
    skyGradient.addColorStop(0, '#4A90E2');
    skyGradient.addColorStop(1, '#7BB3E8');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, 1200, 400);

    // Ground
    const groundGradient = ctx.createLinearGradient(0, 400, 0, 800);
    groundGradient.addColorStop(0, '#90C856');
    groundGradient.addColorStop(1, '#6FA82C');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, 400, 1200, 400);

    // Mountains
    ctx.fillStyle = '#5A7D9A';
    ctx.beginPath();
    ctx.moveTo(0, 400);
    ctx.lineTo(300, 200);
    ctx.lineTo(600, 400);
    ctx.fill();

    ctx.fillStyle = '#4A6D8A';
    ctx.beginPath();
    ctx.moveTo(400, 400);
    ctx.lineTo(700, 150);
    ctx.lineTo(1000, 400);
    ctx.fill();

    // Sun
    ctx.fillStyle = '#FDB813';
    ctx.beginPath();
    ctx.arc(900, 150, 60, 0, Math.PI * 2);
    ctx.fill();

    // Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STOCK IMAGE', 600, 400);

    return canvas;
}

/**
 * Create a basic test image
 */
function createTestImage() {
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');

    // Checkerboard pattern
    const squareSize = 50;
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#333333' : '#CCCCCC';
            ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
        }
    }

    // Center circle
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(200, 200, 80, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEST', 200, 200);

    return canvas;
}

/**
 * Main execution
 */
async function generateSamples() {
    console.log('🎨 Generating Sample Input Images...\n');

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const samples = [
        { name: 'product-photo.jpg', generator: createProductPhoto, type: 'image/jpeg' },
        { name: 'brand-logo.png', generator: createBrandLogo, type: 'image/png' },
        { name: 'stock-image.jpg', generator: createStockImage, type: 'image/jpeg' },
        { name: 'test-image.jpg', generator: createTestImage, type: 'image/jpeg' }
    ];

    for (const sample of samples) {
        const canvas = sample.generator();
        const buffer = sample.type === 'image/png'
            ? canvas.toBuffer('image/png')
            : canvas.toBuffer('image/jpeg', { quality: 0.95 });

        const filePath = path.join(OUTPUT_DIR, sample.name);
        await fs.writeFile(filePath, buffer);

        console.log(`✅ Created ${sample.name} (${buffer.length} bytes)`);
    }

    console.log(`\n✅ All sample images generated in: ${OUTPUT_DIR}`);
}

// Run if called directly
if (require.main === module) {
    generateSamples().catch(error => {
        console.error('❌ Failed to generate samples:', error);
        process.exit(1);
    });
}

module.exports = { generateSamples };
