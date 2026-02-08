// Intelligence Engine - Transforms raw pricing data into actionable insights
import type {
    Insight,
    Recommendation,
    Alternative,
    ConfidenceLevel,
    TaskType,
    WorkloadType,
    StartupStage,
    Provider,
} from './types.js';

// ============== Insight Generation ==============

/**
 * Generate insights for AI model usage
 */
export function generateModelInsights(
    model: string,
    monthlyTokens: number,
    monthlyCost: number,
    alternatives: { model: string; cost: number }[]
): Insight[] {
    const insights: Insight[] = [];

    // Check for cheaper alternatives
    for (const alt of alternatives) {
        if (alt.cost < monthlyCost * 0.7) {
            const savings = monthlyCost - alt.cost;
            insights.push({
                type: 'opportunity',
                message: `Switching to ${alt.model} could save $${savings.toFixed(2)}/month`,
                impact: savings,
            });
        }
    }

    // High volume optimization
    if (monthlyTokens > 10_000_000) {
        insights.push({
            type: 'opportunity',
            message: 'At your volume, consider Batch API for 50% cost reduction on non-realtime tasks',
            impact: monthlyCost * 0.5,
        });
    }

    // Rate limit warning
    if (monthlyTokens > 50_000_000 && model.includes('mini')) {
        insights.push({
            type: 'warning',
            message: 'High volume on smaller models may hit rate limits - consider provisioned throughput',
        });
    }

    // Cost benchmark
    if (monthlyCost > 5000) {
        insights.push({
            type: 'benchmark',
            message: `$${monthlyCost.toFixed(0)}/mo is in the top 20% of AI API spend for seed-stage startups`,
        });
    }

    return insights;
}

/**
 * Generate insights for cloud compute usage
 */
export function generateComputeInsights(
    provider: Provider,
    instanceType: string,
    monthlyCost: number,
    utilizationPercent?: number
): Insight[] {
    const insights: Insight[] = [];

    // Overprovisioning warning
    if (utilizationPercent !== undefined && utilizationPercent < 30) {
        insights.push({
            type: 'warning',
            message: `Instance utilization at ${utilizationPercent}% suggests overprovisioning - consider downsizing`,
            impact: monthlyCost * 0.4,
        });
    }

    // Reserved instance opportunity
    if (monthlyCost > 200) {
        const reservedSavings = monthlyCost * 0.35;
        insights.push({
            type: 'opportunity',
            message: `Reserved instances could save ~$${reservedSavings.toFixed(0)}/month with 1-year commitment`,
            impact: reservedSavings * 12,
        });
    }

    // Spot/preemptible suggestion
    if (instanceType.includes('batch') || instanceType.includes('worker')) {
        insights.push({
            type: 'action',
            message: 'Batch workloads can use Spot/Preemptible instances for 60-90% savings',
            impact: monthlyCost * 0.7,
        });
    }

    return insights;
}

/**
 * Generate runway insights
 */
export function generateRunwayInsights(
    runwayMonths: number,
    monthlyBurn: number,
    growthRate: number
): Insight[] {
    const insights: Insight[] = [];

    // Critical runway warning
    if (runwayMonths < 6) {
        insights.push({
            type: 'warning',
            message: 'Critical: Less than 6 months runway - immediate action required',
        });
    } else if (runwayMonths < 12) {
        insights.push({
            type: 'warning',
            message: 'Runway below 12 months - start fundraising conversations now',
        });
    }

    // Burn reduction impact
    const burnReductionImpact = (monthlyBurn * 0.2) / monthlyBurn * runwayMonths;
    if (burnReductionImpact > 2) {
        insights.push({
            type: 'action',
            message: `Cutting costs by 20% extends runway by ${burnReductionImpact.toFixed(1)} months`,
            impact: monthlyBurn * 0.2 * runwayMonths,
        });
    }

    // Growth rate warning
    if (growthRate > 0.15) {
        insights.push({
            type: 'prediction',
            message: `At ${(growthRate * 100).toFixed(0)}% MoM growth, burn will double in ${Math.ceil(Math.log(2) / Math.log(1 + growthRate))} months`,
        });
    }

    return insights;
}

// ============== Recommendation Generation ==============

/**
 * Generate model recommendation based on task type and constraints
 */
