// Advanced Optimization Tools
import { z } from 'zod';
import {
    calculateBreakEven,
    calculateReservedSavings,
    forecastCost,
} from '../engine/formulas.js';
import { compareProviders } from '../engine/intelligence.js';
import type { Provider, WorkloadType } from '../engine/types.js';

// ============== Schema Definitions ==============

export const MultiCloudOptimizationSchema = z.object({
    workloadProfile: z.object({
        workloadType: z.enum(['api-heavy', 'batch-processing', 'ml-training', 'web-app', 'realtime']),
        monthlyBudget: z.number().min(0),
        primaryProvider: z.enum(['aws', 'azure', 'gcp']).optional(),
    }).describe('Current workload characteristics'),
    currentCosts: z.object({
        aws: z.number().optional(),
        azure: z.number().optional(),
        gcp: z.number().optional(),
    }).describe('Current costs per provider'),
});

export const DatabaseTierRecommendationSchema = z.object({
    provider: z.enum(['supabase', 'mongodb', 'neon', 'planetscale']).describe('Database provider'),
    currentUsage: z.object({
        connectionCount: z.number().optional(),
        storageGb: z.number(),
        queriesPerSecond: z.number().optional(),
        monthlyReads: z.number().optional(),
        monthlyWrites: z.number().optional(),
    }).describe('Current database usage metrics'),
    expectedGrowth: z.number().min(0).max(10).default(0.2).describe('Expected monthly growth rate'),
});

export const ModelSwitchSavingsSchema = z.object({
    currentModel: z.string().describe('Current AI model in use'),
    currentProvider: z.enum(['openai', 'anthropic']).describe('Current provider'),
    monthlyTokens: z.number().min(0).describe('Monthly token usage'),
    qualityRequirement: z.enum(['highest', 'high', 'medium', 'acceptable']).describe('Minimum quality level'),
});

export const ReservedInstanceSavingsSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider'),
    instanceType: z.string().describe('Instance type'),
    currentMonthlySpend: z.number().min(0).describe('Current monthly on-demand spend'),
    usagePattern: z.enum(['steady', 'variable', 'spiky']).describe('Usage pattern'),
});

export const BreakEvenAnalysisSchema = z.object({
    optionA: z.object({
        name: z.string(),
        upfrontCost: z.number().min(0),
        monthlyCost: z.number().min(0),
    }).describe('First option to compare'),
    optionB: z.object({
        name: z.string(),
        upfrontCost: z.number().min(0),
        monthlyCost: z.number().min(0),
    }).describe('Second option to compare'),
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
    // Database tier definitions
    const dbTiers: Record<string, { name: string; cost: number; limits: Record<string, number> }[]> = {
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

    const tiers = dbTiers[args.provider];

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
    // Model cost and quality data
    const modelData: Record<string, { cost: number; quality: number; provider: string }> = {
        'gpt-4o': { cost: 7.5, quality: 95, provider: 'openai' },
        'gpt-4o-mini': { cost: 0.375, quality: 82, provider: 'openai' },
        'o1': { cost: 37.5, quality: 98, provider: 'openai' },
        'o1-mini': { cost: 7.5, quality: 90, provider: 'openai' },
        'o3-mini': { cost: 2.75, quality: 88, provider: 'openai' },
        'claude-3-5-sonnet': { cost: 9, quality: 94, provider: 'anthropic' },
        'claude-3-5-haiku': { cost: 2.4, quality: 80, provider: 'anthropic' },
        'claude-3-opus': { cost: 45, quality: 96, provider: 'anthropic' },
    };

    const qualityThresholds: Record<string, number> = {
        highest: 95,
        high: 88,
        medium: 80,
        acceptable: 70,
    };

    const current = modelData[args.currentModel];
    if (!current) {
        throw new Error(`Unknown model: ${args.currentModel}`);
    }

    const currentMonthlyCost = (args.monthlyTokens / 1_000_000) * current.cost;
    const minQuality = qualityThresholds[args.qualityRequirement];

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
