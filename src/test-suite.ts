#!/usr/bin/env node
/**
 * CloudCost MCP - Comprehensive Test Suite
 * Tests all tools with various inputs to find bugs and validate outputs
 */

import { aiModelTools } from './tools/ai-models.js';
import { cloudInfraTools } from './tools/cloud-infra.js';
import { saasBurnTools } from './tools/saas-burn.js';
import { optimizationTools } from './tools/optimization.js';

interface TestCase {
    toolName: string;
    description: string;
    args: Record<string, unknown>;
    validate?: (result: unknown) => string | null;
}

interface TestResult {
    toolName: string;
    description: string;
    passed: boolean;
    error?: string;
    result?: unknown;
    duration: number;
}

// ============== Test Cases ==============

const testCases: TestCase[] = [
    // === AI Model Tools ===
    {
        toolName: 'estimateOpenAICost',
        description: 'Basic GPT-4o cost estimation',
        args: { model: 'gpt-4o', inputTokens: 1000, outputTokens: 500 },
        validate: (r: any) => r.totalCost > 0 ? null : 'Cost should be positive',
    },
    {
        toolName: 'estimateOpenAICost',
        description: 'GPT-4o-mini cost estimation',
        args: { model: 'gpt-4o-mini', inputTokens: 10000, outputTokens: 5000 },
    },
    {
        toolName: 'estimateOpenAICost',
        description: 'O1 reasoning model',
        args: { model: 'o1', inputTokens: 5000, outputTokens: 2000 },
    },
    {
        toolName: 'estimateAnthropicCost',
        description: 'Claude 3.5 Sonnet (alias)',
        args: { model: 'claude-3-5-sonnet', inputTokens: 1000, outputTokens: 500 },
        validate: (r: any) => r.totalCost > 0 ? null : 'Cost should be positive',
    },
    {
        toolName: 'estimateAnthropicCost',
        description: 'Claude 3.5 Haiku (alias)',
        args: { model: 'claude-3-5-haiku', inputTokens: 10000, outputTokens: 5000 },
    },
    {
        toolName: 'estimateAnthropicCost',
        description: 'Claude full version name',
        args: { model: 'claude-3-5-sonnet-20241022', inputTokens: 1000, outputTokens: 500 },
    },
    {
        toolName: 'suggestModel',
        description: 'Suggest model for chat task',
        args: { taskType: 'chat', budget: 10, latencyRequirement: 'medium' },
        validate: (r: any) => r.recommendedModel ? null : 'Should recommend a model',
    },
    {
        toolName: 'suggestModel',
        description: 'Suggest model for code task with low budget',
        args: { taskType: 'code', budget: 1, latencyRequirement: 'low' },
    },
    {
        toolName: 'suggestModel',
        description: 'Suggest model for reasoning task',
        args: { taskType: 'reasoning', budget: 50, latencyRequirement: 'high' },
    },
    {
        toolName: 'compareModels',
        description: 'Compare models for chat',
        args: { taskType: 'chat' },
        validate: (r: any) => r.rankings?.length > 0 ? null : 'Should have rankings',
    },
    {
        toolName: 'compareModels',
        description: 'Compare models for code',
        args: { taskType: 'code' },
    },
    {
        toolName: 'compareModels',
        description: 'Compare models for embedding',
        args: { taskType: 'embedding' },
    },
    {
        toolName: 'rankingByCostEfficiency',
        description: 'Rank for code generation task',
        args: { task: 'code generation and debugging' },
        validate: (r: any) => r.efficiencyRankings?.length > 0 ? null : 'Should have efficiency rankings',
    },
    {
        toolName: 'rankingByCostEfficiency',
        description: 'Classify voice conversion app',
        args: { task: 'an app to convert my voice into someone else' },
        validate: (r: any) => r.inferredTaskType !== 'chat' ? null : `Should not classify as chat, got: ${r.inferredTaskType}`,
    },
    {
        toolName: 'rankingByCostEfficiency',
        description: 'Classify PPT to video tool',
        args: { task: 'building a tool to convert ppt into videos' },
        validate: (r: any) => ['development', 'video'].includes(r.inferredTaskType) ? null : `Should classify as development or video, got: ${r.inferredTaskType}`,
    },
    {
        toolName: 'estimatePerformance',
        description: 'Estimate chat performance',
        args: { taskType: 'chat', tokenSize: 1000 },
        validate: (r: any) => r.estimatedLatencyMs > 0 ? null : 'Should have latency estimate',
    },

    // === Cloud Infrastructure Tools ===
    {
        toolName: 'estimateComputeCost',
        description: 'AWS t3.large compute cost',
        args: { provider: 'aws', instanceType: 't3.large', hours: 730 },
        validate: (r: any) => r.monthlyCost > 0 ? null : 'Monthly cost should be positive',
    },
    {
        toolName: 'estimateComputeCost',
        description: 'Azure B2ms compute cost',
        args: { provider: 'azure', instanceType: 'B2ms', hours: 730 },
    },
    {
        toolName: 'estimateComputeCost',
        description: 'GCP e2-medium compute cost',
        args: { provider: 'gcp', instanceType: 'e2-medium', hours: 730 },
    },
    {
        toolName: 'estimateComputeCost',
        description: 'AWS m6i.xlarge compute cost',
        args: { provider: 'aws', instanceType: 'm6i.xlarge', hours: 100 },
    },
    {
        toolName: 'compareCloudCost',
        description: 'Compare compute with defaults',
        args: { serviceType: 'compute' },
        validate: (r: any) => r.winner ? null : 'Should have a winner',
    },
    {
        toolName: 'compareCloudCost',
        description: 'Compare storage costs',
        args: { serviceType: 'storage', usageProfile: { gb: 500 } },
        validate: (r: any) => r.monthlyCost.aws > 0 ? null : 'Storage cost should be positive',
    },
    {
        toolName: 'compareCloudCost',
        description: 'Compare database costs',
        args: { serviceType: 'database', usageProfile: { hours: 730, gb: 50 } },
    },
    {
        toolName: 'estimateStorageCost',
        description: 'AWS standard storage cost',
        args: { provider: 'aws', storageType: 'standard', gb: 1000 },
        validate: (r: any) => r.totalCost > 0 ? null : 'Should have total cost',
    },
    {
        toolName: 'estimateBandwidthCost',
        description: 'AWS egress bandwidth cost',
        args: { provider: 'aws', gbTransfer: 5000, direction: 'egress' },
        validate: (r: any) => r.totalCost > 0 ? null : 'Should have total cost',
    },
    {
        toolName: 'forecastScalingCost',
        description: 'Forecast scaling cost',
        args: { provider: 'aws', currentMonthlyCost: 5000, growthRate: 0.15, months: 12 },
        validate: (r: any) => r.projectedFinalCost > 0 ? null : 'Should have projected cost',
    },

    // === SaaS Burn Tools ===
    {
        toolName: 'forecastRunway',
        description: 'Basic runway forecast',
        args: { monthlyInfraCost: 10000, monthlyRevenue: 5000, cashInBank: 200000 },
        validate: (r: any) => r.runwayMonths > 0 ? null : 'Should have positive runway',
    },
    {
        toolName: 'forecastRunway',
        description: 'Startup with growth',
        args: { monthlyInfraCost: 5000, monthlyRevenue: 2000, cashInBank: 100000, monthlyGrowthRate: 0.15 },
    },
    {
        toolName: 'calculateSaaSBurn',
        description: 'Calculate SaaS burn for common tools',
        args: {
            services: [
                { name: 'AWS', monthlyCost: 5000, category: 'compute' },
                { name: 'Datadog', monthlyCost: 500, category: 'saas' },
            ],
        },
        // totalMonthlyBurn or totalBurn depending on implementation
        validate: (r: any) => r.monthlyBurn >= 0 ? null : 'Should have monthly burn cost',
    },
    {
        toolName: 'suggestOptimalPlan',
        description: 'Suggest optimal plan for Vercel',
        args: {
            serviceName: 'vercel',
            currentPlan: 'hobby',
            monthlyUsage: { bandwidth: 50, requests: 500 }
        },
    },
    {
        toolName: 'suggestOptimalPlan',
        description: 'Suggest optimal plan for Supabase',
        args: {
            serviceName: 'supabase',
            currentPlan: 'free',
            monthlyUsage: { storage: 2, bandwidth: 100 }
        },
    },
    {
        toolName: 'costBreakdownByService',
        description: 'Breakdown by service category',
        args: {
            services: [
                { name: 'AWS', monthlyCost: 5000, category: 'compute' },
                { name: 'Datadog', monthlyCost: 500, category: 'monitoring' },
            ],
            stage: 'seed',
        },
    },
    {
        toolName: 'recommendCostReductionStrategies',
        description: 'Recommend cost reduction strategies',
        args: {
            services: [
                { name: 'EC2', cost: 5000, category: 'compute' },
                { name: 'RDS', cost: 2000, category: 'database' },
            ],
        },
    },

    // === Optimization Tools ===
    {
        toolName: 'multiCloudOptimization',
        description: 'Multi-cloud strategy optimization',
        args: {
            workloadProfile: {
                workloadType: 'web-app',
                monthlyBudget: 10000,
                primaryProvider: 'aws'
            },
            currentCosts: { aws: 10000, azure: 5000, gcp: 3000 },
        },
        // might be recommendation, optimalDistribution, or strategies
        validate: (r: any) => (r.recommendation || r.optimalDistribution || r.strategies) ? null : 'Should have recommendation or distribution',
    },
    {
        toolName: 'databaseTierRecommendation',
        description: 'Database tier recommendation',
        args: {
            provider: 'supabase',
            currentUsage: { storageGb: 10, connectionCount: 100, queriesPerSecond: 50 },
        },
    },
    {
        toolName: 'databaseTierRecommendation',
        description: 'MongoDB tier recommendation',
        args: {
            provider: 'mongodb',
            currentUsage: { storageGb: 5, connectionCount: 200 },
            expectedGrowth: 0.3,
        },
    },
    {
        toolName: 'modelSwitchSavings',
        description: 'Model switch savings calculation',
        args: {
            currentModel: 'gpt-4o',
            currentProvider: 'openai',
            monthlyTokens: 1000000,
            qualityRequirement: 'high',
        },
    },
    {
        toolName: 'reservedInstanceSavings',
        description: 'Reserved instance savings',
        args: {
            provider: 'aws',
            instanceType: 't3.large',
            currentMonthlySpend: 200,
            usagePattern: 'steady',
        },
    },
    {
        toolName: 'breakEvenAnalysis',
        description: 'Break even analysis',
        args: {
            optionA: { name: 'On-demand', upfrontCost: 0, monthlyCost: 500 },
            optionB: { name: 'Reserved', upfrontCost: 3000, monthlyCost: 200 },
            timeHorizon: 24,
        },
    },
];

