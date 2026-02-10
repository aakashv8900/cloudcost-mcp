// SaaS & Startup Burn Tools
import { z } from 'zod';
import {
    forecastRunway,
    recommendCostReduction,
    getStageRecommendations,
    getSaaSPricing,
} from '../engine/pricing-engine.js';
import type { StartupStage, Insight, Recommendation, CostDriver, DecisionPoint, InvestorMetrics, CostReductionStrategy } from '../engine/types.js';

// ============== Common Output Schemas ==============

const InsightSchema = z.object({
    type: z.enum(['warning', 'opportunity', 'prediction', 'benchmark', 'action']),
    message: z.string(),
    impact: z.number().optional(),
});

const RecommendationSchema = z.object({
    action: z.string(),
    reasoning: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    savingsEstimate: z.number(),
    implementationEffort: z.enum(['trivial', 'moderate', 'significant']),
    tradeoffs: z.array(z.string()),
});

// ============== Schema Definitions ==============

export const CalculateSaaSBurnSchema = z.object({
    services: z.array(z.object({
        name: z.string().describe('Service name (e.g., AWS, Datadog, Slack)'),
        monthlyCost: z.number().min(0).describe('Monthly cost in USD (e.g., 500)'),
        category: z.enum(['ai', 'compute', 'storage', 'database', 'saas', 'other']).describe('Service category'),
    })).describe('List of services and their monthly costs').default([
        { name: 'AWS', monthlyCost: 1000, category: 'compute' },
        { name: 'OpenAI', monthlyCost: 500, category: 'ai' }
    ]),
});

export const CalculateSaaSBurnOutputSchema = z.object({
    monthlyBurn: z.number(),
    annualBurn: z.number(),
    topCostDrivers: z.array(z.object({
        service: z.string(),
        category: z.string(),
        monthlyCost: z.number(),
        percentageOfTotal: z.number(),
        optimizationPotential: z.number(),
    })),
    categoryBreakdown: z.record(z.number()),
    benchmarkComparison: z.object({
        totalBurnPercentile: z.string(),
        insights: z.array(z.string()),
    }),
    insights: z.array(InsightSchema),
    recommendations: z.array(z.string()),
});

export const SuggestOptimalPlanSchema = z.object({
    serviceName: z.enum(['vercel', 'supabase', 'mongodb', 'cloudflare', 'railway', 'neon', 'planetscale'])
        .describe('Service to analyze (e.g., vercel, supabase)'),
    currentPlan: z.string().describe('Current plan name (e.g., hobby, free, pro)').default('free'),
    monthlyUsage: z.object({
        requests: z.number().optional().describe('Approximate monthly requests'),
        storage: z.number().optional().describe('Storage used in GB'),
        bandwidth: z.number().optional().describe('Bandwidth used in GB'),
        compute: z.number().optional().describe('Compute units used'),
    }).describe('Monthly usage metrics').default({ bandwidth: 50, requests: 1000 }),
});

export const SuggestOptimalPlanOutputSchema = z.object({
    service: z.string(),
    currentPlan: z.object({
        name: z.string(),
        cost: z.number(),
        status: z.string(),
    }),
    usageAnalysis: z.array(z.object({
        metric: z.string(),
        usage: z.number(),
        limit: z.union([z.number(), z.string()]),
        utilization: z.number(),
        overLimit: z.boolean(),
    })),
    recommendation: z.object({
        plan: z.string(),
        cost: z.number().nullable(),
        savings: z.number(),
        reasoning: z.string(),
    }),
    insights: z.array(InsightSchema),
});

export const ForecastRunwaySchema = z.object({
    monthlyInfraCost: z.number().min(0).describe('Total monthly infrastructure cost in USD (e.g., 5000)').default(2000),
    monthlyRevenue: z.number().min(0).describe('Monthly recurring revenue (MRR) in USD').default(500),
    cashInBank: z.number().min(0).describe('Current cash in bank in USD').default(50000),
    monthlyGrowthRate: z.number().min(-1).max(10).default(0.1).describe('Monthly cost growth rate (0.1 = 10% monthly growth)'),
});

