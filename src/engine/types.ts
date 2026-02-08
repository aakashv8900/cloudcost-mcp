// Core Types for CloudCost Intelligence MCP

// ============== Common Types ==============

export type Provider = 'aws' | 'azure' | 'gcp';
export type AIProvider = 'openai' | 'anthropic';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ImplementationEffort = 'trivial' | 'moderate' | 'significant';
export type InsightType = 'warning' | 'opportunity' | 'prediction' | 'benchmark' | 'action';
export type LatencyRequirement = 'low' | 'medium' | 'high';
export type TaskType = 'chat' | 'code' | 'embedding' | 'vision' | 'reasoning' | 'classification' | 'extraction';
export type WorkloadType = 'api-heavy' | 'batch-processing' | 'ml-training' | 'web-app' | 'realtime';
export type TrafficPattern = 'steady' | 'spiky' | 'growing' | 'unpredictable';
export type BudgetConstraint = 'minimal' | 'balanced' | 'performance-first';
export type StartupStage = 'pre-seed' | 'seed' | 'series-a' | 'scaling';

// ============== Insight Types ==============

export interface Insight {
    type: InsightType;
    message: string;
    impact?: number; // Dollar impact if applicable
}

export interface Recommendation {
    action: string;
    reasoning: string;
    confidence: ConfidenceLevel;
    savingsEstimate: number;
    implementationEffort: ImplementationEffort;
    tradeoffs: string[];
}

export interface Alternative {
    option: string;
    whyNot: string;
    costDifference?: number;
}

// ============== AI Model Types ==============

export interface AIModelPricing {
    input_per_million: number;
    output_per_million: number;
    context_window?: number;
    max_output?: number;
    category: string;
    best_for: string[];
    latency: string;
    batch_discount?: number;
}

export interface AIModelCostResult {
    model: string;
    provider: AIProvider;
    totalCost: number;
    inputCost: number;
    outputCost: number;
    currency: string;
    costPer1M: number;
    insights: Insight[];
    alternatives: Alternative[];
    optimizationTips: string[];
}

export interface ModelComparison {
    rankings: ModelRanking[];
    winner: string;
    reasoning: string;
    qualityCostMatrix: QualityCostEntry[];
    insights: Insight[];
}

export interface ModelRanking {
    rank: number;
    model: string;
    provider: AIProvider;
    costPer1M: number;
    efficiencyScore: number;
    bestFor: string[];
}

export interface QualityCostEntry {
    model: string;
    quality: 'high' | 'medium' | 'low';
    costTier: 'expensive' | 'moderate' | 'cheap';
    recommendation: string;
}

export interface ModelSuggestion {
    recommendedModel: string;
    provider: AIProvider;
    reasoning: string;
    confidence: ConfidenceLevel;
    costPer1M: number;
    alternatives: Alternative[];
    breakEvenPoint: string;
    insights: Insight[];
}

// ============== Cloud Infrastructure Types ==============

export interface CloudComputePricing {
    vcpu: number;
    memory_gb: number;
    hourly_rate: number;
    category: string;
}

export interface ComputeCostResult {
    provider: Provider;
    instanceType: string;
    hourlyCost: number;
    monthlyCost: number;
    yearlyCost: number;
    specs: {
        vcpu: number;
        memoryGb: number;
    };
    insights: Insight[];
    recommendations: Recommendation[];
    reservedSavings: {
        oneYear: number;
        threeYear: number;
    };
}

export interface CloudComparison {
    winner: Provider;
    monthlyCost: Record<Provider, number>;
    reasoning: string;
    hiddenCosts: HiddenCost[];
    creditPrograms: CreditProgram[];
    totalCostOfOwnership: Record<Provider, number>;
    insights: Insight[];
}

export interface HiddenCost {
    provider: Provider;
    item: string;
    monthlyCost: number;
    description: string;
}

export interface CreditProgram {
    provider: Provider;
    program: string;
    value: string;
    eligibility: string;
}

export interface StorageCostResult {
    provider: Provider;
    storageType: string;
    totalCost: number;
    costPerGb: number;
    tierRecommendation: string;
    lifeCycleSavings: number;
    insights: Insight[];
}

export interface BandwidthCostResult {
    provider: Provider;
    transferCost: number;
    gbTransferred: number;
    optimizationStrategies: string[];
    cdnRecommendation: string;
    potentialSavings: number;
    insights: Insight[];
}

export interface ScalingForecast {
    provider: Provider;
    currentMonthlyCost: number;
    projectedCosts: MonthlyProjection[];
    costCliffWarnings: CostCliffWarning[];
    renegotiationPoint: string;
    insights: Insight[];
}

export interface MonthlyProjection {
    month: number;
    cost: number;
    growthFromBase: number;
}

