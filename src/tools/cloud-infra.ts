// Cloud Infrastructure Cost Tools
import { z } from 'zod';
import {
    estimateComputeCost,
    compareCloudCost,
} from '../engine/pricing-engine.js';
import {
    calculateStorageCost,
    calculateBandwidthCost,
    forecastCost,
} from '../engine/formulas.js';
import type { Provider } from '../engine/types.js';

// ============== Schema Definitions ==============

export const CompareCloudCostSchema = z.object({
    serviceType: z.enum(['compute', 'storage', 'database']).describe('Type of cloud service'),
    usageProfile: z.object({
        instanceType: z.string().optional().describe('Instance type (e.g., t3.medium, m6i.large)'),
        hours: z.number().optional().describe('Hours of usage per month'),
        gb: z.number().optional().describe('Storage in GB'),
    }).optional().default({}).describe('Usage profile for cost estimation (optional - uses sensible defaults)'),
});

export const EstimateComputeCostSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider (e.g., aws, gcp)').default('aws'),
    instanceType: z.string().describe('Instance type (e.g., t3.large, D4s_v5, n2-standard-4)').default('t3.medium'),
    hours: z.number().min(0).describe('Hours of usage per month (e.g., 730 for full month)').default(730),
    region: z.string().optional().describe('Optional region for pricing adjustment (e.g., us-east-1)').default('us-east-1'),
});

export const EstimateStorageCostSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider (e.g., aws, azure)').default('aws'),
    storageType: z.enum(['standard', 'ssd', 'archive']).describe('Storage tier (e.g., standard, ssd)').default('standard'),
    gb: z.number().min(0).describe('Storage amount in GB (e.g., 100)').default(100),
    durationMonths: z.number().min(1).default(1).describe('Duration in months (e.g., 12)'),
});

export const EstimateBandwidthCostSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider (e.g., aws, gcp)').default('aws'),
    gbTransfer: z.number().min(0).describe('Data transfer in GB (e.g., 1000)').default(100),
    direction: z.enum(['egress', 'ingress', 'inter-region']).default('egress').describe('Transfer direction'),
});

export const ForecastScalingCostSchema = z.object({
    provider: z.enum(['aws', 'azure', 'gcp']).describe('Cloud provider (e.g., aws)').default('aws'),
    currentMonthlyCost: z.number().min(0).describe('Current monthly infrastructure cost in USD (e.g., 1000)').default(1000),
    growthRate: z.number().min(-1).max(10).describe('Monthly growth rate (e.g., 0.1 for 10% monthly growth)').default(0.1),
    months: z.number().min(1).max(36).describe('Forecast duration in months (e.g., 12)').default(12),
});

// ============== Tool Handlers ==============

export function handleCompareCloudCost(args: z.infer<typeof CompareCloudCostSchema>) {
    return compareCloudCost(args.serviceType, args.usageProfile);
}

export function handleEstimateComputeCost(args: z.infer<typeof EstimateComputeCostSchema>) {
    return estimateComputeCost(
        args.provider as Provider,
        args.instanceType,
        args.hours,
        args.region
    );
}

export function handleEstimateStorageCost(args: z.infer<typeof EstimateStorageCostSchema>) {
    // Storage rates by provider and type
    const storageRates: Record<string, Record<string, number>> = {
        aws: { standard: 0.023, ssd: 0.08, archive: 0.004 },
        azure: { standard: 0.02, ssd: 0.075, archive: 0.002 },
        gcp: { standard: 0.02, ssd: 0.17, archive: 0.004 },
    };

    const rate = storageRates[args.provider][args.storageType];
    const { totalCost, monthlyAverage } = calculateStorageCost(args.gb, rate, args.durationMonths);

    // Calculate potential tiering savings
    const archiveRate = storageRates[args.provider]['archive'];
    const tieringSavings = args.storageType !== 'archive'
        ? (rate - archiveRate) * args.gb * 0.6 // Assume 60% could be archived
        : 0;

    return {
        provider: args.provider,
        storageType: args.storageType,
        gb: args.gb,
        durationMonths: args.durationMonths,
        totalCost,
        monthlyAverage,
        costPerGb: rate,
        tierRecommendation: args.gb > 100
            ? 'Implement lifecycle policies to auto-move old data to archive tier'
            : 'Current setup is appropriate for this scale',
        potentialSavings: {
            withTiering: Math.round(tieringSavings * 100) / 100,
            withCompression: Math.round(totalCost * 0.3 * 100) / 100,
        },
        insights: [
            {
                type: 'opportunity' as const,
                message: tieringSavings > 10
                    ? `Archive cold data to save ~$${tieringSavings.toFixed(2)}/month`
                    : 'Storage costs optimized at current scale',
                impact: tieringSavings,
            },
            {
                type: 'action' as const,
                message: args.gb > 500
                    ? 'Enable compression for significant savings'
                    : 'Consider S3 Intelligent-Tiering for automatic optimization',
            },
        ],
    };
}

