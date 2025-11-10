#!/usr/bin/env node

/**
 * Cost comparison between Mock Mode and Real Mode
 * Shows the financial benefits of using Mock Mode during development
 */

function calculateCosts(scenarios) {
    console.log('========================================');
    console.log('💰 RDA Image Generator - Cost Analysis');
    console.log('========================================\\n');

    scenarios.forEach(scenario => {
        console.log(`📋 ${scenario.name}`);
        console.log('=' .repeat(40));

        const mockCost = scenario.images * 0; // Mock mode is free
        const realCost = scenario.images * 0.045; // Replicate costs $0.045/image
        const openaiCost = Math.ceil(scenario.images / 10) * 0.01; // ~$0.01 per batch

        console.log(`Images: ${scenario.images}`);
        console.log(`Iterations: ${scenario.iterations || 1}x\\n`);

        const totalImages = scenario.images * (scenario.iterations || 1);

        console.log('Mock Mode:');
        console.log(`  Image Generation: $${(mockCost * (scenario.iterations || 1)).toFixed(2)}`);
        console.log(`  OpenAI GPT-4: $${(openaiCost * (scenario.iterations || 1)).toFixed(2)}`);
        console.log(`  AWS Services: ~$0.01`);
        console.log(`  Total: $${(openaiCost * (scenario.iterations || 1) + 0.01).toFixed(2)}`);

        console.log('\\nReal Mode:');
        console.log(`  Image Generation: $${(realCost * (scenario.iterations || 1)).toFixed(2)}`);
        console.log(`  OpenAI GPT-4: $${(openaiCost * (scenario.iterations || 1)).toFixed(2)}`);
        console.log(`  AWS Services: ~$0.01`);
        console.log(`  Total: $${(realCost * (scenario.iterations || 1) + openaiCost * (scenario.iterations || 1) + 0.01).toFixed(2)}`);

        const savings = (realCost * (scenario.iterations || 1));
        console.log(`\\n💵 Savings with Mock Mode: $${savings.toFixed(2)}`);
        console.log(`📊 Cost Reduction: ${Math.round((savings / ((realCost + openaiCost) * (scenario.iterations || 1) + 0.01)) * 100)}%\\n`);
    });

    // Development phase totals
    console.log('========================================');
    console.log('🚀 Full Development Cycle (2 Weeks)');
    console.log('========================================\\n');

    const devPhases = [
        { phase: 'Initial Testing', tests: 10, images: 10 },
        { phase: 'Bug Fixes', tests: 20, images: 5 },
        { phase: 'Integration Testing', tests: 15, images: 10 },
        { phase: 'Load Testing', tests: 30, images: 10 },
        { phase: 'Final Validation', tests: 2, images: 2 }
    ];

    let totalMockCost = 0;
    let totalRealCost = 0;

    devPhases.forEach(phase => {
        const mockCost = 0; // Always free
        const realCost = phase.tests * phase.images * 0.045;
        const openaiCost = phase.tests * Math.ceil(phase.images / 10) * 0.01;

        totalMockCost += openaiCost + 0.01;
        totalRealCost += realCost + openaiCost + 0.01;

        console.log(`${phase.phase}:`);
        console.log(`  Tests: ${phase.tests} × ${phase.images} images = ${phase.tests * phase.images} total`);
        console.log(`  Mock Mode: $${openaiCost.toFixed(2)}`);
        console.log(`  Real Mode: $${realCost.toFixed(2)}`);
        console.log('');
    });

    console.log('Development Totals:');
    console.log(`  Mock Mode Total: $${totalMockCost.toFixed(2)}`);
    console.log(`  Real Mode Total: $${totalRealCost.toFixed(2)}`);
    console.log(`  💰 Total Savings: $${(totalRealCost - totalMockCost).toFixed(2)}`);
    console.log(`  📊 Cost Reduction: ${Math.round(((totalRealCost - totalMockCost) / totalRealCost) * 100)}%\\n`);

    // Time comparison
    console.log('========================================');
    console.log('⏱️ Time Comparison');
    console.log('========================================\\n');

    console.log('Mock Mode:');
    console.log('  Per Image: 0.2-0.7 seconds');
    console.log('  10 Images: ~5 seconds');
    console.log('  100 Images: ~50 seconds\\n');

    console.log('Real Mode (Replicate):');
    console.log('  Per Image: 30-60 seconds');
    console.log('  10 Images: ~5-10 minutes');
    console.log('  100 Images: ~50-100 minutes\\n');

    console.log('⚡ Mock Mode is 60-100x faster!\\n');

    // ROI calculation
    console.log('========================================');
    console.log('📈 Return on Investment');
    console.log('========================================\\n');

    const hourlyRate = 150; // Typical developer hourly rate
    const timeSavedHours = 10; // Hours saved by using mock mode
    const moneySaved = totalRealCost - totalMockCost;
    const productivityGain = hourlyRate * timeSavedHours;

    console.log('Development Benefits:');
    console.log(`  Direct Cost Savings: $${moneySaved.toFixed(2)}`);
    console.log(`  Time Saved: ${timeSavedHours} hours`);
    console.log(`  Productivity Value: $${productivityGain.toFixed(2)}`);
    console.log(`  Total ROI: $${(moneySaved + productivityGain).toFixed(2)}\\n`);

    console.log('✨ Mock Mode provides ${(moneySaved + productivityGain).toFixed(2)} in value!');
}

// Run analysis
const testScenarios = [
    { name: 'Single Test Run', images: 10 },
    { name: 'Feature Development', images: 10, iterations: 5 },
    { name: 'Bug Fix Testing', images: 5, iterations: 10 },
    { name: 'Load Testing', images: 100, iterations: 1 },
    { name: 'Production Validation', images: 2, iterations: 1 }
];

calculateCosts(testScenarios);