export interface CostCliffWarning {
    month: number;
    threshold: string;
    action: string;
}

// ============== SaaS & Burn Types ==============

export interface SaaSBurnResult {
    monthlyBurn: number;
    topCostDrivers: CostDriver[];
    categoryBreakdown: Record<string, number>;
    industryBenchmark: string;
    insights: Insight[];
    recommendations: Recommendation[];
}

export interface CostDriver {
    service: string;
    monthlyCost: number;
    percentageOfTotal: number;
    optimizationPotential: number;
}

export interface PlanSuggestion {
    currentPlan: string;
    recommendedPlan: string;
    monthlySavings: number;
    featuresLost: string[];
    whenToUpgrade: string;
    confidence: ConfidenceLevel;
    insights: Insight[];
}

export interface RunwayForecast {
    runwayMonths: number;
    burnRate: {
        current: number;
        projected: number;
    };
    trajectory: 'increasing' | 'decreasing' | 'stable';
    decisionPoints: DecisionPoint[];
    investorMetrics: InvestorMetrics;
    insights: Insight[];
}

export interface DecisionPoint {
    month: number;
    event: string;
    action: string;
}

export interface InvestorMetrics {
    burnMultiple: number;
    efficiency: 'excellent' | 'good' | 'fair' | 'concerning';
    benchmark: string;
}

export interface CostReductionStrategy {
    strategy: string;
    annualSavings: number;
    implementationEffort: ImplementationEffort;
    timeToImplement: string;
    risks: string[];
    priority: number;
}

export interface CostReductionResult {
    strategies: CostReductionStrategy[];
    totalPotentialSavings: number;
    quickWins: CostReductionStrategy[];
    insights: Insight[];
}

// ============== Optimization Types ==============

export interface MultiCloudOptimization {
    optimalDistribution: Record<Provider, WorkloadAllocation>;
    migrationRoadmap: MigrationStep[];
    totalSavings: number;
    riskAssessment: Risk[];
    insights: Insight[];
}

export interface WorkloadAllocation {
    workloads: string[];
    percentageOfSpend: number;
    reasoning: string;
}

export interface MigrationStep {
    phase: number;
    action: string;
    timeframe: string;
    savings: number;
}

export interface Risk {
    category: string;
    description: string;
    mitigation: string;
    severity: 'low' | 'medium' | 'high';
}

export interface DatabaseTierResult {
    recommendedTier: string;
    provider: string;
    monthlyCost: number;
    reasoning: string;
    growthBuffer: string;
    nextScalePoint: string;
    alternatives: Alternative[];
    insights: Insight[];
}

export interface ModelSwitchResult {
    currentCost: number;
    newCost: number;
    monthlySavings: number;
    annualSavings: number;
    qualityImpact: string;
    abTestPlan: string[];
    implementationSteps: string[];
    insights: Insight[];
}

export interface ReservedInstanceResult {
    currentMonthly: number;
    withReserved: {
        oneYear: number;
        threeYear: number;
    };
    savingsPercent: {
        oneYear: number;
        threeYear: number;
    };
    recommendation: string;
    reasoning: string;
    breakEven: {
        oneYear: string;
        threeYear: string;
    };
    riskAnalysis: {
        downsideScenario: string;
        upsideScenario: string;
    };
    insights: Insight[];
}

export interface BreakEvenResult {
    breakEvenPoint: number; // months
    optionA: OptionAnalysis;
    optionB: OptionAnalysis;
    recommendation: string;
    reasoning: string;
    sensitivityAnalysis: SensitivityPoint[];
    insights: Insight[];
}

export interface OptionAnalysis {
    name: string;
    upfrontCost: number;
    monthlyCost: number;
    totalCostAtBreakEven: number;
}

export interface SensitivityPoint {
    variable: string;
    changePercent: number;
    newBreakEven: number;
}

// ============== Input Types ==============

export interface UsageProfile {
    provider?: Provider;
    instanceType?: string;
    hours: number;
    region?: string;
}

export interface APIUsageProfile {
    services: ServiceUsage[];
    monthlyTokens?: number;
    monthlyRequests?: number;
}

export interface ServiceUsage {
    service: string;
    tier: string;
    usage: number;
    unit: string;
}

export interface StartupInfraProfile {
    stage: StartupStage;
    monthlySpend: number;
    services: ServiceUsage[];
    growthRate: number;
    revenue: number;
    cashInBank: number;
}

export interface WorkloadProfile {
    workloadType: WorkloadType;
    trafficPattern: TrafficPattern;
    budgetConstraint: BudgetConstraint;
    monthlyBudget?: number;
    dataResidency?: string[];
    complianceNeeds?: string[];
}
