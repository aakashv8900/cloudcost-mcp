/**
 * Pricing Data Update Service - Enhanced Edition
 * Runs on a separate port, updates pricing data every 6-12 hours
 * 
 * Features:
 * - Cloud pricing: AWS Bulk API, Azure Retail Prices, GCP
 * - AI Models: OpenAI, Anthropic pricing + specs (context windows)
 * - SaaS: Supabase, Vercel, MongoDB, Cloudflare pricing
 * - Instance specs: vCPU, memory, GPU info
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PRICING_DIR = path.join(process.cwd(), 'pricing');
const UPDATE_PORT = parseInt(process.env.UPDATE_PORT || '3001', 10);
const UPDATE_INTERVAL_HOURS = parseInt(process.env.UPDATE_INTERVAL || '6', 10);
const RUN_ONCE = process.argv.includes('--once') || process.env.RUN_ONCE === 'true';
const RUN_ONCE = process.argv.includes('--once') || process.env.RUN_ONCE === 'true';

interface PriceUpdate {
    source: string;
    lastUpdate: string;
    itemsUpdated: number;
    status: 'success' | 'failed' | 'no_change';
    message?: string;
    details?: string[];
}

interface UpdateResult {
    timestamp: string;
    updates: PriceUpdate[];
    totalItemsUpdated: number;
    nextUpdateIn: string;
}

// ============== Helper Functions ==============

function safeWriteJson(filePath: string, data: any): void {
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 4));
    fs.renameSync(tempPath, filePath);
}

function safeReadJson(filePath: string): any {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

// ============== OpenAI Pricing + Specs ==============

async function fetchOpenAIPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        // Latest OpenAI pricing with full specs
        const modelSpecs: Record<string, any> = {
            'gpt-4o': {
                input_per_million: 2.5,
                output_per_million: 10,
                context_window: 128000,
                max_output: 16384,
                category: 'flagship',
                best_for: ['chat', 'code', 'vision', 'reasoning'],
                latency: 'fast',
                supports_vision: true,
                supports_function_calling: true,
            },
            'gpt-4o-mini': {
                input_per_million: 0.15,
                output_per_million: 0.6,
                context_window: 128000,
                max_output: 16384,
                category: 'cost-optimized',
                best_for: ['chat', 'code', 'simple-tasks'],
                latency: 'very-fast',
                supports_vision: true,
                supports_function_calling: true,
            },
            'gpt-4-turbo': {
                input_per_million: 10,
                output_per_million: 30,
                context_window: 128000,
                max_output: 4096,
                category: 'flagship',
                best_for: ['chat', 'code', 'vision'],
                latency: 'medium',
                supports_vision: true,
                supports_function_calling: true,
            },
            'o1': {
                input_per_million: 15,
                output_per_million: 60,
                context_window: 200000,
                max_output: 100000,
                category: 'reasoning',
                best_for: ['reasoning', 'math', 'code', 'science'],
                latency: 'slow',
                supports_vision: false,
                supports_function_calling: false,
            },
            'o1-mini': {
                input_per_million: 3,
                output_per_million: 12,
                context_window: 128000,
                max_output: 65536,
                category: 'reasoning',
                best_for: ['reasoning', 'math', 'code'],
                latency: 'medium',
                supports_vision: false,
                supports_function_calling: false,
            },
            'o3-mini': {
                input_per_million: 1.1,
                output_per_million: 4.4,
                context_window: 200000,
                max_output: 100000,
                category: 'reasoning',
                best_for: ['reasoning', 'math', 'code'],
                latency: 'fast',
                supports_vision: false,
                supports_function_calling: true,
            },
            'gpt-4o-realtime': {
                input_per_million: 5,
                output_per_million: 20,
                audio_input_per_million: 100,
                audio_output_per_million: 200,
                context_window: 128000,
                category: 'realtime',
                best_for: ['voice', 'real-time'],
                latency: 'real-time',
            },
            'text-embedding-3-large': {
                input_per_million: 0.13,
                output_per_million: 0,
                dimensions: 3072,
                context_window: 8191,
                category: 'embedding',
                best_for: ['embedding', 'search', 'rag'],
            },
            'text-embedding-3-small': {
                input_per_million: 0.02,
                output_per_million: 0,
                dimensions: 1536,
                context_window: 8191,
                category: 'embedding',
                best_for: ['embedding', 'search'],
            },
        };

        const filePath = path.join(PRICING_DIR, 'openai.json');
        const existing = safeReadJson(filePath) || {};

        let updated = 0;
        for (const [model, specs] of Object.entries(modelSpecs)) {
            const current = existing[model] || {};
            let changed = false;

            for (const [key, value] of Object.entries(specs)) {
                if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
                    changed = true;
                    break;
                }
            }

            if (changed || !existing[model]) {
                existing[model] = { ...current, ...specs };
                updated++;
                details.push(`Updated ${model}`);
            }
        }

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'OpenAI (pricing + specs)',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'OpenAI',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== Anthropic Pricing + Specs ==============

async function fetchAnthropicPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        const modelSpecs: Record<string, any> = {
            'claude-3-5-sonnet-20241022': {
                input_per_million: 3,
                output_per_million: 15,
                context_window: 200000,
                max_output: 8192,
                category: 'flagship',
                best_for: ['chat', 'code', 'analysis', 'vision'],
                latency: 'fast',
                supports_vision: true,
                supports_tool_use: true,
                batch_discount: 0.5,
            },
            'claude-3-5-haiku-20241022': {
                input_per_million: 0.8,
                output_per_million: 4,
                context_window: 200000,
                max_output: 8192,
                category: 'speed',
                best_for: ['chat', 'quick-tasks', 'classification'],
                latency: 'very-fast',
                supports_vision: true,
                supports_tool_use: true,
                batch_discount: 0.5,
            },
            'claude-3-opus-20240229': {
                input_per_million: 15,
                output_per_million: 75,
                context_window: 200000,
                max_output: 4096,
                category: 'premium',
                best_for: ['complex-analysis', 'research', 'writing'],
                latency: 'slow',
                supports_vision: true,
                supports_tool_use: true,
                batch_discount: 0.5,
            },
            'claude-3-sonnet-20240229': {
                input_per_million: 3,
                output_per_million: 15,
                context_window: 200000,
                max_output: 4096,
                category: 'balanced',
                best_for: ['chat', 'code', 'analysis'],
                latency: 'medium',
                supports_vision: true,
                supports_tool_use: true,
            },
            'claude-3-haiku-20240307': {
                input_per_million: 0.25,
                output_per_million: 1.25,
                context_window: 200000,
                max_output: 4096,
                category: 'speed',
                best_for: ['chat', 'quick-tasks'],
                latency: 'very-fast',
                supports_vision: true,
                supports_tool_use: true,
            },
        };

        const filePath = path.join(PRICING_DIR, 'anthropic.json');
        const existing = safeReadJson(filePath) || {};

        let updated = 0;
        for (const [model, specs] of Object.entries(modelSpecs)) {
            const current = existing[model] || {};
            let changed = !existing[model];

            if (!changed) {
                for (const [key, value] of Object.entries(specs)) {
                    if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
                        changed = true;
                        break;
                    }
                }
            }

            if (changed) {
                existing[model] = { ...current, ...specs };
                updated++;
                details.push(`Updated ${model}`);
            }
        }

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'Anthropic (pricing + specs)',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'Anthropic',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== AWS Bulk Pricing API ==============

async function fetchAWSBulkPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        // AWS Price List Indexasync function main() {
        console.log(`[${new Date().toISOString()}] Pricing Updater starting...`);
        console.log(`[${new Date().toISOString()}] Mode: ${RUN_ONCE ? 'One-time update' : 'Continuous service'}`);

        if (RUN_ONCE) {
            try {
                await updateAllPricing();
                console.log(`[${new Date().toISOString()}] One-time update completed successfully.`);
                process.exit(0);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] One-time update failed:`, error);
                process.exit(1);
            }
        } else {
            // Start HTTP Server for health checks/manual updates
            const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
                // ... (existing server logic)
            });

            server.listen(UPDATE_PORT, '0.0.0.0', () => {
                console.log(`Pricing updater status server running on port ${UPDATE_PORT}`);
            });

            // Run initial update
            await updateAllPricing();

            // Schedule periodic updates
            setInterval(async () => {
                console.log(`[${new Date().toISOString()}] Starting scheduled update...`);
                await updateAllPricing();
            }, UPDATE_INTERVAL_HOURS * 60 * 60 * 1000);
        }
    }

// Helper to run all updates
async function updateAllPricing() {
        const results = await Promise.all([
            fetchOpenAIPricing(),
            fetchAnthropicPricing(),
            fetchAWSBulkPricing(),
            fetchAzurePricing(),
            fetchSupabasePricing(),
            fetchVercelPricing(),
            fetchMongoDBPricing(),
            fetchCloudflarePricing()
        ]);

        const totalUpdated = results.reduce((sum, r) => sum + r.itemsUpdated, 0);
        console.log(`[${new Date().toISOString()}] Update cycle complete. Total items updated: ${totalUpdated}`);
        return results;
    }

    main().catch(err => {
        console.error('Fatal error in pricing updater:', err);
        process.exit(1);
    });
    const indexUrl = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json';
    const indexResponse = await fetch(indexUrl, { signal: AbortSignal.timeout(10000) });

    if (!indexResponse.ok) {
        return {
            source: 'AWS Bulk',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: `Index API returned ${indexResponse.status}`,
        };
    }

    const indexData: any = await indexResponse.json();

    // Get EC2 savings plans pricing (smaller than full EC2 pricing)
    const savingsPlansUrl = indexData.offers?.AmazonEC2?.currentSavingsPlanIndexUrl;

    if (savingsPlansUrl) {
        details.push('Found AWS savings plans pricing URL');
    }

    // Fetch specific instance types from smaller region files
    const regionPriceUrl = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json';

    // Note: This file is ~100MB, so we use HEAD to check last-modified
    const headResponse = await fetch(regionPriceUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
    });

    const lastModified = headResponse.headers.get('last-modified');
    if (lastModified) {
        details.push(`AWS EC2 pricing last modified: ${lastModified}`);
    }

    // For now, use curated pricing for common instance types
    const awsInstancePricing: Record<string, Record<string, any>> = {
        t3: {
            micro: { hourly_rate: 0.0104, vcpu: 2, memory_gb: 1 },
            small: { hourly_rate: 0.0208, vcpu: 2, memory_gb: 2 },
            medium: { hourly_rate: 0.0416, vcpu: 2, memory_gb: 4 },
            large: { hourly_rate: 0.0832, vcpu: 2, memory_gb: 8 },
            xlarge: { hourly_rate: 0.1664, vcpu: 4, memory_gb: 16 },
            '2xlarge': { hourly_rate: 0.3328, vcpu: 8, memory_gb: 32 },
        },
        m6i: {
            large: { hourly_rate: 0.096, vcpu: 2, memory_gb: 8 },
            xlarge: { hourly_rate: 0.192, vcpu: 4, memory_gb: 16 },
            '2xlarge': { hourly_rate: 0.384, vcpu: 8, memory_gb: 32 },
            '4xlarge': { hourly_rate: 0.768, vcpu: 16, memory_gb: 64 },
        },
        c6i: {
            large: { hourly_rate: 0.085, vcpu: 2, memory_gb: 4 },
            xlarge: { hourly_rate: 0.17, vcpu: 4, memory_gb: 8 },
            '2xlarge': { hourly_rate: 0.34, vcpu: 8, memory_gb: 16 },
        },
        r6i: {
            large: { hourly_rate: 0.126, vcpu: 2, memory_gb: 16 },
            xlarge: { hourly_rate: 0.252, vcpu: 4, memory_gb: 32 },
            '2xlarge': { hourly_rate: 0.504, vcpu: 8, memory_gb: 64 },
        },
    };

    const filePath = path.join(PRICING_DIR, 'aws_compute.json');
    const existing = safeReadJson(filePath) || {};

    let updated = 0;
    for (const [family, sizes] of Object.entries(awsInstancePricing)) {
        if (!existing[family]) existing[family] = {};

        for (const [size, specs] of Object.entries(sizes)) {
            const current = existing[family][size] || {};
            if (current.hourly_rate !== specs.hourly_rate ||
                current.vcpu !== specs.vcpu ||
                current.memory_gb !== specs.memory_gb) {
                existing[family][size] = { ...current, ...specs, category: 'general-purpose' };
                updated++;
            }
        }
    }

    if (updated > 0) {
        safeWriteJson(filePath, existing);
        details.push(`Updated ${updated} AWS instance types`);
    }

    return {
        source: 'AWS EC2 (bulk + specs)',
        lastUpdate: new Date().toISOString(),
        itemsUpdated: updated,
        status: updated > 0 ? 'success' : 'no_change',
        details,
    };
} catch (error) {
    return {
        source: 'AWS Bulk',
        lastUpdate: new Date().toISOString(),
        itemsUpdated: 0,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
    };
}
}

// ============== Azure Retail Prices API ==============

async function fetchAzurePricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        // Azure Retail Prices API - free, no auth required
        const response = await fetch(
            'https://prices.azure.com/api/retail/prices?' +
            '$filter=serviceName eq \'Virtual Machines\' and armRegionName eq \'eastus\' and priceType eq \'Consumption\'' +
            '&$top=500',
            { signal: AbortSignal.timeout(15000) }
        );

        if (!response.ok) {
            return {
                source: 'Azure VMs',
                lastUpdate: new Date().toISOString(),
                itemsUpdated: 0,
                status: 'failed',
                message: `API returned ${response.status}`,
            };
        }

        const data: any = await response.json();
        const items = data.Items || [];
        details.push(`Fetched ${items.length} Azure pricing items`);

        const filePath = path.join(PRICING_DIR, 'azure_compute.json');
        const existing = safeReadJson(filePath) || {};

        let updated = 0;
        for (const item of items) {
            const skuName = item.armSkuName || '';
            const price = item.retailPrice;

            if (skuName && price && item.type === 'Consumption' && !item.skuName?.includes('Spot')) {
                // Find family from SKU name (e.g., B2ms -> B, D4s_v5 -> D)
                const familyMatch = skuName.match(/^([A-Z]+)/);
                if (familyMatch) {
                    const family = familyMatch[1];
                    if (!existing[family]) existing[family] = {};

                    if (!existing[family][skuName] || existing[family][skuName].hourly_rate !== price) {
                        existing[family][skuName] = {
                            ...existing[family][skuName],
                            hourly_rate: price,
                            vcpu: item.vcpus || existing[family][skuName]?.vcpu,
                            memory_gb: item.memory || existing[family][skuName]?.memory_gb,
                        };
                        updated++;
                    }
                }
            }
        }

        if (updated > 0) {
            safeWriteJson(filePath, existing);
            details.push(`Updated ${updated} Azure VM prices`);
        }

        return {
            source: 'Azure VMs (API)',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            message: `Checked ${items.length} items`,
            details,
        };
    } catch (error) {
        return {
            source: 'Azure VMs',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== SaaS Pricing: Supabase ==============

async function fetchSupabasePricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        // Supabase pricing is publicly available
        const supabasePlans: Record<string, any> = {
            free: {
                monthly_cost: 0,
                database_size_gb: 0.5,
                bandwidth_gb: 5,
                storage_gb: 1,
                edge_function_invocations: 500000,
                realtime_messages: 2000000,
                auth_mau: 50000,
            },
            pro: {
                monthly_cost: 25,
                database_size_gb: 8,
                bandwidth_gb: 250,
                storage_gb: 100,
                edge_function_invocations: 2000000,
                realtime_messages: 5000000,
                auth_mau: 100000,
                overage_database_per_gb: 0.125,
                overage_bandwidth_per_gb: 0.09,
            },
            team: {
                monthly_cost: 599,
                database_size_gb: 'custom',
                bandwidth_gb: 'custom',
                storage_gb: 'custom',
                sla: '99.9%',
                support: 'priority',
            },
        };

        const filePath = path.join(PRICING_DIR, 'saas_tools.json');
        const existing = safeReadJson(filePath) || {};

        if (!existing.supabase) existing.supabase = { plans: {} };
        if (!existing.supabase.plans) existing.supabase.plans = {};

        let updated = 0;
        for (const [plan, specs] of Object.entries(supabasePlans)) {
            const current = existing.supabase.plans[plan] || {};
            if (JSON.stringify(current) !== JSON.stringify(specs)) {
                existing.supabase.plans[plan] = specs;
                updated++;
                details.push(`Updated Supabase ${plan} plan`);
            }
        }

        existing.supabase.last_updated = new Date().toISOString();

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'Supabase',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'Supabase',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== SaaS Pricing: Vercel ==============

async function fetchVercelPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        const vercelPlans: Record<string, any> = {
            hobby: {
                monthly_cost: 0,
                bandwidth_gb: 100,
                serverless_function_execution_gb_hours: 100,
                edge_function_invocations: 1000000,
                builds_per_month: 6000,
                team_members: 1,
            },
            pro: {
                monthly_cost: 20,
                bandwidth_gb: 1000,
                serverless_function_execution_gb_hours: 1000,
                edge_function_invocations: 'unlimited',
                builds_per_month: 'unlimited',
                team_members: 10,
                overage_bandwidth_per_gb: 0.15,
            },
            enterprise: {
                monthly_cost: 'custom',
                bandwidth_gb: 'custom',
                sla: '99.99%',
                support: 'dedicated',
            },
        };

        const filePath = path.join(PRICING_DIR, 'saas_tools.json');
        const existing = safeReadJson(filePath) || {};

        if (!existing.vercel) existing.vercel = { plans: {} };
        if (!existing.vercel.plans) existing.vercel.plans = {};

        let updated = 0;
        for (const [plan, specs] of Object.entries(vercelPlans)) {
            const current = existing.vercel.plans[plan] || {};
            if (JSON.stringify(current) !== JSON.stringify(specs)) {
                existing.vercel.plans[plan] = specs;
                updated++;
                details.push(`Updated Vercel ${plan} plan`);
            }
        }

        existing.vercel.last_updated = new Date().toISOString();

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'Vercel',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'Vercel',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== SaaS Pricing: MongoDB Atlas ==============

async function fetchMongoDBPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        const mongoPlans: Record<string, any> = {
            m0_free: {
                monthly_cost: 0,
                storage_gb: 0.5,
                ram_gb: 'shared',
                vcpu: 'shared',
                connections: 100,
                network_limit: true,
            },
            m10: {
                monthly_cost: 57,
                storage_gb: 10,
                ram_gb: 2,
                vcpu: 2,
                connections: 500,
            },
            m20: {
                monthly_cost: 140,
                storage_gb: 20,
                ram_gb: 4,
                vcpu: 2,
                connections: 1500,
            },
            m30: {
                monthly_cost: 280,
                storage_gb: 40,
                ram_gb: 8,
                vcpu: 2,
                connections: 3000,
            },
            m40: {
                monthly_cost: 455,
                storage_gb: 80,
                ram_gb: 16,
                vcpu: 4,
                connections: 6000,
            },
            m50: {
                monthly_cost: 698,
                storage_gb: 160,
                ram_gb: 32,
                vcpu: 8,
                connections: 16000,
            },
            serverless: {
                per_million_reads: 0.10,
                per_million_writes: 1.00,
                storage_per_gb: 0.25,
                connections: 'unlimited',
            },
        };

        const filePath = path.join(PRICING_DIR, 'saas_tools.json');
        const existing = safeReadJson(filePath) || {};

        if (!existing.mongodb) existing.mongodb = { plans: {} };
        if (!existing.mongodb.plans) existing.mongodb.plans = {};

        let updated = 0;
        for (const [plan, specs] of Object.entries(mongoPlans)) {
            const current = existing.mongodb.plans[plan] || {};
            if (JSON.stringify(current) !== JSON.stringify(specs)) {
                existing.mongodb.plans[plan] = specs;
                updated++;
                details.push(`Updated MongoDB ${plan} plan`);
            }
        }

        existing.mongodb.last_updated = new Date().toISOString();

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'MongoDB Atlas',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'MongoDB Atlas',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== SaaS Pricing: Cloudflare ==============

async function fetchCloudflarePricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        const cloudflarePlans: Record<string, any> = {
            free: {
                monthly_cost: 0,
                ddos_protection: true,
                cdn: true,
                ssl: true,
                workers_requests: 100000,
                workers_cpu_ms: 10,
                r2_storage_gb: 10,
                r2_operations_class_a: 1000000,
                r2_operations_class_b: 10000000,
            },
            pro: {
                monthly_cost: 20,
                ddos_protection: true,
                cdn: true,
                ssl: true,
                waf_rules: 5,
                workers_requests: 10000000,
                workers_cpu_ms: 50,
            },
            business: {
                monthly_cost: 200,
                ddos_protection: true,
                cdn: true,
                ssl: true,
                waf_rules: 25,
                sla: '100%',
            },
            workers_paid: {
                monthly_cost: 5,
                requests_included: 10000000,
                overage_per_million: 0.30,
                cpu_ms: 50,
                duration_gb_sec: 400000,
            },
            r2: {
                storage_per_gb: 0.015,
                class_a_per_million: 4.50,
                class_b_per_million: 0.36,
                egress: 0, // Free egress!
            },
        };

        const filePath = path.join(PRICING_DIR, 'saas_tools.json');
        const existing = safeReadJson(filePath) || {};

        if (!existing.cloudflare) existing.cloudflare = { plans: {} };
        if (!existing.cloudflare.plans) existing.cloudflare.plans = {};

        let updated = 0;
        for (const [plan, specs] of Object.entries(cloudflarePlans)) {
            const current = existing.cloudflare.plans[plan] || {};
            if (JSON.stringify(current) !== JSON.stringify(specs)) {
                existing.cloudflare.plans[plan] = specs;
                updated++;
                details.push(`Updated Cloudflare ${plan}`);
            }
        }

        existing.cloudflare.last_updated = new Date().toISOString();

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'Cloudflare',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'Cloudflare',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== GCP Pricing ==============

async function fetchGCPPricing(): Promise<PriceUpdate> {
    const details: string[] = [];
    try {
        // GCP instance specs and pricing
        const gcpInstances: Record<string, Record<string, any>> = {
            e2: {
                'e2-micro': { hourly_rate: 0.0084, vcpu: 0.25, memory_gb: 1 },
                'e2-small': { hourly_rate: 0.0168, vcpu: 0.5, memory_gb: 2 },
                'e2-medium': { hourly_rate: 0.0336, vcpu: 1, memory_gb: 4 },
                'e2-standard-2': { hourly_rate: 0.0672, vcpu: 2, memory_gb: 8 },
                'e2-standard-4': { hourly_rate: 0.1344, vcpu: 4, memory_gb: 16 },
                'e2-standard-8': { hourly_rate: 0.2688, vcpu: 8, memory_gb: 32 },
            },
            n2: {
                'n2-standard-2': { hourly_rate: 0.0971, vcpu: 2, memory_gb: 8 },
                'n2-standard-4': { hourly_rate: 0.1942, vcpu: 4, memory_gb: 16 },
                'n2-standard-8': { hourly_rate: 0.3885, vcpu: 8, memory_gb: 32 },
                'n2-highmem-2': { hourly_rate: 0.1311, vcpu: 2, memory_gb: 16 },
                'n2-highmem-4': { hourly_rate: 0.2622, vcpu: 4, memory_gb: 32 },
            },
            c2: {
                'c2-standard-4': { hourly_rate: 0.2088, vcpu: 4, memory_gb: 16 },
                'c2-standard-8': { hourly_rate: 0.4176, vcpu: 8, memory_gb: 32 },
                'c2-standard-16': { hourly_rate: 0.8352, vcpu: 16, memory_gb: 64 },
            },
        };

        const filePath = path.join(PRICING_DIR, 'gcp_compute.json');
        const existing = safeReadJson(filePath) || {};

        let updated = 0;
        for (const [family, instances] of Object.entries(gcpInstances)) {
            if (!existing[family]) existing[family] = {};

            for (const [name, specs] of Object.entries(instances)) {
                const current = existing[family][name] || {};
                if (current.hourly_rate !== specs.hourly_rate ||
                    current.vcpu !== specs.vcpu ||
                    current.memory_gb !== specs.memory_gb) {
                    existing[family][name] = { ...current, ...specs, category: 'general-purpose' };
                    updated++;
                    details.push(`Updated ${name}`);
                }
            }
        }

        if (updated > 0) {
            safeWriteJson(filePath, existing);
        }

        return {
            source: 'GCP Compute (specs)',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: updated,
            status: updated > 0 ? 'success' : 'no_change',
            details,
        };
    } catch (error) {
        return {
            source: 'GCP Compute',
            lastUpdate: new Date().toISOString(),
            itemsUpdated: 0,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============== Update Orchestrator ==============

async function runPricingUpdate(): Promise<UpdateResult> {
    console.log(`\n[${new Date().toISOString()}] Starting comprehensive pricing update...`);

    const updates = await Promise.all([
        fetchOpenAIPricing(),
        fetchAnthropicPricing(),
        fetchAWSBulkPricing(),
        fetchAzurePricing(),
        fetchGCPPricing(),
        fetchSupabasePricing(),
        fetchVercelPricing(),
        fetchMongoDBPricing(),
        fetchCloudflarePricing(),
    ]);

    const totalItemsUpdated = updates.reduce((sum, u) => sum + u.itemsUpdated, 0);

    const result: UpdateResult = {
        timestamp: new Date().toISOString(),
        updates,
        totalItemsUpdated,
        nextUpdateIn: `${UPDATE_INTERVAL_HOURS} hours`,
    };

    console.log(`[${new Date().toISOString()}] Update complete!`);
    console.log(`  Total items updated: ${totalItemsUpdated}`);
    updates.forEach(u => {
        const icon = u.status === 'success' ? '✅' : u.status === 'no_change' ? '⏸️' : '❌';
        console.log(`  ${icon} ${u.source}: ${u.itemsUpdated} items`);
    });

    return result;
}

// ============== HTTP Server ==============

let lastUpdateResult: UpdateResult | null = null;
let isUpdating = false;

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const url = new URL(req.url || '/', `http://localhost:${UPDATE_PORT}`);

    if (url.pathname === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'healthy',
            service: 'pricing-updater',
            interval: `${UPDATE_INTERVAL_HOURS}h`,
            lastUpdate: lastUpdateResult?.timestamp || 'never',
            sources: [
                'OpenAI', 'Anthropic', 'AWS', 'Azure', 'GCP',
                'Supabase', 'Vercel', 'MongoDB', 'Cloudflare'
            ],
        }));
        return;
    }

    if (url.pathname === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
            isUpdating,
            lastUpdate: lastUpdateResult,
            nextUpdate: lastUpdateResult
                ? new Date(new Date(lastUpdateResult.timestamp).getTime() + UPDATE_INTERVAL_HOURS * 60 * 60 * 1000).toISOString()
                : 'pending',
        }, null, 2));
        return;
    }

    if (url.pathname === '/trigger' && req.method === 'POST') {
        if (isUpdating) {
            res.writeHead(409);
            res.end(JSON.stringify({ error: 'Update already in progress' }));
            return;
        }

        isUpdating = true;
        try {
            lastUpdateResult = await runPricingUpdate();
            res.writeHead(200);
            res.end(JSON.stringify(lastUpdateResult, null, 2));
        } finally {
            isUpdating = false;
        }
        return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
        service: 'CloudCost Pricing Updater',
        version: '2.0.0',
        description: 'Comprehensive pricing data updater for cloud and SaaS services',
        endpoints: {
            '/health': 'Health check',
            '/status': 'Get update status and last results',
            '/trigger': 'POST to manually trigger update',
        },
        schedule: `Every ${UPDATE_INTERVAL_HOURS} hours`,
        sources: {
            ai: ['OpenAI (pricing + specs)', 'Anthropic (pricing + specs)'],
            cloud: ['AWS Bulk API', 'Azure Retail Prices API', 'GCP'],
            saas: ['Supabase', 'Vercel', 'MongoDB Atlas', 'Cloudflare'],
        },
    }, null, 2));
}

// ============== Main ==============

async function main() {
    if (RUN_ONCE) {
        console.log(`[${new Date().toISOString()}] Running one-time pricing update for build...`);
        try {
            await runPricingUpdate();
            console.log(`[${new Date().toISOString()}] build-time update completed.`);
            process.exit(0);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] build-time update failed:`, error);
            process.exit(1);
        }
        return;
    }

    const server = createServer(handleRequest);

    server.listen(UPDATE_PORT, () => {
        console.log(`\n🔄 CloudCost Pricing Updater v2.0.0`);
        console.log(`📊 Update interval: Every ${UPDATE_INTERVAL_HOURS} hours`);
        console.log(`🌐 Running on port ${UPDATE_PORT}`);
        // ... (rest of logging)
    });

    // Run initial update
    console.log('Running initial pricing update...');
    lastUpdateResult = await runPricingUpdate();

    // Schedule periodic updates
    setInterval(async () => {
        if (!isUpdating) {
            isUpdating = true;
            try {
                lastUpdateResult = await runPricingUpdate();
            } finally {
                isUpdating = false;
            }
        }
    }, UPDATE_INTERVAL_HOURS * 60 * 60 * 1000);
}

main().catch(console.error);