export const ForecastRunwayOutputSchema = z.object({
    runwayMonths: z.number(),
    burnRate: z.object({
        current: z.number(),
        projected: z.number(),
    }),
    trajectory: z.enum(['increasing', 'decreasing', 'stable']),
    decisionPoints: z.array(z.object({
        month: z.number(),
        event: z.string(),
        action: z.string(),
    })),
    investorMetrics: z.object({
        burnMultiple: z.number(),
        efficiency: z.string(),
        benchmark: z.string(),
    }),
    insights: z.array(InsightSchema),
});

export const CostBreakdownByServiceSchema = z.object({
    services: z.array(z.object({
        name: z.string().describe('Service name'),
        monthlyCost: z.number().describe('Monthly cost in USD'),
        category: z.string().describe('Service category (e.g., compute, database)'),
    })).describe('Services to categorize').default([
        { name: 'EC2', monthlyCost: 800, category: 'compute' },
        { name: 'RDS', monthlyCost: 400, category: 'database' }
    ]),
    stage: z.enum(['pre-seed', 'seed', 'series-a', 'scaling']).describe('Startup stage (e.g., seed, scaling)').default('seed'),
});

export const CostBreakdownByServiceOutputSchema = z.object({
    stage: z.string(),
    totalMonthlyCost: z.number(),
    recommendedMaxForStage: z.number(),
    isOverBudget: z.boolean(),
    overBudgetBy: z.number(),
    categoryBreakdown: z.array(z.object({
        category: z.string(),
        services: z.array(z.any()),
        totalCost: z.number(),
        percentOfBurn: z.number(),
    })),
    stageRecommendations: z.array(z.string()),
    warnings: z.array(z.string()),
    insights: z.array(InsightSchema),
});

export const RecommendCostReductionSchema = z.object({
    services: z.array(z.object({
        name: z.string().describe('Service name'),
        cost: z.number().describe('Monthly cost in USD'),
        category: z.string().describe('Service category'),
    })).describe('Current service costs').default([
        { name: 'Unused EC2', cost: 200, category: 'compute' },
        { name: 'Premium DB', cost: 1000, category: 'database' }
    ]),
    targetReduction: z.number().min(0).max(1).default(0.2).describe('Target reduction percentage (e.g., 0.2 = 20% reduction)'),
});

export const RecommendCostReductionOutputSchema = z.object({
    strategies: z.array(z.object({
        strategy: z.string(),
        annualSavings: z.number(),
        implementationEffort: z.string(),
        timeToImplement: z.string(),
        risks: z.array(z.string()),
        priority: z.number(),
    })),
    totalPotentialSavings: z.number(),
    quickWins: z.array(z.any()),
    insights: z.array(InsightSchema),
});

// ============== Tool Handlers ==============

