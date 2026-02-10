// AI Model Cost Tools
import { z } from 'zod';
import {
    estimateOpenAICost,
    estimateAnthropicCost,
    suggestModel,
    compareModels,
} from '../engine/pricing-engine.js';
import { classifyTaskSync } from '../engine/task-classifier.js';
import type { TaskType, LatencyRequirement } from '../engine/types.js';

// ============== Schema Definitions ==============

export const EstimateOpenAICostSchema = z.object({
    model: z.string().describe('OpenAI model name (e.g., gpt-4o, gpt-4o-mini, o1, o3-mini)').default('gpt-4o'),
    inputTokens: z.number().min(0).describe('Number of input tokens (e.g., 1000)').default(1000),
    outputTokens: z.number().min(0).describe('Number of output tokens (e.g., 500)').default(500),
});

export const EstimateAnthropicCostSchema = z.object({
    model: z.string().describe('Anthropic model name (e.g., claude-3-5-sonnet, claude-3-5-haiku)').default('claude-3-5-sonnet'),
    inputTokens: z.number().min(0).describe('Number of input tokens (e.g., 1000)').default(1000),
    outputTokens: z.number().min(0).describe('Number of output tokens (e.g., 500)').default(500),
});

export const SuggestModelSchema = z.object({
    taskType: z.enum(['chat', 'code', 'embedding', 'vision', 'reasoning', 'classification', 'extraction', 'audio', 'video', 'development'])
        .describe('Type of task to perform (e.g., chat, code)').default('chat'),
    budget: z.number().min(0).describe('Maximum cost per million tokens in USD (e.g., 10)').default(10),
    latencyRequirement: z.enum(['low', 'medium', 'high']).describe('Latency tolerance (e.g., medium)').default('medium'),
});

export const CompareModelsSchema = z.object({
    taskType: z.enum(['chat', 'code', 'embedding', 'vision', 'reasoning', 'classification', 'extraction', 'audio', 'video', 'development'])
        .describe('Type of task to compare models for (e.g., code, reasoning)').default('code'),
});

export const RankingByCostEfficiencySchema = z.object({
    task: z.string().describe('Task description to rank models by cost efficiency (e.g., "code generation and debugging")').default('building a web app with React'),
});

export const EstimatePerformanceSchema = z.object({
    taskType: z.enum(['chat', 'code', 'embedding', 'vision', 'reasoning', 'classification', 'extraction', 'audio', 'video', 'development'])
        .describe('Type of task (e.g., chat, reasoning)').default('chat'),
    tokenSize: z.number().min(0).describe('Expected token size per request (e.g., 1000)').default(1000),
});

// ============== Tool Handlers ==============

export function handleEstimateOpenAICost(args: z.infer<typeof EstimateOpenAICostSchema>) {
    return estimateOpenAICost(args.model, args.inputTokens, args.outputTokens);
}

export function handleEstimateAnthropicCost(args: z.infer<typeof EstimateAnthropicCostSchema>) {
    return estimateAnthropicCost(args.model, args.inputTokens, args.outputTokens);
}

export function handleSuggestModel(args: z.infer<typeof SuggestModelSchema>) {
    return suggestModel(
        args.taskType as TaskType,
        args.budget,
        args.latencyRequirement as LatencyRequirement
    );
}

export function handleCompareModels(args: z.infer<typeof CompareModelsSchema>) {
    return compareModels(args.taskType as TaskType);
}

export function handleRankingByCostEfficiency(args: z.infer<typeof RankingByCostEfficiencySchema>) {
    // Use hybrid classifier for intelligent task type detection
    const classification = classifyTaskSync(args.task);
    const taskType = classification.taskType;

    const comparison = compareModels(taskType);

    // Handle empty rankings
    if (!comparison.rankings || comparison.rankings.length === 0) {
        return {
            task: args.task,
            inferredTaskType: taskType,
            efficiencyRankings: [],
            insights: [{ type: 'warning' as const, message: 'No models found for this task type' }],
        };
    }

    return {
        task: args.task,
        inferredTaskType: taskType,
        classificationConfidence: classification.confidence,
        matchedKeywords: classification.matchedKeywords,
        efficiencyRankings: comparison.rankings.map(r => ({
            rank: r.rank,
            model: r.model,
            provider: r.provider,
            costPer1M: r.costPer1M,
            efficiencyScore: r.efficiencyScore,
            recommendation: r.rank === 1 ? 'Best choice for this task' :
                r.rank <= 3 ? 'Good alternative' : 'Consider only if specific features needed',
        })),
        insights: [
            ...comparison.insights,
            {
                type: 'action' as const,
                message: `For "${args.task}", prioritize ${comparison.rankings[0].model} for best cost-efficiency`,
            },
        ],
    };
}

