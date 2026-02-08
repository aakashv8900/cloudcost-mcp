// SaaS & Startup Burn Tools
import { z } from 'zod';
import {
    forecastRunway,
    recommendCostReduction,
    getStageRecommendations,
} from '../engine/pricing-engine.js';
import type { StartupStage } from '../engine/types.js';

// ============== Schema Definitions ==============

export const CalculateSaaSBurnSchema = z.object({
    services: z.array(z.object({
        name: z.string().describe('Service name'),
        monthlyCost: z.number().describe('Monthly cost in USD'),
        category: z.enum(['ai', 'compute', 'storage', 'database', 'saas', 'other']).describe('Service category'),
    })).describe('List of services and their monthly costs'),
});

export const SuggestOptimalPlanSchema = z.object({
    serviceName: z.enum(['vercel', 'supabase', 'mongodb', 'cloudflare', 'railway', 'neon', 'planetscale'])
        .describe('Service to analyze'),
    currentPlan: z.string().describe('Current plan name'),
    monthlyUsage: z.object({
        requests: z.number().optional(),
        storage: z.number().optional(),
        bandwidth: z.number().optional(),
        compute: z.number().optional(),
    }).describe('Monthly usage metrics'),
});

export const ForecastRunwaySchema = z.object({
    monthlyInfraCost: z.number().min(0).describe('Total monthly infrastructure cost'),
    monthlyRevenue: z.number().min(0).describe('Monthly recurring revenue'),
    cashInBank: z.number().min(0).describe('Current cash in bank'),
    monthlyGrowthRate: z.number().min(-1).max(10).default(0.1).describe('Monthly cost growth rate'),
});

export const CostBreakdownByServiceSchema = z.object({
    services: z.array(z.object({
        name: z.string(),
        monthlyCost: z.number(),
        category: z.string(),
    })).describe('Services to categorize'),
    stage: z.enum(['pre-seed', 'seed', 'series-a', 'scaling']).describe('Startup stage'),
});

export const RecommendCostReductionSchema = z.object({
    services: z.array(z.object({
        name: z.string(),
        cost: z.number(),
        category: z.string(),
    })).describe('Current service costs'),
    targetReduction: z.number().min(0).max(1).default(0.2).describe('Target reduction percentage (0.2 = 20%)'),
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
        percentageOfTotal: Math.round((s.monthlyCost / totalBurn) * 100),
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
    // Service plan definitions
    const servicePlans: Record<string, { plans: { name: string; cost: number; limits: Record<string, number> }[] }> = {
        vercel: {
            plans: [
                { name: 'hobby', cost: 0, limits: { bandwidth: 100, functions: 100 } },
                { name: 'pro', cost: 20, limits: { bandwidth: 1000, functions: 1000 } },
            ],
        },
        supabase: {
            plans: [
                { name: 'free', cost: 0, limits: { storage: 0.5, bandwidth: 2 } },
                { name: 'pro', cost: 25, limits: { storage: 8, bandwidth: 250 } },
            ],
        },
        mongodb: {
            plans: [
                { name: 'm0', cost: 0, limits: { storage: 0.5 } },
                { name: 'm10', cost: 57, limits: { storage: 10 } },
                { name: 'm20', cost: 140, limits: { storage: 20 } },
            ],
        },
        cloudflare: {
            plans: [
                { name: 'free', cost: 0, limits: { requests: 100000 } },
                { name: 'pro', cost: 20, limits: { requests: Infinity } },
            ],
        },
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

    const service = servicePlans[args.serviceName];
    if (!service) {
        throw new Error(`Unknown service: ${args.serviceName}`);
    }

    const currentPlanData = service.plans.find(p => p.name === args.currentPlan);
    if (!currentPlanData) {
        throw new Error(`Unknown plan: ${args.currentPlan} for ${args.serviceName}`);
    }

    // Check if current plan meets usage
    const usageCheck = Object.entries(args.monthlyUsage).map(([metric, usage]) => {
        if (!usage) return null;
        const limit = currentPlanData.limits[metric];
        if (!limit) return null;
        return {
            metric,
            usage,
            limit,
            utilization: (usage / limit) * 100,
            overLimit: usage > limit,
        };
    }).filter(Boolean);

    // Find optimal plan
    const optimalPlan = service.plans.find(plan => {
        return Object.entries(args.monthlyUsage).every(([metric, usage]) => {
            if (!usage) return true;
            const limit = plan.limits[metric];
            return limit === Infinity || usage <= limit;
        });
    }) || service.plans[service.plans.length - 1];

    const savingsPerMonth = currentPlanData.cost - optimalPlan.cost;

    return {
        service: args.serviceName,
        currentPlan: args.currentPlan,
        currentCost: currentPlanData.cost,
        recommendedPlan: optimalPlan.name,
        recommendedCost: optimalPlan.cost,
        monthlySavings: savingsPerMonth > 0 ? savingsPerMonth : 0,
        annualSavings: (savingsPerMonth > 0 ? savingsPerMonth : 0) * 12,
        usageAnalysis: usageCheck,
        featuresLost: savingsPerMonth > 0 ? ['Some premium features'] : [],
        whenToUpgrade: usageCheck.some(u => u && u.utilization > 80)
            ? 'Consider upgrading soon - usage at 80%+ capacity'
            : 'Current plan adequate for foreseeable future',
        insights: [
            {
                type: savingsPerMonth > 0 ? 'opportunity' as const : 'benchmark' as const,
                message: savingsPerMonth > 0
                    ? `Switch to ${optimalPlan.name} to save $${savingsPerMonth}/month`
                    : 'Already on optimal plan for your usage',
                impact: savingsPerMonth * 12,
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
        handler: handleCalculateSaaSBurn,
    },
    {
        name: 'suggestOptimalPlan',
        description: 'Recommend the best pricing plan for a specific service based on usage. Analyzes current utilization and identifies potential savings or upgrade needs.',
        inputSchema: SuggestOptimalPlanSchema,
        handler: handleSuggestOptimalPlan,
    },
    {
        name: 'forecastRunway',
        description: 'Project startup runway with burn trajectory analysis. Returns runway months, decision points for fundraising, and investor-ready metrics like burn multiple.',
        inputSchema: ForecastRunwaySchema,
        handler: handleForecastRunway,
    },
    {
        name: 'costBreakdownByService',
        description: 'Break down infrastructure costs by category with stage-appropriate recommendations. Compares spending against benchmarks for your startup stage.',
        inputSchema: CostBreakdownByServiceSchema,
        handler: handleCostBreakdownByService,
    },
    {
        name: 'recommendCostReductionStrategies',
        description: 'Generate prioritized cost reduction strategies with implementation effort and savings estimates. Returns quick wins and strategic optimizations.',
        inputSchema: RecommendCostReductionSchema,
        handler: handleRecommendCostReduction,
    },
];
