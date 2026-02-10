// Advanced Optimization Tools
import { z } from 'zod';
import {
    calculateBreakEven,
    calculateReservedSavings,
    forecastCost,
} from '../engine/formulas.js';
import { compareProviders } from '../engine/intelligence.js';
import { getSaaSPricing, getAllAIModels } from '../engine/pricing-engine.js';
import type { Provider, WorkloadType } from '../engine/types.js';

// ============== Schema Definitions ==============

export const MultiCloudOptimizationSchema = z.object({
    workloadProfile: z.object({
        workloadType: z.enum(['api-heavy', 'batch-processing', 'ml-training', 'web-app', 'realtime'])
            .describe('Workload type (e.g., web-app, ml-training)').default('web-app'),
        monthlyBudget: z.number().min(0).describe('Monthly budget in USD (e.g., 5000)').default(2000),
        primaryProvider: z.enum(['aws', 'azure', 'gcp']).optional().describe('Current primary provider').default('aws'),
    }).describe('Current workload characteristics'),
    currentCosts: z.object({
        aws: z.number().optional().describe('Monthly spend on AWS'),
        azure: z.number().optional().describe('Monthly spend on Azure'),
        gcp: z.number().optional().describe('Monthly spend on GCP'),
    }).describe('Current costs per provider').default({ aws: 1000, gcp: 500 }),
});

export const DatabaseTierRecommendationSchema = z.object({
    provider: z.enum(['supabase', 'mongodb', 'neon', 'planetscale']).describe('Database provider').default('supabase'),
    currentUsage: z.object({
        connectionCount: z.number().optional().describe('Average active connections').default(10),
        storageGb: z.number().describe('Storage used in GB (e.g., 5)').default(1),
        queriesPerSecond: z.number().optional().describe('Average queries per second'),
        monthlyReads: z.number().optional(),
        monthlyWrites: z.number().optional(),
    }).describe('Current database usage metrics'),
    expectedGrowth: z.number().min(0).max(10).default(0.2).describe('Expected monthly growth rate (e.g., 0.2 for 20%)'),
});

export const ModelSwitchSavingsSchema = z.object({
    currentModel: z.string().describe('Current AI model in use (e.g., gpt-4o)').default('gpt-4o'),
    currentProvider: z.enum(['openai', 'anthropic']).describe('Current provider').default('openai'),
    monthlyTokens: z.number().min(0).describe('Monthly token usage (e.g., 1,000,000)').default(1000000),
    qualityRequirement: z.enum(['highest', 'high', 'medium', 'acceptable']).describe('Minimum quality level').default('high'),
});

export const ReservedInstanceSavingsSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider').default('aws'),
    instanceType: z.string().describe('Instance type (e.g., t3.medium)').default('t3.large'),
    currentMonthlySpend: z.number().min(0).describe('Current monthly on-demand spend in USD').default(500),
    usagePattern: z.enum(['steady', 'variable', 'spiky']).describe('Usage pattern (e.g., steady)').default('steady'),
});

export const BreakEvenAnalysisSchema = z.object({
    optionA: z.object({
        name: z.string().describe('Option name (e.g., On-demand)'),
        upfrontCost: z.number().min(0).describe('Upfront cost in USD'),
        monthlyCost: z.number().min(0).describe('Monthly cost in USD'),
    }).describe('First option to compare').default({ name: 'On-demand', upfrontCost: 0, monthlyCost: 500 }),
    optionB: z.object({
        name: z.string().describe('Option name (e.g., 1-yr Reserved)'),
        upfrontCost: z.number().min(0).describe('Upfront cost in USD'),
        monthlyCost: z.number().min(0).describe('Monthly cost in USD'),
    }).describe('Second option to compare').default({ name: 'Reserved', upfrontCost: 3000, monthlyCost: 200 }),
    timeHorizon: z.number().min(1).max(60).default(24).describe('Analysis period in months'),
});

// ============== Tool Handlers ==============

