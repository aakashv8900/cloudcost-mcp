// Pricing Engine - Core calculator for all pricing operations
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    calculateAIModelCost,
    calculateCostPerMillion,
    calculateComputeCost,
    calculateReservedSavings,
    calculateStorageCost,
    calculateRunway,
    calculateBurnMultiple,
    forecastCost,
} from './formulas.js';
import {
    generateModelInsights,
    generateComputeInsights,
    generateRunwayInsights,
    generateCostReductions,
    recommendModel,
    getStageRecommendations,
    compareProviders,
} from './intelligence.js';
import type {
    AIModelCostResult,
    AIProvider,
    Provider,
    ComputeCostResult,
    StorageCostResult,
    RunwayForecast,
    ModelSuggestion,
    CloudComparison,
    TaskType,
    LatencyRequirement,
    StartupStage,
    WorkloadType,
    ModelComparison,
    CostReductionResult,
    CostReductionStrategy,
} from './types.js';

// Get the pricing directory path relative to the module
const pricingDir = join(process.cwd(), 'pricing');

// ============== Pricing Data Loaders ==============

function loadPricing<T>(filename: string): T {
    const filePath = join(pricingDir, filename);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
}

interface OpenAIModel {
    input_per_million: number;
    output_per_million: number;
    context_window?: number;
    category: string;
    best_for: string[];
    latency: string;
}

interface AnthropicModel {
    input_per_million: number;
    output_per_million: number;
    context_window?: number;
    category: string;
    best_for: string[];
    latency: string;
    batch_discount?: number;
}

interface ComputeInstance {
    vcpu: number;
    memory_gb: number;
    hourly_rate: number;
    category: string;
}

interface AWSCompute {
    [family: string]: {
        [size: string]: ComputeInstance;
    } | { [key: string]: number };
    reserved_discounts: Record<string, number>;
    region_multipliers: Record<string, number>;
}

interface StoragePricing {
    [type: string]: {
        storage_per_gb?: number;
        per_gb?: number;
        [key: string]: number | undefined;
    };
}

// Load pricing data
const openaiPricing = loadPricing<Record<string, OpenAIModel>>('openai.json');
const anthropicPricing = loadPricing<Record<string, AnthropicModel>>('anthropic.json');
const awsComputePricing = loadPricing<AWSCompute>('aws_compute.json');
const awsStoragePricing = loadPricing<{ s3: StoragePricing; ebs: StoragePricing; data_transfer: Record<string, number> }>('aws_storage.json');
const azureComputePricing = loadPricing<AWSCompute>('azure_compute.json');
const gcpComputePricing = loadPricing<AWSCompute>('gcp_compute.json');

// ============== AI Model Pricing ==============

export function estimateOpenAICost(
    model: string,
    inputTokens: number,
    outputTokens: number
): AIModelCostResult {
    const pricing = openaiPricing[model];

    if (!pricing) {
        throw new Error(`Unknown OpenAI model: ${model}. Available: ${Object.keys(openaiPricing).join(', ')}`);
    }

    const { inputCost, outputCost, totalCost } = calculateAIModelCost(
        inputTokens,
        outputTokens,
        pricing.input_per_million,
        pricing.output_per_million
    );

    const costPer1M = calculateCostPerMillion(pricing.input_per_million, pricing.output_per_million);
    const monthlyTokens = inputTokens + outputTokens;

    // Find alternatives
    const alternatives = Object.entries(openaiPricing)
        .filter(([name]) => name !== model)
        .map(([name, p]) => ({
            model: name,
            cost: calculateAIModelCost(inputTokens, outputTokens, p.input_per_million, p.output_per_million).totalCost,
        }))
        .sort((a, b) => a.cost - b.cost)
        .slice(0, 3);

    const insights = generateModelInsights(model, monthlyTokens, totalCost, alternatives);

    return {
        model,
        provider: 'openai',
        totalCost,
        inputCost,
        outputCost,
        currency: 'USD',
        costPer1M,
        insights,
        alternatives: alternatives.map(a => ({
            option: a.model,
            whyNot: a.cost < totalCost
                ? `${Math.round((1 - a.cost / totalCost) * 100)}% cheaper`
                : `${Math.round((a.cost / totalCost - 1) * 100)}% more expensive`,
            costDifference: a.cost - totalCost,
        })),
        optimizationTips: [
            'Use prompt caching for repeated context (up to 90% savings)',
            'Batch non-urgent requests for 50% discount',
            'Consider fine-tuning for specialized tasks',
        ],
    };
}

