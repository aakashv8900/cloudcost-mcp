// MCP Server Configuration
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { aiModelTools } from './tools/ai-models.js';
import { cloudInfraTools } from './tools/cloud-infra.js';
import { saasBurnTools } from './tools/saas-burn.js';
import { optimizationTools } from './tools/optimization.js';
import type { z } from 'zod';

// Create and configure the MCP server
export function createServer(): McpServer {
    const server = new McpServer({
        name: 'cloudcost-intelligence',
        version: '1.0.0',
    });

    // Register all tools
    const allTools = [
        ...aiModelTools,
        ...cloudInfraTools,
        ...saasBurnTools,
        ...optimizationTools,
    ];

    for (const tool of allTools) {
        server.tool(
            tool.name,
            tool.description,
            tool.inputSchema.shape as Record<string, z.ZodTypeAny>,
            async (args) => {
                try {
                    const validatedArgs = tool.inputSchema.parse(args);
                    const result = tool.handler(validatedArgs as never);

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    error: true,
                                    message: errorMessage,
                                    tool: tool.name,
                                }, null, 2),
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );
    }

    return server;
}

// Export tool count for debugging
export const toolCount =
    aiModelTools.length +
    cloudInfraTools.length +
    saasBurnTools.length +
    optimizationTools.length;