export function handleMultiCloudOptimization(args: z.infer<typeof MultiCloudOptimizationSchema>) {
    const providers: Provider[] = ['aws', 'azure', 'gcp'];
    const costs = args.currentCosts as Record<Provider, number | undefined>;

    // Calculate total current spend
    const totalCurrentSpend = Object.values(costs).reduce((sum: number, c) => sum + (c || 0), 0);

    // Determine optimal distribution based on workload
    const workloadStrengths: Record<WorkloadType, Record<Provider, number>> = {
        'api-heavy': { aws: 0.4, gcp: 0.35, azure: 0.25 },
        'batch-processing': { gcp: 0.45, aws: 0.35, azure: 0.2 },
        'ml-training': { gcp: 0.5, aws: 0.35, azure: 0.15 },
        'web-app': { aws: 0.4, gcp: 0.35, azure: 0.25 },
        'realtime': { gcp: 0.45, aws: 0.35, azure: 0.2 },
    };

    const optimalDistribution = workloadStrengths[args.workloadProfile.workloadType];

    // Calculate optimized costs (multi-cloud usually saves 15-25%)
    const optimizationFactor = 0.2;
    const optimizedSpend = totalCurrentSpend * (1 - optimizationFactor);

    const distribution = Object.entries(optimalDistribution).map(([provider, weight]) => ({
        provider,
        percentage: Math.round(weight * 100),
        estimatedCost: Math.round(optimizedSpend * weight * 100) / 100,
        reasoning: provider === 'gcp' ? 'Best for compute-heavy workloads with sustained use discounts' :
            provider === 'aws' ? 'Widest service selection and most mature ecosystem' :
                'Excellent for enterprise integrations and hybrid scenarios',
    }));

    return {
        currentTotalSpend: totalCurrentSpend,
        optimizedTotalSpend: optimizedSpend,
        potentialSavings: totalCurrentSpend - optimizedSpend,
        savingsPercent: Math.round(optimizationFactor * 100),
        optimalDistribution: distribution,
        migrationRoadmap: [
            { phase: 1, action: 'Identify workloads suitable for each cloud', timeframe: '2 weeks', savings: 0 },
            { phase: 2, action: 'Migrate batch/dev workloads to cheapest provider', timeframe: '4 weeks', savings: Math.round((totalCurrentSpend - optimizedSpend) * 0.3) },
            { phase: 3, action: 'Move production workloads with proper testing', timeframe: '8 weeks', savings: Math.round((totalCurrentSpend - optimizedSpend) * 0.5) },
            { phase: 4, action: 'Optimize remaining workloads and negotiate contracts', timeframe: '12 weeks', savings: Math.round((totalCurrentSpend - optimizedSpend) * 0.2) },
        ],
        riskAssessment: [
            { category: 'Complexity', description: 'Multi-cloud adds operational complexity', severity: 'medium' as const, mitigation: 'Use infrastructure-as-code and standardized tooling' },
            { category: 'Vendor Lock-in', description: 'Some services are cloud-specific', severity: 'low' as const, mitigation: 'Use cloud-agnostic services where possible' },
            { category: 'Latency', description: 'Cross-cloud communication adds latency', severity: 'high' as const, mitigation: 'Keep tightly-coupled services on same cloud' },
        ],
        insights: [
            { type: 'opportunity' as const, message: `Multi-cloud strategy could save $${Math.round(totalCurrentSpend - optimizedSpend)}/month`, impact: (totalCurrentSpend - optimizedSpend) * 12 },
            { type: 'action' as const, message: 'Start by moving dev/test environments to cheaper provider' },
            { type: 'warning' as const, message: 'Ensure team has expertise across chosen providers' },
        ],
    };
}