export function estimateAnthropicCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): AIModelCostResult {
    const pricing = anthropicPricing[model];

    if (!pricing) {
        throw new Error(`Unknown Anthropic model: ${model}. Available: ${Object.keys(anthropicPricing).join(', ')}`);
    }

    const { inputCost, outputCost, totalCost } = calculateAIModelCost(
        inputTokens,
        outputTokens,
        pricing.input_per_million,
        pricing.output_per_million
    );

    const costPer1M = calculateCostPerMillion(pricing.input_per_million, pricing.output_per_million);
    const monthlyTokens = inputTokens + outputTokens;

    // Calculate batch savings
    const batchDiscount = pricing.batch_discount || 0.5;
    const batchCost = totalCost * (1 - batchDiscount);

    // Find alternatives
    const alternatives = Object.entries(anthropicPricing)
        .filter(([name]) => name !== model)
        .map(([name, p]) => ({
            model: name,
            cost: calculateAIModelCost(inputTokens, outputTokens, p.input_per_million, p.output_per_million).totalCost,
        }))
        .sort((a, b) => a.cost - b.cost)
        .slice(0, 3);

    const insights = generateModelInsights(model, monthlyTokens, totalCost, alternatives);

    // Add batch API insight
    if (batchCost < totalCost) {
        insights.unshift({
            type: 'opportunity',
            message: `Batch API saves $${(totalCost - batchCost).toFixed(2)} (${Math.round(batchDiscount * 100)}% discount)`,
            impact: totalCost - batchCost,
        });
    }

    return {
        model,
        provider: 'anthropic',
        totalCost,
        inputCost,
        outputCost,
        currency: 'USD',
        costPer1M,
        insights,
        alternatives: alternatives.map(a => ({
            option: a.model,
            whyNot: a.cost < totalCost
                ? `${Math.round((1 - a.cost / totalCost) * 100)}% cheaper`
                : `${Math.round((a.cost / totalCost - 1) * 100)}% more expensive`,
            costDifference: a.cost - totalCost,
        })),
        optimizationTips: [
            `Batch API offers ${Math.round(batchDiscount * 100)}% discount for async processing`,
            'Use prompt caching for repeated system prompts',
            'Claude 3.5 Haiku is ideal for high-volume simple tasks',
        ],
    };
}

export function suggestModel(
    taskType: TaskType,
    budget: number,
    latencyRequirement: LatencyRequirement
): ModelSuggestion {
    // Combine all models with normalized data
    const allModels = [
        ...Object.entries(openaiPricing).map(([name, p]) => ({
            name,
            provider: 'openai' as AIProvider,
            cost: calculateCostPerMillion(p.input_per_million, p.output_per_million),
            latency: p.latency,
            quality: p.category === 'flagship' ? 90 : p.category === 'reasoning' ? 95 : 70,
            bestFor: p.best_for,
        })),
        ...Object.entries(anthropicPricing).map(([name, p]) => ({
            name,
            provider: 'anthropic' as AIProvider,
            cost: calculateCostPerMillion(p.input_per_million, p.output_per_million),
            latency: p.latency,
            quality: p.category === 'flagship' ? 92 : p.category === 'premium' ? 95 : 72,
            bestFor: p.best_for,
        })),
    ];

    const result = recommendModel(taskType, budget, latencyRequirement, allModels);
    const selectedModel = allModels.find(m => m.name === result.model)!;

    return {
        recommendedModel: result.model,
        provider: selectedModel.provider,
        reasoning: result.reasoning,
        confidence: result.confidence,
        costPer1M: selectedModel.cost,
        alternatives: result.alternatives,
        breakEvenPoint: `Switch to higher-tier model if accuracy improvement >5% is worth $${(budget - selectedModel.cost).toFixed(2)}/1M tokens`,
        insights: [
            {
                type: 'action',
                message: `For ${taskType} tasks, ${result.model} offers best value at $${selectedModel.cost.toFixed(2)}/1M tokens`,
            },
            {
                type: 'benchmark',
                message: `${result.model} handles ${selectedModel.bestFor.join(', ')} well`,
            },
        ],
    };
}

