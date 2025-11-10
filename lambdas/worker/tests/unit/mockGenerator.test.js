/**
 * MockGenerator Module Unit Tests
 * Tests for the SVG-based mock image generator
 */

// Mock sharp before requiring the module
jest.mock('sharp');
const sharp = require('sharp');

const MockGenerator = require('../../utils/mockGenerator');

describe('MockGenerator', () => {
    beforeEach(() => {
        // Mock console to reduce noise
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Set up sharp mock
        const mockSharpInstance = {
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data'))
        };
        sharp.mockReturnValue(mockSharpInstance);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateImage', () => {
        it('should generate landscape mock image with correct dimensions', async () => {
            const result = await MockGenerator.generateImage('1.91:1', 'Test prompt for landscape', 0);

            expect(result.buffer).toBeDefined();
            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.generationTime).toBeGreaterThanOrEqual(500);
            expect(result.generationTime).toBeLessThanOrEqual(1500); // Allow some overhead

            // Verify sharp was called with SVG containing correct dimensions
            expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
            const svgBuffer = sharp.mock.calls[0][0];
            const svgContent = svgBuffer.toString();

            expect(svgContent).toContain('width="1200"');
            expect(svgContent).toContain('height="628"');
            expect(svgContent).toContain('1.91:1');
            expect(svgContent).toContain('Mock RDA Image');
        });

        it('should generate square mock image with correct dimensions', async () => {
            const result = await MockGenerator.generateImage('1:1', 'Test prompt for square', 1);

            expect(result.buffer).toBeDefined();
            expect(result.generationTime).toBeGreaterThanOrEqual(500);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            expect(svgContent).toContain('width="1200"');
            expect(svgContent).toContain('height="1200"');
            expect(svgContent).toContain('1:1 (1200×1200)');
            expect(svgContent).toContain('Image #2'); // Index 1 + 1
        });

        it('should include prompt text in SVG', async () => {
            const longPrompt = 'This is a very long prompt that should be truncated after 60 characters for display purposes in the mock image';
            const result = await MockGenerator.generateImage('1.91:1', longPrompt, 5);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            // Should truncate long prompts - check for truncation indicator
            expect(svgContent).toContain('...');
            expect(svgContent).toContain('Image #6'); // Index 5 + 1
        });

        it('should include mock mode indicators', async () => {
            const result = await MockGenerator.generateImage('1:1', 'Test', 0);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            expect(svgContent).toContain('MOCK MODE - $0.00');
            expect(svgContent).toContain('DEV MODE');
            expect(svgContent).toContain('RDA Compliant');
            expect(svgContent).toContain('No Text Overlay');
            expect(svgContent).toContain('MOCK');
        });

        it('should use blue background color', async () => {
            const result = await MockGenerator.generateImage('1.91:1', 'Test', 0);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            expect(svgContent).toContain('fill="#4A90E2"'); // Blue background
        });

        it('should throw error for unsupported aspect ratio', async () => {
            await expect(
                MockGenerator.generateImage('16:9', 'Test', 0)
            ).rejects.toThrow('Unsupported aspect ratio: 16:9');
        });

        it('should convert SVG to JPEG with correct quality', async () => {
            await MockGenerator.generateImage('1:1', 'Test', 0);

            const sharpInstance = sharp();
            expect(sharpInstance.jpeg).toHaveBeenCalledWith({
                quality: 85,
                progressive: true
            });
        });
    });

    describe('simulateDelay', () => {
        it('should simulate delay within specified range', async () => {
            const startTime = Date.now();
            const delay = await MockGenerator.simulateDelay(100, 200);
            const elapsed = Date.now() - startTime;

            expect(delay).toBeGreaterThanOrEqual(100);
            expect(delay).toBeLessThanOrEqual(200);
            expect(elapsed).toBeGreaterThanOrEqual(100);
            expect(elapsed).toBeLessThanOrEqual(250); // Allow some overhead
        });

        it('should return different delays on multiple calls', async () => {
            const delays = [];
            for (let i = 0; i < 5; i++) {
                delays.push(await MockGenerator.simulateDelay(0, 1000));
            }

            // At least some delays should be different
            const uniqueDelays = new Set(delays);
            expect(uniqueDelays.size).toBeGreaterThan(1);
        });
    });

    describe('getPlaceholderUrl', () => {
        it('should return correct URL for landscape', () => {
            const url = MockGenerator.getPlaceholderUrl('1.91:1');
            expect(url).toBe('https://via.placeholder.com/1200x628/4A90E2/FFFFFF?text=Mock+RDA+Image+1.91:1');
        });

        it('should return correct URL for square', () => {
            const url = MockGenerator.getPlaceholderUrl('1:1');
            expect(url).toBe('https://via.placeholder.com/1200x1200/4A90E2/FFFFFF?text=Mock+RDA+Image+1:1');
        });

        it('should throw error for unsupported aspect ratio', () => {
            expect(() => MockGenerator.getPlaceholderUrl('4:3')).toThrow('Unsupported aspect ratio: 4:3');
        });
    });

    describe('SVG content structure', () => {
        it('should create valid SVG structure', async () => {
            await MockGenerator.generateImage('1.91:1', 'Test', 0);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            // Check SVG structure
            expect(svgContent).toContain('<svg');
            expect(svgContent).toContain('</svg>');
            expect(svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');

            // Check for main elements
            expect(svgContent).toContain('<rect'); // Background
            expect(svgContent).toContain('<text'); // Text elements
            expect(svgContent).toContain('<g'); // Groups
            expect(svgContent).toContain('<pattern'); // Grid pattern
        });

        it('should include decorative elements', async () => {
            await MockGenerator.generateImage('1:1', 'Test', 0);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            // Check for decorative border
            expect(svgContent).toContain('stroke-dasharray="10,5"');

            // Check for grid pattern
            expect(svgContent).toContain('id="grid"');
            expect(svgContent).toContain('url(#grid)');
        });

        it('should include timestamp', async () => {
            const beforeTime = new Date().toISOString().split('T')[1].split('.')[0];

            await MockGenerator.generateImage('1:1', 'Test', 0);

            // Get the most recent sharp call (tests run in sequence)
            const svgBuffer = sharp.mock.calls[sharp.mock.calls.length - 1][0];
            const svgContent = svgBuffer.toString();

            // Should contain a timestamp in HH:MM:SS format
            expect(svgContent).toMatch(/\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('Performance', () => {
        it('should generate multiple images quickly in sequence', async () => {
            const startTime = Date.now();

            for (let i = 0; i < 3; i++) {
                await MockGenerator.generateImage('1.91:1', `Test ${i}`, i);
            }

            const totalTime = Date.now() - startTime;

            // 3 images with 500-1000ms each should take less than 3.5 seconds
            expect(totalTime).toBeLessThan(3500);
        });
    });
});