export function handleEstimatePerformance(args: z.infer<typeof EstimatePerformanceSchema>) {
    // Performance estimates based on task type and token size
    const performanceProfiles: Record<string, { avgLatencyMs: number; tokensPerSecond: number }> = {
        'chat': { avgLatencyMs: 800, tokensPerSecond: 80 },
        'code': { avgLatencyMs: 1200, tokensPerSecond: 60 },
        'embedding': { avgLatencyMs: 100, tokensPerSecond: 1000 },
        'vision': { avgLatencyMs: 2000, tokensPerSecond: 40 },
        'reasoning': { avgLatencyMs: 5000, tokensPerSecond: 30 },
        'classification': { avgLatencyMs: 300, tokensPerSecond: 150 },
        'extraction': { avgLatencyMs: 500, tokensPerSecond: 100 },
    };

    const profile = performanceProfiles[args.taskType] || performanceProfiles['chat'];
    const estimatedLatency = profile.avgLatencyMs + (args.tokenSize / profile.tokensPerSecond) * 1000;

    return {
        taskType: args.taskType,
        tokenSize: args.tokenSize,
        estimatedLatencyMs: Math.round(estimatedLatency),
        estimatedThroughput: {
            requestsPerMinute: Math.round(60000 / estimatedLatency),
            tokensPerMinute: Math.round(60000 / estimatedLatency * args.tokenSize),
        },
        bottlenecks: [
            args.tokenSize > 4000 ? 'Large context may cause increased latency' : null,
            args.taskType === 'reasoning' ? 'Reasoning models have higher latency by design' : null,
            args.taskType === 'vision' ? 'Image processing adds overhead' : null,
        ].filter(Boolean),
        scalingRecommendations: [
            estimatedLatency > 3000 ? 'Consider async processing for requests >3s' : null,
            args.tokenSize > 8000 ? 'Implement request chunking for large contexts' : null,
            'Use connection pooling for high throughput',
        ].filter(Boolean),
        insights: [
            {
                type: 'prediction' as const,
                message: `At ${Math.round(60000 / estimatedLatency)} req/min, you can handle ~${Math.round(60000 / estimatedLatency * 60 * 24)} requests/day`,
            },
        ],
    };
}

// ============== Tool Definitions ==============

export const aiModelTools = [
    {
        name: 'estimateOpenAICost',
        description: 'Calculate OpenAI API cost with intelligent insights. Returns cost breakdown, cheaper alternatives, and optimization tips. Perfect for understanding your OpenAI spend and finding savings opportunities.',
        inputSchema: EstimateOpenAICostSchema,
        handler: handleEstimateOpenAICost,
    },
    {
        name: 'estimateAnthropicCost',
        description: 'Calculate Anthropic Claude API cost with intelligent insights. Returns cost breakdown, batch API savings, and optimization strategies. Includes comparison with OpenAI alternatives.',
        inputSchema: EstimateAnthropicCostSchema,
        handler: handleEstimateAnthropicCost,
    },
    {
        name: 'suggestModel',
        description: 'Get intelligent model recommendation based on your task, budget, and latency needs. Returns the best model with detailed reasoning, alternatives analysis, and break-even thresholds.',
        inputSchema: SuggestModelSchema,
        handler: handleSuggestModel,
    },
    {
        name: 'compareModels',
        description: 'Compare all available AI models for a specific task type. Returns ranked list with efficiency scores, cost breakdown, and quality-cost matrix to help you choose.',
        inputSchema: CompareModelsSchema,
        handler: handleCompareModels,
    },
    {
        name: 'rankingByCostEfficiency',
        description: 'Rank AI models by cost efficiency for any task description. Automatically infers the task type and returns models sorted by value-for-money with actionable recommendations.',
        inputSchema: RankingByCostEfficiencySchema,
        handler: handleRankingByCostEfficiency,
    },
    {
        name: 'estimatePerformance',
        description: 'Estimate latency and throughput for AI model requests. Returns expected response times, bottleneck identification, and scaling recommendations.',
        inputSchema: EstimatePerformanceSchema,
        handler: handleEstimatePerformance,
    },
];