export function compareModels(taskType: TaskType): ModelComparison {
    const allModels = [
        ...Object.entries(openaiPricing).map(([name, p]) => ({
            name,
            provider: 'openai' as AIProvider,
            cost: calculateCostPerMillion(p.input_per_million, p.output_per_million),
            category: p.category,
            bestFor: p.best_for,
        })),
        ...Object.entries(anthropicPricing).map(([name, p]) => ({
            name,
            provider: 'anthropic' as AIProvider,
            cost: calculateCostPerMillion(p.input_per_million, p.output_per_million),
            category: p.category,
            bestFor: p.best_for,
        })),
    ];

    // Filter and score by task relevance
    const scoredModels = allModels.map(m => ({
        ...m,
        score: (m.bestFor.includes(taskType) ? 100 : 50) - m.cost,
    }));

    scoredModels.sort((a, b) => b.score - a.score);

    const winner = scoredModels[0];

    return {
        rankings: scoredModels.slice(0, 10).map((m, i) => ({
            rank: i + 1,
            model: m.name,
            provider: m.provider,
            costPer1M: m.cost,
            efficiencyScore: Math.round(m.score),
            bestFor: m.bestFor,
        })),
        winner: winner.name,
        reasoning: winner.bestFor.includes(taskType)
            ? `${winner.name} is optimized for ${taskType} at $${winner.cost.toFixed(2)}/1M tokens`
            : `${winner.name} offers best overall value for this task type`,
        qualityCostMatrix: [
            { model: 'gpt-4o / claude-3-5-sonnet', quality: 'high', costTier: 'moderate', recommendation: 'Complex tasks requiring nuanced understanding' },
            { model: 'o1 / claude-3-opus', quality: 'high', costTier: 'expensive', recommendation: 'Only for advanced reasoning and research' },
            { model: 'gpt-4o-mini / claude-3-5-haiku', quality: 'medium', costTier: 'cheap', recommendation: 'High-volume production workloads' },
        ],
        insights: [
            { type: 'action', message: `Use ${winner.name} as your primary model for ${taskType}` },
            { type: 'opportunity', message: 'Route simple requests to cheaper models for 70%+ savings' },
        ],
    };
}

// ============== Cloud Compute Pricing ==============