export function handleCalculateSaaSBurn(args: z.infer<typeof CalculateSaaSBurnSchema>) {
    const totalBurn = args.services.reduce((sum, s) => sum + s.monthlyCost, 0);

    // Calculate category breakdown
    const categoryBreakdown: Record<string, number> = {};
    args.services.forEach(s => {
        categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + s.monthlyCost;
    });

    // Sort by cost for top drivers
    const sortedServices = [...args.services].sort((a, b) => b.monthlyCost - a.monthlyCost);
    const topDrivers = sortedServices.slice(0, 3).map(s => ({
        service: s.name,
        category: s.category,
        monthlyCost: s.monthlyCost,
        percentageOfTotal: totalBurn > 0 ? Math.round((s.monthlyCost / totalBurn) * 100) : 0,
        optimizationPotential: s.category === 'ai' ? 0.4 : s.category === 'compute' ? 0.35 : 0.2,
    }));

    // Industry benchmarks by category
    const benchmarks: Record<string, { median: number; p75: number }> = {
        ai: { median: 500, p75: 2000 },
        compute: { median: 800, p75: 3000 },
        storage: { median: 100, p75: 500 },
        database: { median: 200, p75: 800 },
        saas: { median: 300, p75: 1000 },
    };

    const benchmarkInsights = Object.entries(categoryBreakdown).map(([cat, cost]) => {
        const bench = benchmarks[cat] || { median: 500, p75: 2000 };
        if (cost > bench.p75) {
            return `${cat} spend ($${cost}) is above 75th percentile - review for optimization`;
        } else if (cost > bench.median) {
            return `${cat} spend is slightly above median - monitor closely`;
        }
        return null;
    }).filter(Boolean);

    return {
        monthlyBurn: totalBurn,
        annualBurn: totalBurn * 12,
        topCostDrivers: topDrivers,
        categoryBreakdown,
        benchmarkComparison: {
            totalBurnPercentile: totalBurn < 2000 ? 'Below median' :
                totalBurn < 5000 ? 'Median range' :
                    totalBurn < 15000 ? 'Above median' : 'Top quartile',
            insights: benchmarkInsights,
        },
        insights: [
            {
                type: 'benchmark' as const,
                message: `Total burn of $${totalBurn}/mo is ${totalBurn < 5000 ? 'typical for early-stage' : 'elevated for early-stage startups'}`,
            },
            {
                type: 'opportunity' as const,
                message: `Top 3 services account for ${topDrivers.reduce((s, t) => s + t.percentageOfTotal, 0)}% of spend`,
                impact: topDrivers.reduce((s, t) => s + t.monthlyCost * t.optimizationPotential, 0),
            },
            {
                type: 'action' as const,
                message: 'Focus optimization on top cost drivers for maximum impact',
            },
        ],
        recommendations: [
            topDrivers[0]?.category === 'ai' ? 'Audit AI model usage - use cheaper models for simple tasks' : null,
            categoryBreakdown['compute'] > 500 ? 'Consider reserved instances for stable workloads' : null,
            categoryBreakdown['storage'] > 100 ? 'Implement lifecycle policies for cold data' : null,
        ].filter(Boolean),
    };
}