export function handleDatabaseTierRecommendation(args: z.infer<typeof DatabaseTierRecommendationSchema>) {
    // Fetch dynamic pricing
    let dynamicData = getSaaSPricing(args.provider);

    // Handle inconsistent JSON structure (some have "plans" wrapper)
    if (dynamicData && dynamicData.plans) {
        dynamicData = dynamicData.plans;
    }

    // Default/Fallback tiers
    const fallbackTiers: Record<string, { name: string; cost: number; limits: Record<string, number> }[]> = {
        supabase: [
            { name: 'free', cost: 0, limits: { storage: 0.5, bandwidth: 2, connections: 50 } },
            { name: 'pro', cost: 25, limits: { storage: 8, bandwidth: 250, connections: 200 } },
            { name: 'team', cost: 599, limits: { storage: 100, bandwidth: 1000, connections: 500 } },
        ],
        mongodb: [
            { name: 'm0', cost: 0, limits: { storage: 0.5, connections: 100 } },
            { name: 'm10', cost: 57, limits: { storage: 10, connections: 500 } },
            { name: 'm20', cost: 140, limits: { storage: 20, connections: 1500 } },
            { name: 'm30', cost: 280, limits: { storage: 40, connections: 3000 } },
        ],
        neon: [
            { name: 'free', cost: 0, limits: { storage: 0.5, compute: 191 } },
            { name: 'launch', cost: 19, limits: { storage: 10, compute: 300 } },
            { name: 'scale', cost: 69, limits: { storage: 50, compute: 750 } },
        ],
        planetscale: [
            { name: 'hobby', cost: 0, limits: { storage: 5 } },
            { name: 'scaler', cost: 29, limits: { storage: 10 } },
            { name: 'scaler_pro', cost: 39, limits: { storage: 50 } },
        ],
    };

    let tiers: { name: string; cost: number; limits: Record<string, number> }[] = [];

    if (dynamicData) {
        tiers = Object.entries(dynamicData).map(([planName, specs]: [string, any]) => {
            const limits: Record<string, number> = {};
            // Map JSON specs to tool limits
            if (specs.storage_gb) limits.storage = specs.storage_gb;
            if (specs.database_size_gb) limits.storage = specs.database_size_gb;
            if (specs.connections) limits.connections = specs.connections === 'unlimited' ? Infinity : specs.connections;

            return {
                name: planName,
                cost: typeof specs.monthly_cost === 'number' ? specs.monthly_cost : 0,
                limits
            };
        }).sort((a, b) => a.cost - b.cost);
    } else {
        tiers = fallbackTiers[args.provider] || [];
    }

    if (tiers.length === 0) {
        throw new Error(`Unknown provider or no pricing data: ${args.provider}`);
    }

    // Find current best tier
    const currentBestTier = tiers.find(t => t.limits.storage >= args.currentUsage.storageGb) || tiers[tiers.length - 1];

    // Project future needs
    const projectedStorage = args.currentUsage.storageGb * Math.pow(1 + args.expectedGrowth, 6);
    const futureTier = tiers.find(t => t.limits.storage >= projectedStorage) || tiers[tiers.length - 1];

    // Calculate growth buffer
    const headroom = ((currentBestTier.limits.storage - args.currentUsage.storageGb) / currentBestTier.limits.storage) * 100;

    return {
        provider: args.provider,
        currentUsage: args.currentUsage,
        recommendedTier: currentBestTier.name,
        recommendedCost: currentBestTier.cost,
        tierLimits: currentBestTier.limits,
        growthBuffer: `${Math.round(headroom)}% headroom before needing upgrade`,
        nextScalePoint: futureTier.name !== currentBestTier.name
            ? `Upgrade to ${futureTier.name} ($${futureTier.cost}/mo) in ~6 months at current growth`
            : 'Current tier supports growth for 12+ months',
        projectedUsage: {
            inSixMonths: projectedStorage,
            tier: futureTier.name,
            cost: futureTier.cost,
        },
        alternatives: tiers.filter(t => t.name !== currentBestTier.name).map(t => ({
            option: t.name,
            whyNot: t.cost < currentBestTier.cost
                ? 'Insufficient capacity for current usage'
                : 'Over-provisioned for current needs',
            costDifference: t.cost - currentBestTier.cost,
        })),
        insights: [
            { type: 'action' as const, message: `Use ${currentBestTier.name} tier ($${currentBestTier.cost}/mo) for current needs` },
            { type: 'prediction' as const, message: `At ${Math.round(args.expectedGrowth * 100)}% growth, expect tier upgrade in ~${Math.ceil(Math.log(currentBestTier.limits.storage / args.currentUsage.storageGb) / Math.log(1 + args.expectedGrowth))} months` },
        ],
    };
}