export function estimateComputeCost(
    provider: Provider,
    instanceType: string,
    hours: number,
    region?: string
): ComputeCostResult {
    let pricing: AWSCompute;
    let regionMultipliers: Record<string, number>;
    let reservedDiscounts: Record<string, number>;

    switch (provider) {
        case 'aws':
            pricing = awsComputePricing;
            regionMultipliers = pricing.region_multipliers as Record<string, number>;
            reservedDiscounts = pricing.reserved_discounts as Record<string, number>;
            break;
        case 'azure':
            pricing = azureComputePricing;
            regionMultipliers = pricing.region_multipliers as Record<string, number>;
            reservedDiscounts = pricing.reserved_discounts as Record<string, number>;
            break;
        case 'gcp':
            pricing = gcpComputePricing;
            regionMultipliers = pricing.region_multipliers as Record<string, number>;
            reservedDiscounts = pricing.committed_use_discounts as Record<string, number>;
            break;
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }

    // Parse instance type (e.g., "t3.large" -> family: "t3", size: "large")
    const [family, size] = instanceType.split(/[.-]/);
    const familyPricing = pricing[family] as Record<string, ComputeInstance> | undefined;

    if (!familyPricing || !familyPricing[size]) {
        throw new Error(`Unknown instance type: ${instanceType} for ${provider}`);
    }

    const instance = familyPricing[size];
    const regionMultiplier = region ? (regionMultipliers[region] || 1.0) : 1.0;

    const { hourly, monthly, yearly } = calculateComputeCost(instance.hourly_rate, hours, regionMultiplier);

    const oneYearReserved = calculateReservedSavings(monthly, reservedDiscounts['1_year'] || reservedDiscounts['1_year_no_upfront'] || 0.3);
    const threeYearReserved = calculateReservedSavings(monthly, reservedDiscounts['3_year'] || reservedDiscounts['3_year_no_upfront'] || 0.5);

    const insights = generateComputeInsights(provider, instanceType, monthly);

    return {
        provider,
        instanceType,
        hourlyCost: hourly,
        monthlyCost: monthly,
        yearlyCost: yearly,
        specs: {
            vcpu: instance.vcpu,
            memoryGb: instance.memory_gb,
        },
        insights,
        recommendations: [
            {
                action: `Consider ${instanceType} reserved instance`,
                reasoning: 'Predictable workloads benefit from reservations',
                confidence: 'medium',
                savingsEstimate: oneYearReserved.yearlySavings,
                implementationEffort: 'trivial',
                tradeoffs: ['Commitment required', 'Less flexibility'],
            },
        ],
        reservedSavings: {
            oneYear: oneYearReserved.reservedMonthly,
            threeYear: threeYearReserved.reservedMonthly,
        },
    };
}

export function compareCloudCost(
    serviceType: 'compute' | 'storage' | 'database',
    usageProfile: { instanceType?: string; hours?: number; gb?: number }
): CloudComparison {
    const providers: Provider[] = ['aws', 'azure', 'gcp'];
    const costs: Record<Provider, number> = { aws: 0, azure: 0, gcp: 0 };

    if (serviceType === 'compute' && usageProfile.instanceType && usageProfile.hours) {
        // Map equivalent instance types across providers
        const instanceMappings: Record<string, Record<Provider, string>> = {
            't3.medium': { aws: 't3.medium', azure: 'B2ms', gcp: 'e2-medium' },
            't3.large': { aws: 't3.large', azure: 'B2ms', gcp: 'e2-standard-2' },
            'm6i.large': { aws: 'm6i.large', azure: 'D2s_v5', gcp: 'n2-standard-2' },
            'm6i.xlarge': { aws: 'm6i.xlarge', azure: 'D4s_v5', gcp: 'n2-standard-4' },
        };

        const mapping = instanceMappings[usageProfile.instanceType] || {
            aws: usageProfile.instanceType,
            azure: usageProfile.instanceType,
            gcp: usageProfile.instanceType,
        };

        for (const provider of providers) {
            try {
                const result = estimateComputeCost(provider, mapping[provider], usageProfile.hours);
                costs[provider] = result.monthlyCost;
            } catch {
                costs[provider] = Infinity;
            }
        }
    }

    const comparison = compareProviders(costs, 'web-app');

    return {
        winner: comparison.winner,
        monthlyCost: costs,
        reasoning: comparison.reasoning,
        hiddenCosts: [
            { provider: 'aws', item: 'NAT Gateway', monthlyCost: 45, description: 'Required for private subnet internet access' },
            { provider: 'azure', item: 'Load Balancer', monthlyCost: 22, description: 'Standard LB charges per rule' },
            { provider: 'gcp', item: 'Cloud NAT', monthlyCost: 32, description: 'NAT gateway for private GKE' },
        ],
        creditPrograms: [
            { provider: 'aws', program: 'AWS Activate', value: '$100k', eligibility: 'VC-backed or accelerator' },
            { provider: 'azure', program: 'Azure for Startups', value: '$150k', eligibility: 'Through partners' },
            { provider: 'gcp', program: 'Google for Startups', value: '$200k', eligibility: 'Series A or earlier' },
        ],
        totalCostOfOwnership: costs,
        insights: [
            { type: 'action', message: comparison.considerations[0] },
            { type: 'opportunity', message: comparison.considerations[2] },
        ],
    };
}

