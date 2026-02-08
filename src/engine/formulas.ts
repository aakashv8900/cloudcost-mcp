// Cost Formulas for CloudCost Intelligence MCP

// ============== AI Model Cost Formulas ==============

/**
 * Calculate AI model cost based on token usage
 */
export function calculateAIModelCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePerMillion: number,
    outputPricePerMillion: number
): { inputCost: number; outputCost: number; totalCost: number } {
    const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
    const totalCost = inputCost + outputCost;

    return {
        inputCost: Math.round(inputCost * 10000) / 10000,
        outputCost: Math.round(outputCost * 10000) / 10000,
        totalCost: Math.round(totalCost * 10000) / 10000,
    };
}

/**
 * Calculate cost per million tokens (blended rate assuming 1:1 input:output ratio)
 */
export function calculateCostPerMillion(
    inputPricePerMillion: number,
    outputPricePerMillion: number,
    inputOutputRatio: number = 0.5
): number {
    return inputPricePerMillion * inputOutputRatio + outputPricePerMillion * (1 - inputOutputRatio);
}

/**
 * Calculate batch API savings
 */
export function calculateBatchSavings(
    normalCost: number,
    batchDiscount: number
): { batchCost: number; savings: number; savingsPercent: number } {
    const batchCost = normalCost * (1 - batchDiscount);
    const savings = normalCost - batchCost;
    const savingsPercent = batchDiscount * 100;

    return {
        batchCost: Math.round(batchCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent,
    };
}

// ============== Compute Cost Formulas ==============

/**
 * Calculate compute cost based on hourly rate and usage
 */
export function calculateComputeCost(
    hourlyRate: number,
    hours: number,
    regionMultiplier: number = 1.0
): { hourly: number; monthly: number; yearly: number } {
    const adjustedHourlyRate = hourlyRate * regionMultiplier;
    const monthly = adjustedHourlyRate * hours;
    const yearly = monthly * 12;

    return {
        hourly: Math.round(adjustedHourlyRate * 10000) / 10000,
        monthly: Math.round(monthly * 100) / 100,
        yearly: Math.round(yearly * 100) / 100,
    };
}

/**
 * Calculate reserved instance savings
 */
export function calculateReservedSavings(
    onDemandMonthly: number,
    discountPercent: number
): { reservedMonthly: number; monthlySavings: number; yearlySavings: number } {
    const reservedMonthly = onDemandMonthly * (1 - discountPercent);
    const monthlySavings = onDemandMonthly - reservedMonthly;
    const yearlySavings = monthlySavings * 12;

    return {
        reservedMonthly: Math.round(reservedMonthly * 100) / 100,
        monthlySavings: Math.round(monthlySavings * 100) / 100,
        yearlySavings: Math.round(yearlySavings * 100) / 100,
    };
}

// ============== Storage Cost Formulas ==============

/**
 * Calculate storage cost based on capacity and duration
 */
export function calculateStorageCost(
    gbAmount: number,
    ratePerGb: number,
    durationMonths: number = 1
): { totalCost: number; monthlyAverage: number } {
    const totalCost = gbAmount * ratePerGb * durationMonths;
    const monthlyAverage = totalCost / durationMonths;

    return {
        totalCost: Math.round(totalCost * 100) / 100,
        monthlyAverage: Math.round(monthlyAverage * 100) / 100,
    };
}

/**
 * Calculate storage tiering savings (moving old data to cheaper tiers)
 */
export function calculateTieringSavings(
    totalGb: number,
    hotDataPercent: number,
    hotRate: number,
    coldRate: number
): { currentCost: number; optimizedCost: number; savings: number } {
    const hotGb = totalGb * hotDataPercent;
    const coldGb = totalGb * (1 - hotDataPercent);

    const currentCost = totalGb * hotRate; // All data in hot storage
    const optimizedCost = hotGb * hotRate + coldGb * coldRate;
    const savings = currentCost - optimizedCost;

    return {
        currentCost: Math.round(currentCost * 100) / 100,
        optimizedCost: Math.round(optimizedCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
    };
}

// ============== Bandwidth Cost Formulas ==============

/**
 * Calculate tiered bandwidth cost based on usage
 */
export function calculateBandwidthCost(
    gbTransferred: number,
    tiers: { limit: number; rate: number }[]
): { totalCost: number; breakdown: { tier: string; gb: number; cost: number }[] } {
    let remaining = gbTransferred;
    let totalCost = 0;
    const breakdown: { tier: string; gb: number; cost: number }[] = [];
    let previousLimit = 0;

    for (const tier of tiers) {
        if (remaining <= 0) break;

        const tierCapacity = tier.limit - previousLimit;
        const gbInTier = Math.min(remaining, tierCapacity);
        const tierCost = gbInTier * tier.rate;

        if (gbInTier > 0) {
            breakdown.push({
                tier: `${previousLimit}-${tier.limit} GB`,
                gb: gbInTier,
                cost: Math.round(tierCost * 100) / 100,
            });
        }

        totalCost += tierCost;
        remaining -= gbInTier;
        previousLimit = tier.limit;
    }

    return {
        totalCost: Math.round(totalCost * 100) / 100,
        breakdown,
    };
}

// ============== Scaling Forecast Formulas ==============

/**
 * Forecast future cost based on growth rate
 */
export function forecastCost(
    baseCost: number,
    growthRate: number,
    months: number
): { projectedCost: number; totalSpend: number; projections: { month: number; cost: number }[] } {
    const projections: { month: number; cost: number }[] = [];
    let totalSpend = 0;

    for (let i = 1; i <= months; i++) {
        const cost = baseCost * Math.pow(1 + growthRate, i);
        projections.push({
            month: i,
            cost: Math.round(cost * 100) / 100,
        });
        totalSpend += cost;
    }

    return {
        projectedCost: projections[projections.length - 1].cost,
        totalSpend: Math.round(totalSpend * 100) / 100,
        projections,
    };
}

// ============== Runway Formulas ==============

/**
 * Calculate startup runway in months
 */
export function calculateRunway(
    cashInBank: number,
    monthlyBurn: number,
    monthlyRevenue: number = 0
): { runwayMonths: number; netBurn: number; breakEvenPoint: number | null } {
    const netBurn = monthlyBurn - monthlyRevenue;

    if (netBurn <= 0) {
        return {
            runwayMonths: Infinity,
            netBurn,
            breakEvenPoint: 0,
        };
    }

    const runwayMonths = cashInBank / netBurn;

    // Calculate when revenue could cover burn at current growth
    const breakEvenPoint = monthlyRevenue > 0 && monthlyBurn > monthlyRevenue
        ? Math.ceil(Math.log(monthlyBurn / monthlyRevenue) / Math.log(1.1)) // Assuming 10% MoM growth
        : null;

    return {
        runwayMonths: Math.round(runwayMonths * 10) / 10,
        netBurn: Math.round(netBurn * 100) / 100,
        breakEvenPoint,
    };
}

/**
 * Calculate burn multiple (Net Burn / Net New ARR)
 */
export function calculateBurnMultiple(
    monthlyBurn: number,
    newMRR: number
): { burnMultiple: number; efficiency: 'excellent' | 'good' | 'fair' | 'concerning' } {
    if (newMRR <= 0) {
        return { burnMultiple: Infinity, efficiency: 'concerning' };
    }

    const burnMultiple = monthlyBurn / newMRR;

    let efficiency: 'excellent' | 'good' | 'fair' | 'concerning';
    if (burnMultiple < 1) efficiency = 'excellent';
    else if (burnMultiple < 2) efficiency = 'good';
    else if (burnMultiple < 3) efficiency = 'fair';
    else efficiency = 'concerning';

    return {
        burnMultiple: Math.round(burnMultiple * 100) / 100,
        efficiency,
    };
}

// ============== Break-Even Analysis ==============

/**
 * Calculate break-even point between two options
 */
export function calculateBreakEven(
    optionA: { upfront: number; monthly: number },
    optionB: { upfront: number; monthly: number }
): { breakEvenMonths: number | null; recommendation: string } {
    // If monthly costs are equal, just compare upfront
    if (optionA.monthly === optionB.monthly) {
        if (optionA.upfront < optionB.upfront) {
            return { breakEvenMonths: 0, recommendation: 'Option A has lower upfront cost with equal monthly costs' };
        } else {
            return { breakEvenMonths: 0, recommendation: 'Option B has lower upfront cost with equal monthly costs' };
        }
    }

    // Calculate break-even point
    // optionA.upfront + optionA.monthly * months = optionB.upfront + optionB.monthly * months
    // (optionA.monthly - optionB.monthly) * months = optionB.upfront - optionA.upfront
    const monthlyDiff = optionA.monthly - optionB.monthly;
    const upfrontDiff = optionB.upfront - optionA.upfront;

    if (monthlyDiff === 0) {
        return { breakEvenMonths: null, recommendation: 'No break-even point with equal monthly costs' };
    }

    const breakEvenMonths = upfrontDiff / monthlyDiff;

    if (breakEvenMonths < 0) {
        // No crossover - one option is always better
        if (optionA.upfront <= optionB.upfront && optionA.monthly <= optionB.monthly) {
            return { breakEvenMonths: null, recommendation: 'Option A is always cheaper' };
        } else {
            return { breakEvenMonths: null, recommendation: 'Option B is always cheaper' };
        }
    }

    return {
        breakEvenMonths: Math.round(breakEvenMonths * 10) / 10,
        recommendation: `Break-even at ${Math.ceil(breakEvenMonths)} months`,
    };
}

// ============== Efficiency Scoring ==============

/**
 * Calculate cost efficiency score for AI models
 */
export function calculateEfficiencyScore(
    costPer1M: number,
    qualityTier: 'flagship' | 'balanced' | 'cost_optimized' | 'reasoning' | 'embedding'
): number {
    const qualityMultipliers: Record<string, number> = {
        flagship: 1.0,
        reasoning: 1.2,
        balanced: 0.9,
        cost_optimized: 0.7,
        embedding: 0.5,
    };

    const qualityWeight = qualityMultipliers[qualityTier] || 1.0;

    // Lower cost = higher efficiency, weighted by quality
    // Score from 0-100, where 100 is most efficient
    const baseCostScore = Math.max(0, 100 - costPer1M * 5);
    return Math.round(baseCostScore * qualityWeight);
}