export function handleModelSwitchSavings(args: z.infer<typeof ModelSwitchSavingsSchema>) {
    // Fetch all dynamic models
    const allModels = getAllAIModels();

    // Quality scoring heuristics based on category
    const categoryQuality: Record<string, number> = {
        'flagship': 95,
        'flagship-efficient': 92,
        'premium': 96,
        'reasoning': 98,
        'balanced': 90,
        'code': 92,
        'efficient': 82,
        'speed': 75,
        'realtime': 85,
    };

    const modelData: Record<string, { cost: number; quality: number; provider: string }> = {};

    // Populate model data from dynamic source
    Object.entries(allModels).forEach(([name, specs]: [string, any]) => {
        if (!specs.input_per_million) return;

        // Approximate blend cost (assume 3:1 input:output ratio common in chat)
        // Cost per million tokens (blended)
        const blendedCost = (specs.input_per_million * 0.75) + (specs.output_per_million * 0.25);

        // Infer quality
        let quality = 80; // default
        if (specs.category && categoryQuality[specs.category]) {
            quality = categoryQuality[specs.category];
        } else if (name.includes('gpt-4') || name.includes('opus') || name.includes('sonnet')) {
            quality = 95;
        } else if (name.includes('mini') || name.includes('haiku') || name.includes('flash')) {
            quality = 80;
        }

        modelData[name] = {
            cost: blendedCost,
            quality,
            provider: specs.provider || 'unknown'
        };
    });

    // Ensure we have data for the requested model
    if (!modelData[args.currentModel]) {
        // Fallback or error? Let's try to add it if missing but validation passed
        // Or throw
        throw new Error(`Unknown model: ${args.currentModel}`);
    }

    const current = modelData[args.currentModel];

    // Re-calculate monthly cost using blended rate matching the modelData
    const currentMonthlyCost = (args.monthlyTokens / 1_000_000) * current.cost;
    const minQuality = {
        highest: 95,
        high: 88,
        medium: 80,
        acceptable: 70
    }[args.qualityRequirement] || 80;

    // Find alternatives that meet quality requirement
    const alternatives = Object.entries(modelData)
        .filter(([name, data]) => data.quality >= minQuality && name !== args.currentModel)
        .map(([name, data]) => ({
            model: name,
            provider: data.provider,
            monthlyCost: (args.monthlyTokens / 1_000_000) * data.cost,
            savings: currentMonthlyCost - (args.monthlyTokens / 1_000_000) * data.cost,
            qualityImpact: current.quality - data.quality,
        }))
        .filter(a => a.savings > 0)
        .sort((a, b) => b.savings - a.savings);

    const bestAlternative = alternatives[0];

    return {
        currentModel: args.currentModel,
        currentProvider: args.currentProvider,
        currentMonthlyCost,
        monthlyTokens: args.monthlyTokens,
        qualityRequirement: args.qualityRequirement,
        bestAlternative: bestAlternative ? {
            model: bestAlternative.model,
            provider: bestAlternative.provider,
            monthlyCost: bestAlternative.monthlyCost,
            monthlySavings: bestAlternative.savings,
            annualSavings: bestAlternative.savings * 12,
            qualityDelta: bestAlternative.qualityImpact,
        } : null,
        allAlternatives: alternatives.slice(0, 5),
        abTestPlan: bestAlternative ? [
            `Run parallel evaluation on 1% of traffic with ${bestAlternative.model}`,
            'Measure key metrics: latency, accuracy, user satisfaction',
            'If metrics within 5% of baseline, gradually increase to 25%',
            'Full rollout after 2 weeks of stable performance',
        ] : ['Current model is optimal for quality requirements'],
        implementationSteps: bestAlternative ? [
            'Create adapter pattern to support multiple model backends',
            'Implement A/B testing infrastructure',
            'Set up monitoring for quality metrics',
            'Gradual rollout with fallback capability',
        ] : [],
        insights: [
            bestAlternative
                ? { type: 'opportunity' as const, message: `Switch to ${bestAlternative.model} for $${Math.round(bestAlternative.savings)}/mo savings`, impact: bestAlternative.savings * 12 }
                : { type: 'benchmark' as const, message: 'Current model is cost-optimal for quality requirements' },
            { type: 'action' as const, message: 'Implement model routing to use cheaper models for simple tasks' },
        ],
    };
}