// ============== SaaS & Burn ==============

export function forecastRunway(
    monthlyInfraCost: number,
    monthlyRevenue: number,
    cashInBank: number,
    growthRate: number = 0.1
): RunwayForecast {
    const runway = calculateRunway(cashInBank, monthlyInfraCost, monthlyRevenue);
    const burnMultiple = calculateBurnMultiple(monthlyInfraCost - monthlyRevenue, monthlyRevenue * 0.1); // Assume 10% is new MRR

    const projection = forecastCost(monthlyInfraCost, growthRate, 12);

    const insights = generateRunwayInsights(runway.runwayMonths, monthlyInfraCost, growthRate);

    return {
        runwayMonths: runway.runwayMonths,
        burnRate: {
            current: runway.netBurn,
            projected: projection.projectedCost - monthlyRevenue * Math.pow(1 + growthRate, 12),
        },
        trajectory: growthRate > 0.05 ? 'increasing' : growthRate < -0.05 ? 'decreasing' : 'stable',
        decisionPoints: [
            { month: Math.max(1, Math.floor(runway.runwayMonths - 6)), event: 'Start fundraising', action: 'Begin investor outreach' },
            { month: Math.max(1, Math.floor(runway.runwayMonths - 3)), event: 'Critical runway', action: 'Aggressive cost cutting or bridge round' },
        ],
        investorMetrics: {
            burnMultiple: burnMultiple.burnMultiple,
            efficiency: burnMultiple.efficiency,
            benchmark: burnMultiple.efficiency === 'excellent' ? 'Top 10% of startups' :
                burnMultiple.efficiency === 'good' ? 'Top quartile' :
                    burnMultiple.efficiency === 'fair' ? 'Median' : 'Below median',
        },
        insights,
    };
}

export function recommendCostReduction(
    services: { name: string; cost: number; category: string }[]
): CostReductionResult {
    const totalBurn = services.reduce((sum: number, s) => sum + s.cost, 0);
    const recommendations = generateCostReductions(services, totalBurn);

    // Map Recommendation to CostReductionStrategy
    const strategies: CostReductionStrategy[] = recommendations.map((r, i) => ({
        strategy: r.action,
        annualSavings: r.savingsEstimate,
        implementationEffort: r.implementationEffort,
        timeToImplement: r.implementationEffort === 'trivial' ? '1-2 days' :
            r.implementationEffort === 'moderate' ? '1-2 weeks' : '1+ month',
        risks: r.tradeoffs,
        priority: i + 1,
    }));

    const quickWins = strategies.filter(s => s.implementationEffort === 'trivial');

    return {
        strategies,
        totalPotentialSavings: strategies.reduce((sum: number, s) => sum + s.annualSavings, 0),
        quickWins,
        insights: [
            { type: 'action', message: `Start with quick wins for immediate $${quickWins.reduce((s: number, q) => s + q.annualSavings, 0).toFixed(0)} annual savings` },
            { type: 'prediction', message: `Full optimization could reduce burn by ${Math.round(strategies.reduce((s: number, st) => s + st.annualSavings, 0) / totalBurn / 12 * 100)}%` },
        ],
    };
}

// ============== Export all ==============

export {
    getStageRecommendations,
};