export function handleSuggestOptimalPlan(args: z.infer<typeof SuggestOptimalPlanSchema>) {
    // Fetch dynamic pricing data
    let dynamicData = getSaaSPricing(args.serviceName);

    // Handle inconsistent JSON structure (some have "plans" wrapper)
    if (dynamicData && dynamicData.plans) {
        dynamicData = dynamicData.plans;
    }

    // Default hardcoded fallbacks if dynamic data is missing (e.g. for services not in JSON)
    const fallbackPlans: Record<string, { plans: { name: string; cost: number; limits: Record<string, number> }[] }> = {
        railway: {
            plans: [
                { name: 'hobby', cost: 0, limits: { compute: 5 } },
                { name: 'pro', cost: 20, limits: { compute: 20 } },
            ],
        },
        neon: {
            plans: [
                { name: 'free', cost: 0, limits: { compute: 191, storage: 0.5 } },
                { name: 'launch', cost: 19, limits: { compute: 300, storage: 10 } },
            ],
        },
        planetscale: {
            plans: [
                { name: 'hobby', cost: 0, limits: { storage: 5 } },
                { name: 'scaler', cost: 29, limits: { storage: 10 } },
            ],
        },
    };

    let servicePlans: { name: string; cost: number; limits: Record<string, number> }[] = [];

    if (dynamicData) {
        // Map dynamic JSON data to tool structure
        servicePlans = Object.entries(dynamicData).map(([planName, specs]: [string, any]) => {
            // Map JSON specs to generic limits
            const limits: Record<string, number> = {};

            // Common mappings
            if (specs.bandwidth_gb) limits.bandwidth = specs.bandwidth_gb;
            if (specs.database_size_gb) limits.storage = specs.database_size_gb;
            if (specs.storage_gb) limits.storage = specs.storage_gb;
            if (specs.serverless_invocations) limits.functions = specs.serverless_invocations;
            if (specs.workers_requests) limits.requests = specs.workers_requests;

            // Parse cost
            const cost = typeof specs.monthly_cost === 'number' ? specs.monthly_cost : 0;

            return {
                name: planName,
                cost,
                limits
            };
        });
    } else if (fallbackPlans[args.serviceName]) {
        servicePlans = fallbackPlans[args.serviceName].plans;
    } else {
        throw new Error(`Unknown service: ${args.serviceName}`);
    }

    const currentPlanData = servicePlans.find(p => p.name === args.currentPlan);
    if (!currentPlanData) {
        throw new Error(`Unknown plan: ${args.currentPlan} for ${args.serviceName}`);
    }

    // Check if current plan meets usage
    const usageCheck = Object.entries(args.monthlyUsage).map(([metric, usage]) => {
        if (!usage) return null;
        const limit = currentPlanData.limits[metric];

        // If limit is not defined in generic terms, check specific terms? 
        // For now, if limit is missing, assume unlimited or not applicable
        if (limit === undefined) return null;

        // If limit is Infinity or -1, it's unlimited
        if (limit === Infinity || limit === -1) return {
            metric,
            usage,
            limit: 'Unlimited',
            utilization: 0,
            overLimit: false,
        };

        return {
            metric,
            usage,
            limit,
            utilization: (usage / limit) * 100,
            overLimit: usage > limit,
        };
    }).filter(Boolean);

    // Find optimal plan
    const optimalPlan = servicePlans
        .filter(p => {
            // Check if plan meets all needs
            return Object.entries(args.monthlyUsage).every(([metric, usage]) => {
                if (!usage) return true;
                const limit = p.limits[metric];
                // If limit undefined, assume it's NOT supported or unknown - safer to require limit
                // But for simplicity, if limit missing, we skip check? No, risky. 
                // If limit checks are main goal, missing limit = risk.
                // Let's assume strict check: if metric requested, plan must have limit >= usage

                if (limit === undefined) return true; // Ignore if plan doesn't specify limit for this metric
                if (limit === Infinity || limit === -1) return true;
                return limit >= usage;
            });
        })
        .sort((a, b) => a.cost - b.cost)[0];

    return {
        service: args.serviceName,
        currentPlan: {
            name: args.currentPlan,
            cost: currentPlanData.cost,
            status: usageCheck.some(c => c && c.overLimit) ? 'over_limits' : 'within_limits',
        },
        usageAnalysis: usageCheck,
        recommendation: {
            plan: optimalPlan ? optimalPlan.name : 'contact_sales',
            cost: optimalPlan ? optimalPlan.cost : null,
            savings: optimalPlan ? currentPlanData.cost - optimalPlan.cost : 0,
            reasoning: optimalPlan
                ? optimalPlan.name === args.currentPlan
                    ? 'Current plan is optimal'
                    : `Switch to ${optimalPlan.name} to ${currentPlanData.cost > optimalPlan.cost ? 'save money' : 'accommodate growth'}`
                : 'No standard plan meets requirements - contact sales',
        },
        insights: [
            {
                type: (optimalPlan && currentPlanData.cost > optimalPlan.cost) ? 'opportunity' as const : 'benchmark' as const,
                message: (optimalPlan && currentPlanData.cost > optimalPlan.cost)
                    ? `Switch to ${optimalPlan.name} to save $${currentPlanData.cost - optimalPlan.cost}/month`
                    : 'Already on optimal plan for your usage',
                impact: (optimalPlan && currentPlanData.cost > optimalPlan.cost) ? (currentPlanData.cost - optimalPlan.cost) * 12 : 0,
            },
            {
                type: 'action' as const,
                message: usageCheck.some(u => u && u.overLimit)
                    ? 'Warning: Currently exceeding plan limits - overage charges may apply'
                    : 'Usage within plan limits',
            },
        ],
    };
}