export function recommendModel(
    taskType: TaskType,
    budget: number,
    latency: string,
    models: { name: string; cost: number; latency: string; quality: number; bestFor: string[] }[]
): { model: string; reasoning: string; confidence: ConfidenceLevel; alternatives: Alternative[] } {
    // Filter by latency requirement
    const latencyOrder = ['low', 'medium', 'high'];
    const maxLatency = latencyOrder.indexOf(latency);
    const eligibleModels = models.filter(m => latencyOrder.indexOf(m.latency) <= maxLatency);

    // Filter by budget
    const affordableModels = eligibleModels.filter(m => m.cost <= budget);

    if (affordableModels.length === 0) {
        return {
            model: eligibleModels[0]?.name || 'gpt-4o-mini',
            reasoning: 'Budget constraint too tight - recommending cheapest option that meets latency requirement',
            confidence: 'low',
            alternatives: eligibleModels.slice(0, 3).map(m => ({
                option: m.name,
                whyNot: `Costs $${m.cost}/1M tokens vs $${budget} budget`,
                costDifference: m.cost - budget,
            })),
        };
    }

    // Score models by task fit
    const scoredModels = affordableModels.map(m => ({
        ...m,
        score: (m.bestFor.includes(taskType) ? 50 : 0) + m.quality - (m.cost / budget) * 20,
    }));

    scoredModels.sort((a, b) => b.score - a.score);
    const winner = scoredModels[0];

    const alternatives = scoredModels.slice(1, 4).map(m => ({
        option: m.name,
        whyNot: m.bestFor.includes(taskType)
            ? `Higher cost ($${m.cost}/1M) for similar performance`
            : `Not optimized for ${taskType} tasks`,
        costDifference: m.cost - winner.cost,
    }));

    return {
        model: winner.name,
        reasoning: winner.bestFor.includes(taskType)
            ? `Best cost/performance for ${taskType} within budget`
            : `Best available option within constraints`,
        confidence: winner.bestFor.includes(taskType) ? 'high' : 'medium',
        alternatives,
    };
}

/**
 * Generate cost reduction recommendations
 */
export function generateCostReductions(
    services: { name: string; cost: number; category: string }[],
    totalBurn: number
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Sort by cost to find top drivers
    const sortedServices = [...services].sort((a, b) => b.cost - a.cost);

    // Check for reserved instance opportunities
    const computeServices = services.filter(s => s.category === 'compute');
    const computeTotal = computeServices.reduce((sum, s) => sum + s.cost, 0);
    if (computeTotal > 500) {
        recommendations.push({
            action: 'Convert on-demand compute to 1-year reserved instances',
            reasoning: 'Steady workload pattern indicates predictable compute needs',
            confidence: 'high',
            savingsEstimate: computeTotal * 0.35 * 12,
            implementationEffort: 'trivial',
            tradeoffs: ['Less flexibility if needs change', 'Upfront commitment required'],
        });
    }

    // Check for AI model optimization
    const aiServices = services.filter(s => s.category === 'ai');
    const aiTotal = aiServices.reduce((sum, s) => sum + s.cost, 0);
    if (aiTotal > 200) {
        recommendations.push({
            action: 'Audit AI model usage - consider cheaper models for simple tasks',
            reasoning: 'Most API calls may not require flagship models',
            confidence: 'medium',
            savingsEstimate: aiTotal * 0.4 * 12,
            implementationEffort: 'moderate',
            tradeoffs: ['Potential quality degradation', 'Testing required'],
        });
    }

    // Check for storage tiering
    const storageServices = services.filter(s => s.category === 'storage');
    const storageTotal = storageServices.reduce((sum, s) => sum + s.cost, 0);
    if (storageTotal > 100) {
        recommendations.push({
            action: 'Implement storage lifecycle policies - move cold data to cheaper tiers',
            reasoning: 'Typically 60-80% of stored data is rarely accessed',
            confidence: 'high',
            savingsEstimate: storageTotal * 0.5 * 12,
            implementationEffort: 'moderate',
            tradeoffs: ['Retrieval latency for cold data', 'Initial setup time'],
        });
    }

    // Overall burn reduction
    if (totalBurn > 10000) {
        recommendations.push({
            action: 'Conduct infrastructure audit with cloud provider',
            reasoning: 'At your spend level, you may qualify for enterprise discounts',
            confidence: 'medium',
            savingsEstimate: totalBurn * 0.15 * 12,
            implementationEffort: 'moderate',
            tradeoffs: ['Negotiation time', 'May require commitment'],
        });
    }

    return recommendations.sort((a, b) => b.savingsEstimate - a.savingsEstimate);
}

/**
 * Get startup stage recommendations
 */
