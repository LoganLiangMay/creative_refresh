#!/usr/bin/env node
/**
 * Interactive CLI Test Tool
 * User-friendly interface for testing RDA Image Generation Worker
 *
 * Usage:
 *   node tests/interactive-test.js
 *   npm run test:interactive
 */

const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs').promises;
const LocalTestRunner = require('./local/local-runner');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_PROMPTS_FILE = path.join(FIXTURES_DIR, 'test-prompts.json');
const INPUT_IMAGES_DIR = path.join(FIXTURES_DIR, 'input-images');

class InteractiveTester {
    constructor() {
        this.runner = null;
        this.testCases = null;
    }

    /**
     * Load test cases from fixtures
     */
    async loadTestCases() {
        try {
            const data = await fs.readFile(TEST_PROMPTS_FILE, 'utf8');
            this.testCases = JSON.parse(data);
            return this.testCases;
        } catch (error) {
            console.error('❌ Failed to load test cases:', error.message);
            throw error;
        }
    }

    /**
     * Main menu
     */
    async showMainMenu() {
        console.clear();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🧪 RDA Image Generation - Interactive Test Tool');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '🚀 Run a test case', value: 'run_test' },
                    { name: '📋 Run multiple tests (batch)', value: 'run_batch' },
                    { name: '🎯 Run smoke tests', value: 'smoke_tests' },
                    { name: '💪 Run stress tests', value: 'stress_tests' },
                    { name: '✏️  Custom prompt', value: 'custom' },
                    { name: '📊 View previous results', value: 'view_results' },
                    { name: '💾 Export results to JSON', value: 'export' },
                    { name: '🧹 Clear test data', value: 'clear' },
                    { name: '❌ Exit', value: 'exit' }
                ]
            }
        ]);

        return answer.action;
    }

    /**
     * Configure test runner
     */
    async configure() {
        const config = await inquirer.prompt([
            {
                type: 'list',
                name: 'mode',
                message: 'Select mode:',
                choices: [
                    { name: '🎭 Mock Mode (Free, instant)', value: 'mock' },
                    { name: '💰 Real Mode (Costs $0.003/image)', value: 'real' }
                ],
                default: 'mock'
            }
        ]);

        this.runner = new LocalTestRunner({
            mockMode: config.mode === 'mock',
            clearData: false
        });

        await this.runner.initialize();
    }

    /**
     * Select and run a single test case
     */
    async runTestCase() {
        const testCases = this.testCases.test_cases;

        const choices = testCases.map((tc, i) => ({
            name: `${tc.name} - ${tc.description}`,
            value: i
        }));

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'testIndex',
                message: 'Select a test case:',
                choices,
                pageSize: 10
            }
        ]);

        const testCase = testCases[answer.testIndex];

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Running: ${testCase.name}`);
        console.log(`Description: ${testCase.description}`);
        console.log(`Prompt: "${testCase.prompt}"`);
        console.log(`Aspect Ratio: ${testCase.aspect_ratio}`);
        console.log(`Input Images: ${testCase.input_images.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Prepare input images
        const inputImages = testCase.input_images.map(img =>
            path.join(INPUT_IMAGES_DIR, img)
        );

        const result = await this.runner.runTest({
            prompt: testCase.prompt,
            aspectRatio: testCase.aspect_ratio,
            inputImages
        });

        console.log('\n✅ Test completed!');
        console.log(`Duration: ${result.duration}ms`);
        console.log(`Job ID: ${result.jobId}`);
        console.log(`Image ID: ${result.imageId}\n`);

        await this.pressAnyKey();
    }

    /**
     * Run multiple tests
     */
    async runBatch() {
        const answer = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedTests',
                message: 'Select tests to run:',
                choices: this.testCases.test_cases.map((tc, i) => ({
                    name: tc.name,
                    value: i,
                    checked: i < 3 // Check first 3 by default
                })),
                pageSize: 10,
                validate: (input) => {
                    if (input.length === 0) {
                        return 'Please select at least one test';
                    }
                    return true;
                }
            }
        ]);

        console.log(`\n🔄 Running ${answer.selectedTests.length} tests...\n`);

        const results = [];
        for (let i = 0; i < answer.selectedTests.length; i++) {
            const testIndex = answer.selectedTests[i];
            const testCase = this.testCases.test_cases[testIndex];

            console.log(`\n[${i + 1}/${answer.selectedTests.length}] ${testCase.name}`);

            const inputImages = testCase.input_images.map(img =>
                path.join(INPUT_IMAGES_DIR, img)
            );

            const result = await this.runner.runTest({
                prompt: testCase.prompt,
                aspectRatio: testCase.aspect_ratio,
                inputImages
            });

            results.push({ testCase, result });
        }

        // Summary
        const successful = results.filter(r => r.result.success).length;
        const avgDuration = results.reduce((sum, r) => sum + r.result.duration, 0) / results.length;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Batch Test Summary');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total: ${results.length}`);
        console.log(`Successful: ${successful} ✅`);
        console.log(`Failed: ${results.length - successful} ❌`);
        console.log(`Avg Duration: ${avgDuration.toFixed(0)}ms`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await this.pressAnyKey();
    }

    /**
     * Run smoke tests
     */
    async runSmokeTests() {
        console.log('\n🎯 Running smoke tests...\n');

        const results = [];
        for (const testCase of this.testCases.smoke_tests) {
            console.log(`Running: ${testCase.name}`);

            const result = await this.runner.runTest({
                prompt: testCase.prompt,
                aspectRatio: testCase.aspect_ratio,
                inputImages: []
            });

            results.push({ testCase, result });
        }

        const allPassed = results.every(r => r.result.success);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(allPassed ? '✅ All smoke tests passed!' : '❌ Some smoke tests failed');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await this.pressAnyKey();
    }

    /**
     * Run custom prompt
     */
    async runCustomPrompt() {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'prompt',
                message: 'Enter your prompt:',
                validate: (input) => input.length > 0 ? true : 'Prompt cannot be empty'
            },
            {
                type: 'list',
                name: 'aspectRatio',
                message: 'Select aspect ratio:',
                choices: [
                    { name: '1:1 (Square - 1200×1200)', value: '1:1' },
                    { name: '1.91:1 (Wide - 1200×628)', value: '1.91:1' }
                ]
            },
            {
                type: 'confirm',
                name: 'useInputImages',
                message: 'Include input images?',
                default: false
            }
        ]);

        let inputImages = [];
        if (answers.useInputImages) {
            const imageSourceAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'source',
                    message: 'Where are your images?',
                    choices: [
                        { name: '📁 Use sample images from fixtures', value: 'fixtures' },
                        { name: '💻 Enter custom file path(s)', value: 'custom' }
                    ]
                }
            ]);

            if (imageSourceAnswer.source === 'fixtures') {
                // Original behavior - select from fixtures
                const files = await fs.readdir(INPUT_IMAGES_DIR);
                const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i));

                const imageAnswer = await inquirer.prompt([
                    {
                        type: 'checkbox',
                        name: 'selectedImages',
                        message: 'Select input images:',
                        choices: imageFiles.map(f => ({ name: f, value: f }))
                    }
                ]);

                inputImages = imageAnswer.selectedImages.map(img =>
                    path.join(INPUT_IMAGES_DIR, img)
                );
            } else {
                // New behavior - enter custom paths
                let addingImages = true;
                while (addingImages) {
                    const pathAnswer = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'imagePath',
                            message: `Enter image path ${inputImages.length + 1} (or press Enter to finish):`,
                            validate: async (input) => {
                                if (!input) return true; // Allow empty to finish
                                try {
                                    const fs = require('fs').promises;
                                    await fs.access(input);
                                    return true;
                                } catch {
                                    return 'File not found. Please enter a valid path.';
                                }
                            }
                        }
                    ]);

                    if (!pathAnswer.imagePath) {
                        addingImages = false;
                    } else {
                        inputImages.push(pathAnswer.imagePath);
                        console.log(`  ✅ Added: ${path.basename(pathAnswer.imagePath)}`);
                    }
                }

                if (inputImages.length === 0) {
                    console.log('  ℹ️  No images added, proceeding without input images');
                }
            }
        }

        console.log('\n🚀 Running custom test...\n');

        const result = await this.runner.runTest({
            prompt: answers.prompt,
            aspectRatio: answers.aspectRatio,
            inputImages
        });

        console.log('\n✅ Custom test completed!');
        console.log(`Duration: ${result.duration}ms`);
        console.log(`Job ID: ${result.jobId}\n`);

        await this.pressAnyKey();
    }

    /**
     * View previous results
     */
    async viewResults() {
        console.log('\n📊 Loading results...\n');
        await this.runner.viewResults();
        await this.pressAnyKey();
    }

    /**
     * Export results
     */
    async exportResults() {
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'filename',
                message: 'Export filename:',
                default: `test-results-${Date.now()}.json`
            }
        ]);

        const outputPath = path.join(__dirname, 'local', 'output', answer.filename);
        await this.runner.exportResults(outputPath);

        console.log(`\n✅ Results exported to: ${outputPath}\n`);
        await this.pressAnyKey();
    }

    /**
     * Clear test data
     */
    async clearData() {
        const answer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: '⚠️  This will delete all test data. Are you sure?',
                default: false
            }
        ]);

        if (answer.confirm) {
            const mockS3 = require('./local/mock-s3');
            const mockDynamoDB = require('./local/mock-dynamodb');

            const s3 = new mockS3();
            const db = new mockDynamoDB();

            await s3.clear();
            await db.clear();

            console.log('\n✅ Test data cleared!\n');
        }

        await this.pressAnyKey();
    }

    /**
     * Helper: Wait for key press
     */
    async pressAnyKey() {
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    /**
     * Main loop
     */
    async run() {
        try {
            // Load test cases
            await this.loadTestCases();

            // Configure runner
            await this.configure();

            // Main loop
            let running = true;
            while (running) {
                const action = await this.showMainMenu();

                switch (action) {
                    case 'run_test':
                        await this.runTestCase();
                        break;
                    case 'run_batch':
                        await this.runBatch();
                        break;
                    case 'smoke_tests':
                        await this.runSmokeTests();
                        break;
                    case 'custom':
                        await this.runCustomPrompt();
                        break;
                    case 'view_results':
                        await this.viewResults();
                        break;
                    case 'export':
                        await this.exportResults();
                        break;
                    case 'clear':
                        await this.clearData();
                        break;
                    case 'exit':
                        running = false;
                        break;
                }
            }

            console.log('\n👋 Goodbye!\n');

        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new InteractiveTester();
    tester.run();
}

module.exports = InteractiveTester;