export function handleReservedInstanceSavings(args: z.infer<typeof ReservedInstanceSavingsSchema>) {
    // Discount rates by provider and commitment
    const discounts: Record<string, { oneYear: number; threeYear: number }> = {
        aws: { oneYear: 0.35, threeYear: 0.55 },
        azure: { oneYear: 0.37, threeYear: 0.57 },
        gcp: { oneYear: 0.37, threeYear: 0.55 },
    };

    const providerDiscounts = discounts[args.provider];
    const oneYearSavings = calculateReservedSavings(args.currentMonthlySpend, providerDiscounts.oneYear);
    const threeYearSavings = calculateReservedSavings(args.currentMonthlySpend, providerDiscounts.threeYear);

    // Recommendation based on usage pattern
    let recommendation: string;
    let reasoning: string;

    if (args.usagePattern === 'steady') {
        recommendation = '3-year reserved';
        reasoning = 'Steady usage pattern indicates reliable long-term needs - maximize savings with 3-year commitment';
    } else if (args.usagePattern === 'variable') {
        recommendation = '1-year reserved';
        reasoning = 'Variable usage suggests some uncertainty - 1-year offers savings with flexibility';
    } else {
        recommendation = 'Savings Plans';
        reasoning = 'Spiky usage benefits from flexible commitment options like AWS Savings Plans';
    }

    // Break-even analysis
    const oneYearBreakEven = Math.ceil(12 * (1 - providerDiscounts.oneYear));
    const threeYearBreakEven = Math.ceil(36 * (1 - providerDiscounts.threeYear));

    return {
        provider: args.provider,
        instanceType: args.instanceType,
        currentMonthlySpend: args.currentMonthlySpend,
        usagePattern: args.usagePattern,
        withReserved: {
            oneYear: oneYearSavings.reservedMonthly,
            threeYear: threeYearSavings.reservedMonthly,
        },
        savingsPercent: {
            oneYear: Math.round(providerDiscounts.oneYear * 100),
            threeYear: Math.round(providerDiscounts.threeYear * 100),
        },
        annualSavings: {
            oneYear: oneYearSavings.yearlySavings,
            threeYear: threeYearSavings.yearlySavings,
        },
        recommendation,
        reasoning,
        breakEven: {
            oneYear: `${oneYearBreakEven} months`,
            threeYear: `${threeYearBreakEven} months`,
        },
        riskAnalysis: {
            downsideScenario: `If you pivot/downsize, potential loss up to $${Math.round(args.currentMonthlySpend * (36 - threeYearBreakEven) * (1 - providerDiscounts.threeYear))} for 3-year`,
            upsideScenario: `Stable usage saves $${Math.round(threeYearSavings.yearlySavings * 3)} over 3 years`,
        },
        insights: [
            { type: 'action' as const, message: `${recommendation} saves $${Math.round(args.usagePattern === 'steady' ? threeYearSavings.yearlySavings : oneYearSavings.yearlySavings)}/year` },
            { type: 'opportunity' as const, message: 'Consider mix of reserved (baseline) + on-demand (peaks)', impact: oneYearSavings.yearlySavings },
        ],
    };
}