export function handleEstimateBandwidthCost(args: z.infer<typeof EstimateBandwidthCostSchema>) {
    // Bandwidth rates by provider (egress to internet)
    const bandwidthTiers: Record<string, { limit: number; rate: number }[]> = {
        aws: [
            { limit: 10000, rate: 0.09 },
            { limit: 50000, rate: 0.085 },
            { limit: 150000, rate: 0.07 },
            { limit: Infinity, rate: 0.05 },
        ],
        azure: [
            { limit: 5, rate: 0 },
            { limit: 10000, rate: 0.087 },
            { limit: 50000, rate: 0.083 },
            { limit: 150000, rate: 0.07 },
            { limit: Infinity, rate: 0.05 },
        ],
        gcp: [
            { limit: 1000, rate: 0.12 },
            { limit: 10000, rate: 0.11 },
            { limit: Infinity, rate: 0.08 },
        ],
    };

    const tiers = bandwidthTiers[args.provider];
    const { totalCost, breakdown } = calculateBandwidthCost(args.gbTransfer, tiers);

    // CDN savings estimate
    const cdnSavings = args.gbTransfer > 500 ? totalCost * 0.4 : 0;

    return {
        provider: args.provider,
        gbTransferred: args.gbTransfer,
        direction: args.direction,
        totalCost,
        breakdown,
        optimizationStrategies: [
            args.gbTransfer > 100 ? 'Use CDN to reduce origin egress' : null,
            args.gbTransfer > 1000 ? 'Consider CloudFlare for free egress' : null,
            'Enable compression for text-based content',
            args.direction === 'inter-region' ? 'Colocate services to eliminate inter-region traffic' : null,
        ].filter(Boolean),
        cdnRecommendation: args.gbTransfer > 500
            ? 'CloudFlare Pro ($20/mo) + free egress saves more than bandwidth cost'
            : 'CDN may not be cost-effective at this scale',
        potentialSavings: cdnSavings,
        insights: [
            {
                type: cdnSavings > 0 ? 'opportunity' as const : 'benchmark' as const,
                message: cdnSavings > 0
                    ? `CDN could save $${cdnSavings.toFixed(2)}/month on egress`
                    : 'Bandwidth costs are reasonable for your usage',
                impact: cdnSavings,
            },
        ],
    };
}

export function handleForecastScalingCost(args: z.infer<typeof ForecastScalingCostSchema>) {
    const { projectedCost, totalSpend, projections } = forecastCost(
        args.currentMonthlyCost,
        args.growthRate,
        args.months
    );

    // Identify cost cliffs (significant jumps that may require action)
    const costCliffs = projections
        .filter((p, i) => i > 0 && p.cost > projections[i - 1].cost * 1.5)
        .map(p => ({
            month: p.month,
            cost: p.cost,
            action: 'Review infrastructure and negotiate enterprise pricing',
        }));

    // Reserved instance break-even
    const reservedBreakEven = args.currentMonthlyCost > 500 ? 4 : null; // months

    return {
        provider: args.provider,
        currentMonthlyCost: args.currentMonthlyCost,
        growthRate: args.growthRate,
        forecastMonths: args.months,
        projectedFinalCost: projectedCost,
        totalSpendOverPeriod: totalSpend,
        monthlyProjections: projections.slice(0, 12), // First 12 months detail
        costCliffWarnings: costCliffs,
        renegotiationPoint: args.currentMonthlyCost > 1000
            ? 'Negotiate enterprise agreement when reaching $5k/mo'
            : 'Consider reserved instances at $500/mo baseline',
        insights: [
            {
                type: 'prediction' as const,
                message: `At ${(args.growthRate * 100).toFixed(0)}% monthly growth, costs will reach $${projectedCost.toFixed(0)}/mo in ${args.months} months`,
            },
            {
                type: 'warning' as const,
                message: projectedCost > args.currentMonthlyCost * 5
                    ? 'Consider infrastructure optimization before scaling 5x'
                    : 'Growth trajectory is manageable',
            },
            {
                type: 'action' as const,
                message: reservedBreakEven
                    ? `Lock in reserved instances now to save ~35% over ${args.months} months`
                    : 'Stay flexible with on-demand until usage stabilizes',
            },
        ],
        reservedInstanceRecommendation: reservedBreakEven ? {
            recommendation: 'Consider 1-year reserved instances',
            breakEvenMonths: reservedBreakEven,
            estimatedSavings: totalSpend * 0.3,
        } : null,
    };
}

// ============== Tool Definitions ==============

export const cloudInfraTools = [
    {
        name: 'compareCloudCost',
        description: 'Compare costs across AWS, Azure, and GCP with intelligent analysis. Returns winner with reasoning, hidden costs (NAT, load balancer fees), and available startup credit programs.',
        inputSchema: CompareCloudCostSchema,
        handler: handleCompareCloudCost,
    },
    {
        name: 'estimateComputeCost',
        description: 'Calculate cloud compute costs with optimization insights. Returns hourly/monthly/yearly costs, specs, reserved instance savings, and right-sizing recommendations.',
        inputSchema: EstimateComputeCostSchema,
        handler: handleEstimateComputeCost,
    },
    {
        name: 'estimateStorageCost',
        description: 'Estimate cloud storage costs with tiering recommendations. Returns cost breakdown, lifecycle policy savings, and compression opportunities.',
        inputSchema: EstimateStorageCostSchema,
        handler: handleEstimateStorageCost,
    },
    {
        name: 'estimateBandwidthCost',
        description: 'Calculate data transfer costs with egress optimization strategies. Returns tiered breakdown, CDN recommendations, and potential savings from traffic optimization.',
        inputSchema: EstimateBandwidthCostSchema,
        handler: handleEstimateBandwidthCost,
    },
    {
        name: 'forecastScalingCost',
        description: 'Project future infrastructure costs based on growth rate. Returns monthly projections, cost cliff warnings, and recommendations for when to lock in reserved instances.',
        inputSchema: ForecastScalingCostSchema,
        handler: handleForecastScalingCost,
    },
];