// ============== Test Runner ==============

const allTools = [
    ...aiModelTools,
    ...cloudInfraTools,
    ...saasBurnTools,
    ...optimizationTools,
];

async function runTests(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('  CloudCost MCP - Comprehensive Test Suite');
    console.log('='.repeat(70));
    console.log(`\nTotal tools registered: ${allTools.length}`);
    console.log(`Total test cases: ${testCases.length}\n`);

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        const tool = allTools.find(t => t.name === testCase.toolName);

        if (!tool) {
            results.push({
                toolName: testCase.toolName,
                description: testCase.description,
                passed: false,
                error: `Tool not found: ${testCase.toolName}`,
                duration: 0,
            });
            failed++;
            console.log(`❌ ${testCase.toolName}: ${testCase.description}`);
            console.log(`   Error: Tool not found`);
            continue;
        }

        const startTime = Date.now();
        try {
            const validatedArgs = tool.inputSchema.parse(testCase.args);
            const result = tool.handler(validatedArgs as never);
            const duration = Date.now() - startTime;

            // Check for error in result
            if (result && typeof result === 'object' && 'error' in result && (result as any).error === true) {
                throw new Error((result as any).message || 'Unknown error in result');
            }

            // Check for NaN values
            const jsonStr = JSON.stringify(result);
            if (jsonStr.includes(':NaN') || jsonStr.includes(': NaN')) {
                throw new Error('Result contains NaN values');
            }

            // Run custom validation
            if (testCase.validate) {
                const validationError = testCase.validate(result);
                if (validationError) {
                    throw new Error(`Validation failed: ${validationError}`);
                }
            }

            results.push({
                toolName: testCase.toolName,
                description: testCase.description,
                passed: true,
                result,
                duration,
            });
            passed++;
            console.log(`✅ ${testCase.toolName}: ${testCase.description} (${duration}ms)`);

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            results.push({
                toolName: testCase.toolName,
                description: testCase.description,
                passed: false,
                error: errorMessage,
                duration,
            });
            failed++;
            console.log(`❌ ${testCase.toolName}: ${testCase.description}`);
            console.log(`   Error: ${errorMessage.slice(0, 200)}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('  Test Summary');
    console.log('='.repeat(70));
    console.log(`\n✅ Passed: ${passed}/${testCases.length}`);
    console.log(`❌ Failed: ${failed}/${testCases.length}`);
    console.log(`📊 Pass Rate: ${Math.round((passed / testCases.length) * 100)}%\n`);

    if (failed > 0) {
        console.log('Failed Tests:');
        console.log('-'.repeat(50));
        for (const result of results.filter(r => !r.passed)) {
            console.log(`  • ${result.toolName}: ${result.description}`);
            console.log(`    Error: ${result.error?.slice(0, 150)}`);
        }
        console.log('');
    }

    // Untested tools warning
    const testedToolNames = new Set(testCases.map(tc => tc.toolName));
    const untestedTools = allTools.filter(t => !testedToolNames.has(t.name));

    if (untestedTools.length > 0) {
        console.log('⚠️  Untested Tools:');
        for (const tool of untestedTools) {
            console.log(`  • ${tool.name}`);
        }
        console.log('');
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