export function handleBreakEvenAnalysis(args: z.infer<typeof BreakEvenAnalysisSchema>) {
    const { breakEvenMonths, recommendation } = calculateBreakEven(
        { upfront: args.optionA.upfrontCost, monthly: args.optionA.monthlyCost },
        { upfront: args.optionB.upfrontCost, monthly: args.optionB.monthlyCost }
    );

    // Calculate total costs over time horizon
    const optionATotalCost = args.optionA.upfrontCost + args.optionA.monthlyCost * args.timeHorizon;
    const optionBTotalCost = args.optionB.upfrontCost + args.optionB.monthlyCost * args.timeHorizon;

    const winner = optionATotalCost < optionBTotalCost ? args.optionA.name : args.optionB.name;
    const savings = Math.abs(optionATotalCost - optionBTotalCost);

    // Sensitivity analysis
    const sensitivityPoints = [
        { variable: 'Time horizon +50%', changePercent: 50, newBreakEven: breakEvenMonths ? breakEvenMonths * 0.67 : null },
        { variable: 'Monthly cost +20%', changePercent: 20, newBreakEven: breakEvenMonths ? breakEvenMonths * 1.2 : null },
        { variable: 'Monthly cost -20%', changePercent: -20, newBreakEven: breakEvenMonths ? breakEvenMonths * 0.8 : null },
    ];

    return {
        optionA: {
            name: args.optionA.name,
            upfrontCost: args.optionA.upfrontCost,
            monthlyCost: args.optionA.monthlyCost,
            totalCostAtHorizon: optionATotalCost,
        },
        optionB: {
            name: args.optionB.name,
            upfrontCost: args.optionB.upfrontCost,
            monthlyCost: args.optionB.monthlyCost,
            totalCostAtHorizon: optionBTotalCost,
        },
        breakEvenPoint: breakEvenMonths,
        breakEvenDescription: recommendation,
        timeHorizon: args.timeHorizon,
        winner,
        savingsOverPeriod: savings,
        decisionFramework: breakEvenMonths && breakEvenMonths < args.timeHorizon
            ? `Break-even at ${Math.ceil(breakEvenMonths)} months. If planning to use for ${args.timeHorizon} months, ${winner} saves $${Math.round(savings)}.`
            : `${winner} is better across typical time horizons.`,
        sensitivityAnalysis: sensitivityPoints.filter(s => s.newBreakEven !== null),
        insights: [
            { type: 'action' as const, message: `Choose ${winner} for $${Math.round(savings)} savings over ${args.timeHorizon} months` },
            { type: 'prediction' as const, message: breakEvenMonths ? `Investment pays off after ${Math.ceil(breakEvenMonths)} months` : 'One option dominates across all scenarios' },
        ],
    };
}

// ============== Tool Definitions ==============

export const optimizationTools = [
    {
        name: 'multiCloudOptimization',
        description: 'Analyze multi-cloud strategy with optimal workload distribution. Returns migration roadmap, risk assessment, and projected savings from cloud arbitrage.',
        inputSchema: MultiCloudOptimizationSchema,
        handler: handleMultiCloudOptimization,
    },
    {
        name: 'databaseTierRecommendation',
        description: 'Recommend optimal database tier based on current usage and projected growth. Returns tier recommendation, growth buffer analysis, and upgrade timeline.',
        inputSchema: DatabaseTierRecommendationSchema,
        handler: handleDatabaseTierRecommendation,
    },
    {
        name: 'modelSwitchSavings',
        description: 'Calculate savings from switching AI models while maintaining quality requirements. Returns best alternatives, A/B test plan, and implementation steps.',
        inputSchema: ModelSwitchSavingsSchema,
        handler: handleModelSwitchSavings,
    },
    {
        name: 'reservedInstanceSavings',
        description: 'Analyze reserved instance vs on-demand savings with risk assessment. Returns commitment recommendations, break-even analysis, and upside/downside scenarios.',
        inputSchema: ReservedInstanceSavingsSchema,
        handler: handleReservedInstanceSavings,
    },
    {
        name: 'breakEvenAnalysis',
        description: 'Compare two pricing options with break-even analysis. Returns break-even point, sensitivity analysis, and clear decision framework.',
        inputSchema: BreakEvenAnalysisSchema,
        handler: handleBreakEvenAnalysis,
    },
];