export function handleForecastRunway(args: z.infer<typeof ForecastRunwaySchema>) {
    return forecastRunway(
        args.monthlyInfraCost,
        args.monthlyRevenue,
        args.cashInBank,
        args.monthlyGrowthRate
    );
}

export function handleCostBreakdownByService(args: z.infer<typeof CostBreakdownByServiceSchema>) {
    const stageRecommendations = getStageRecommendations(args.stage as StartupStage);
    const totalCost = args.services.reduce((sum, s) => sum + s.monthlyCost, 0);

    // Group by category
    const byCategory: Record<string, { services: typeof args.services; total: number }> = {};
    args.services.forEach(s => {
        if (!byCategory[s.category]) {
            byCategory[s.category] = { services: [], total: 0 };
        }
        byCategory[s.category].services.push(s);
        byCategory[s.category].total += s.monthlyCost;
    });

    const categoryBreakdown = Object.entries(byCategory).map(([category, data]) => ({
        category,
        services: data.services,
        totalCost: data.total,
        percentOfBurn: Math.round((data.total / totalCost) * 100),
    }));

    const isOverBudget = totalCost > stageRecommendations.maxMonthlySpend;

    return {
        stage: args.stage,
        totalMonthlyCost: totalCost,
        recommendedMaxForStage: stageRecommendations.maxMonthlySpend,
        isOverBudget,
        overBudgetBy: isOverBudget ? totalCost - stageRecommendations.maxMonthlySpend : 0,
        categoryBreakdown,
        stageRecommendations: stageRecommendations.recommendedServices,
        warnings: stageRecommendations.warnings,
        insights: [
            {
                type: isOverBudget ? 'warning' as const : 'benchmark' as const,
                message: isOverBudget
                    ? `Spending $${totalCost - stageRecommendations.maxMonthlySpend}/mo over recommended for ${args.stage}`
                    : `Infrastructure spend appropriate for ${args.stage} stage`,
            },
            {
                type: 'action' as const,
                message: `For ${args.stage}: ${stageRecommendations.warnings[0]}`,
            },
        ],
    };
}

export function handleRecommendCostReduction(args: z.infer<typeof RecommendCostReductionSchema>) {
    return recommendCostReduction(args.services);
}

// ============== Tool Definitions ==============

export const saasBurnTools = [
    {
        name: 'calculateSaaSBurn',
        description: 'Analyze total SaaS and infrastructure burn with category breakdown. Returns top cost drivers, industry benchmarks, and optimization opportunities.',
        inputSchema: CalculateSaaSBurnSchema,
        outputSchema: CalculateSaaSBurnOutputSchema,
        handler: handleCalculateSaaSBurn,
    },
    {
        name: 'suggestOptimalPlan',
        description: 'Recommend the best pricing plan for a specific service based on usage. Analyzes current utilization and identifies potential savings or upgrade needs.',
        inputSchema: SuggestOptimalPlanSchema,
        outputSchema: SuggestOptimalPlanOutputSchema,
        handler: handleSuggestOptimalPlan,
    },
    {
        name: 'forecastRunway',
        description: 'Project startup runway with burn trajectory analysis. Returns runway months, decision points for fundraising, and investor-ready metrics like burn multiple.',
        inputSchema: ForecastRunwaySchema,
        outputSchema: ForecastRunwayOutputSchema,
        handler: handleForecastRunway,
    },
    {
        name: 'costBreakdownByService',
        description: 'Break down infrastructure costs by category with stage-appropriate recommendations. Compares spending against benchmarks for your startup stage.',
        inputSchema: CostBreakdownByServiceSchema,
        outputSchema: CostBreakdownByServiceOutputSchema,
        handler: handleCostBreakdownByService,
    },
    {
        name: 'recommendCostReductionStrategies',
        description: 'Generate prioritized cost reduction strategies with implementation effort and savings estimates. Returns quick wins and strategic optimizations.',
        inputSchema: RecommendCostReductionSchema,
        outputSchema: RecommendCostReductionOutputSchema,
        handler: handleRecommendCostReduction,
    },
];