export function getStageRecommendations(stage: StartupStage): {
    maxMonthlySpend: number;
    recommendedServices: string[];
    warnings: string[];
} {
    const recommendations: Record<StartupStage, ReturnType<typeof getStageRecommendations>> = {
        'pre-seed': {
            maxMonthlySpend: 500,
            recommendedServices: [
                'Vercel/Railway free tiers',
                'Supabase free tier',
                'GPT-4o-mini or Claude Haiku',
                'Cloudflare free CDN',
            ],
            warnings: [
                'Avoid reserved instances - too early for commitments',
                'Use free tiers aggressively',
                'Don\'t over-engineer infrastructure',
            ],
        },
        'seed': {
            maxMonthlySpend: 3000,
            recommendedServices: [
                'Vercel Pro or Railway Pro',
                'Supabase Pro or PlanetScale',
                'Mix of GPT-4o-mini and GPT-4o',
                'Consider reserved instances for stable workloads',
            ],
            warnings: [
                'Watch for cost creep as you scale',
                'Set up billing alerts',
                'Review spend monthly',
            ],
        },
        'series-a': {
            maxMonthlySpend: 15000,
            recommendedServices: [
                'Direct cloud providers (AWS/GCP) for flexibility',
                'Managed databases with HA',
                'Model selection based on task complexity',
                '1-year reserved instances for baseline load',
            ],
            warnings: [
                'Negotiate enterprise agreements',
                'Apply for startup credits',
                'Build cost allocation by team/feature',
            ],
        },
        'scaling': {
            maxMonthlySpend: 100000,
            recommendedServices: [
                'Multi-cloud for resilience',
                'Spot instances for batch workloads',
                'Consider self-hosted models for high volume',
                '3-year reserved for predictable workloads',
            ],
            warnings: [
                'Hire dedicated FinOps',
                'Implement chargeback by team',
                'Quarterly optimization reviews',
            ],
        },
    };

    return recommendations[stage];
}

// ============== Comparison Logic ==============

/**
 * Compare cloud providers with intelligence
 */
export function compareProviders(
    costs: Record<Provider, number>,
    workloadType: WorkloadType
): { winner: Provider; reasoning: string; considerations: string[] } {
    const sorted = Object.entries(costs).sort((a, b) => a[1] - b[1]) as [Provider, number][];
    const winner = sorted[0][0];
    const lowestCost = sorted[0][1];
    const secondLowest = sorted[1][1];
    const savings = secondLowest - lowestCost;

    const workloadConsiderations: Record<WorkloadType, Record<Provider, string>> = {
        'api-heavy': {
            aws: 'Best API Gateway and Lambda integration',
            gcp: 'Excellent Cloud Run for containerized APIs',
            azure: 'Strong API Management offering',
        },
        'batch-processing': {
            aws: 'Mature Spot instance market',
            gcp: 'Best preemptible pricing with sustained use',
            azure: 'Good Batch service integration',
        },
        'ml-training': {
            aws: 'Widest GPU selection',
            gcp: 'TPU access and competitive GPU pricing',
            azure: 'Best if using Azure ML ecosystem',
        },
        'web-app': {
            aws: 'Most mature ecosystem',
            gcp: 'Excellent global network',
            azure: 'Best .NET integration',
        },
        'realtime': {
            aws: 'Strong WebSocket and IoT support',
            gcp: 'Best global latency network',
            azure: 'Good SignalR for .NET apps',
        },
    };

    const considerations = [
        workloadConsiderations[workloadType][winner],
        savings > 0 ? `Saves $${savings.toFixed(2)}/month vs next cheapest` : 'All providers have similar pricing',
    ];

    // Add startup credit consideration
    if (winner === 'gcp') {
        considerations.push('GCP for Startups offers up to $200k in credits');
    } else if (winner === 'aws') {
        considerations.push('AWS Activate offers up to $100k in credits');
    } else {
        considerations.push('Azure for Startups offers up to $150k in credits');
    }

    // Calculate percentage savings safely (avoid division by zero or NaN)
    let percentSavings = 0;
    if (secondLowest > 0 && lowestCost >= 0) {
        percentSavings = Math.round((1 - lowestCost / secondLowest) * 100);
    }

    const reasoning = percentSavings > 0
        ? `${winner.toUpperCase()} is ${percentSavings}% cheaper for this workload`
        : lowestCost === 0 && secondLowest === 0
            ? 'All providers offer this service - provide instance type and hours for accurate comparison'
            : `${winner.toUpperCase()} offers best value for this workload`;

    return {
        winner,
        reasoning,
        considerations,
    };
}
