#!/usr/bin/env node
// CloudCost Intelligence MCP - Entry Point
// Supports both stdio (local) and HTTP/SSE (remote) modes

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer, toolCount } from './server.js';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MODE = process.env.MCP_MODE || 'http'; // 'stdio' or 'http'

// Health check response
function handleHealthCheck(res: ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'healthy',
        service: 'cloudcost-mcp',
        version: '1.0.0',
        tools: toolCount,
        timestamp: new Date().toISOString(),
    }));
}

// Info endpoint
function handleInfo(res: ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        name: 'CloudCost Intelligence MCP',
        version: '1.0.0',
        description: 'AI-native cost intelligence for cloud, AI models, and SaaS',
        toolCount,
        categories: [
            'AI Model Cost & Comparison',
            'Cloud Infrastructure Cost',
            'SaaS & Startup Burn',
            'Advanced Optimization'
        ],
        endpoints: {
            health: '/health',
            info: '/',
            mcp: '/mcp (SSE)',
        },
    }));
}

// CORS headers
function setCorsHeaders(res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// HTTP Server for MCP over SSE
async function startHttpServer() {
    const mcpServer = createServer();
    const transports = new Map<string, SSEServerTransport>();

    const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
        setCorsHeaders(res);

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://localhost:${PORT}`);

        // Health check
        if (url.pathname === '/health') {
            handleHealthCheck(res);
            return;
        }

        // Info endpoint
        if (url.pathname === '/' && req.method === 'GET') {
            handleInfo(res);
            return;
        }

        // MCP SSE endpoint
        if (url.pathname === '/mcp' || url.pathname === '/sse') {
            if (req.method === 'GET') {
                // SSE connection
                console.error(`[${new Date().toISOString()}] New SSE connection`);

                const transport = new SSEServerTransport('/mcp', res);
                const sessionId = Math.random().toString(36).substring(7);
                transports.set(sessionId, transport);

                res.on('close', () => {
                    console.error(`[${new Date().toISOString()}] SSE connection closed: ${sessionId}`);
                    transports.delete(sessionId);
                });

                await mcpServer.connect(transport);
                return;
            }

            if (req.method === 'POST') {
                // Handle message from client
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const sessionId = url.searchParams.get('sessionId');
                        if (sessionId && transports.has(sessionId)) {
                            const transport = transports.get(sessionId)!;
                            await transport.handlePostMessage(req, res, body);
                        } else {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Invalid session' }));
                        }
                    } catch (error) {
                        console.error('Error handling message:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Internal server error' }));
                    }
                });
                return;
            }
        }

        // 404 for unknown routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    httpServer.listen(PORT, () => {
        console.error(`\n🚀 CloudCost Intelligence MCP v1.0.0`);
        console.error(`📊 Loaded ${toolCount} intelligent cost tools`);
        console.error(`🌐 HTTP server running on port ${PORT}`);
        console.error(`\nEndpoints:`);
        console.error(`  GET  /        - API info`);
        console.error(`  GET  /health  - Health check`);
        console.error(`  GET  /mcp     - MCP SSE connection`);
        console.error(`\n✅ Ready for CTX Protocol integration`);
    });
}

// Stdio mode for local development
async function startStdioServer() {
    const server = createServer();
    const transport = new StdioServerTransport();

    console.error(`CloudCost Intelligence MCP v1.0.0`);
    console.error(`Loaded ${toolCount} tools`);
    console.error(`Running in stdio mode`);

    await server.connect(transport);
}

// Main entry point
async function main() {
    if (MODE === 'stdio') {
        await startStdioServer();
    } else {
        await startHttpServer();
    }
}

main().catch((error) => {
    console.error('Failed to start CloudCost MCP:', error);
    process.exit(1);
});
