#!/usr/bin/env node
// CloudCost Intelligence MCP - Entry Point
// Supports both stdio (local) and HTTP/SSE (remote) modes

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer, toolCount } from './server.js';
import http from 'http';
import { URL } from 'url';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MODE = process.env.MCP_MODE || 'http'; // 'stdio' or 'http'

// HTTP Server for MCP over SSE
async function startHttpServer() {
    const transports: Map<string, SSEServerTransport> = new Map();

    const httpServer = http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://localhost:${PORT}`);

        // Health check
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'cloudcost-mcp',
                version: '1.0.0',
                tools: toolCount,
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        // Info endpoint
        if (url.pathname === '/' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                name: 'CloudCost Intelligence MCP',
                version: '1.0.0',
                description: 'AI-native cost intelligence for cloud, AI models, and SaaS',
                toolCount,
                endpoints: {
                    health: 'GET /health',
                    sse: 'GET /sse',
                    message: 'POST /message',
                },
            }));
            return;
        }

        // SSE endpoint - establish connection
        if (url.pathname === '/sse' && req.method === 'GET') {
            console.error(`[${new Date().toISOString()}] New SSE connection`);

            const transport = new SSEServerTransport('/message', res);
            const sessionId = transport.sessionId;
            transports.set(sessionId, transport);

            console.error(`[${new Date().toISOString()}] Session created: ${sessionId}`);

            res.on('close', () => {
                console.error(`[${new Date().toISOString()}] SSE connection closed: ${sessionId}`);
                transports.delete(sessionId);
            });

            const server = createServer();
            await server.connect(transport);
            return;
        }

        // Message endpoint - handle incoming messages
        if (url.pathname === '/message' && req.method === 'POST') {
            const sessionId = url.searchParams.get('sessionId');
            console.error(`[${new Date().toISOString()}] Message received for session: ${sessionId}`);

            if (!sessionId || !transports.has(sessionId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
                return;
            }

            const transport = transports.get(sessionId)!;

            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    await transport.handlePostMessage(req, res, body);
                } catch (error) {
                    console.error('Error handling message:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Internal server error' }));
                    }
                }
            });
            return;
        }

        // Legacy /mcp endpoint - redirect to /sse
        if (url.pathname === '/mcp' && req.method === 'GET') {
            console.error(`[${new Date().toISOString()}] Redirecting /mcp to /sse`);

            const transport = new SSEServerTransport('/message', res);
            const sessionId = transport.sessionId;
            transports.set(sessionId, transport);

            res.on('close', () => {
                transports.delete(sessionId);
            });

            const server = createServer();
            await server.connect(transport);
            return;
        }

        // 404 for unknown routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.error(`\n🚀 CloudCost Intelligence MCP v1.0.0`);
        console.error(`📊 Loaded ${toolCount} intelligent cost tools`);
        console.error(`🌐 HTTP server running on http://0.0.0.0:${PORT}`);
        console.error(`\nEndpoints:`);
        console.error(`  GET  /        - API info`);
        console.error(`  GET  /health  - Health check`);
        console.error(`  GET  /sse     - MCP SSE connection`);
        console.error(`  POST /message - MCP message handler`);
        console.error(`\n✅ Ready for connections`);
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
