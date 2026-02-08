#!/usr/bin/env node
/**
 * CloudCost Intelligence MCP Server (Streamable HTTP + SSE)
 * Production-ready for CTX Protocol + Inspector
 */

import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer as createMCPServer, toolCount } from "./server.js";
import { createContextMiddleware } from "@ctxprotocol/sdk/express";

const app = express();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MODE = process.env.MCP_MODE || "http"; // 'stdio' or 'http'

app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
});

/**
 * Health Check
 */
app.get("/health", (_req: Request, res: Response) => {
    res.json({
        status: "healthy",
        service: "cloudcost-mcp",
        version: "1.0.0",
        tools: toolCount,
        timestamp: new Date().toISOString(),
    });
});

/**
 * API Info
 */
app.get("/", (_req: Request, res: Response) => {
    res.json({
        name: "CloudCost Intelligence MCP",
        version: "1.0.0",
        description: "AI-native cost intelligence for cloud, AI models, and SaaS",
        toolCount,
        endpoints: {
            health: "GET /health",
            mcp: "POST /mcp (StreamableHTTP) or GET /mcp (SSE)",
            sse: "GET /sse",
            messages: "POST /messages",
        },
    });
});

/**
 * Create Streamable HTTP Transport
 */
const streamableTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
});

/**
 * SSE Transport - Map of session ID to transport
 */
const sseTransports = new Map<string, SSEServerTransport>();

/**
 * Create main MCP Server and connect to Streamable transport
 */
const mcpServer = createMCPServer();

app.use("/mcp", createContextMiddleware());

/**
 * Mount /mcp endpoint with auto-transport detection
 */
app.all("/mcp", async (req: Request, res: Response) => {
    const acceptHeader = req.headers.accept || "";
    const isSSERequest = req.method === "GET" && acceptHeader.includes("text/event-stream");

    if (isSSERequest) {
        // SSE transport for MCP Inspector
        console.log(`[${new Date().toISOString()}] SSE connection on /mcp`);
        const sseTransport = new SSEServerTransport("/messages", res);
        const sessionId = sseTransport.sessionId;
        sseTransports.set(sessionId, sseTransport);

        const sseServer = createMCPServer();

        res.on("close", () => {
            console.log(`[${new Date().toISOString()}] SSE session ${sessionId} closed`);
            sseTransports.delete(sessionId);
        });

        try {
            await sseServer.connect(sseTransport);
            console.log(`[${new Date().toISOString()}] SSE session ${sessionId} connected`);
        } catch (error) {
            console.error("SSE connection error:", error);
            sseTransports.delete(sessionId);
        }
    } else {
        // StreamableHTTP for production clients
        await streamableTransport.handleRequest(req, res);
    }
});

/**
 * SSE endpoint - GET /sse for SSE connections (Inspector compatible)
 */
app.get("/sse", async (req: Request, res: Response) => {
    console.log(`[${new Date().toISOString()}] New SSE connection on /sse`);
    const sseTransport = new SSEServerTransport("/messages", res);
    const sessionId = sseTransport.sessionId;
    sseTransports.set(sessionId, sseTransport);

    const sseServer = createMCPServer();

    res.on("close", () => {
        console.log(`[${new Date().toISOString()}] SSE session ${sessionId} closed`);
        sseTransports.delete(sessionId);
    });

    try {
        await sseServer.connect(sseTransport);
        console.log(`[${new Date().toISOString()}] SSE session ${sessionId} connected`);
    } catch (error) {
        console.error("SSE connection error:", error);
        sseTransports.delete(sessionId);
    }
});

/**
 * SSE message endpoint - POST /messages for SSE messages
 */
app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    console.log(`[${new Date().toISOString()}] POST /messages for session: ${sessionId}`);

    const transport = sseTransports.get(sessionId);

    if (!transport) {
        console.error(`Session not found: ${sessionId}`);
        res.status(400).json({ error: "Invalid or expired session" });
        return;
    }

    try {
        await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
        console.error("SSE message error:", error);
        res.status(500).json({ error: "Failed to handle message" });
    }
});

/**
 * Global Error Handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
});

/**
 * Start HTTP Server
 */
async function startHttpServer() {
    try {
        // Connect MCP to Streamable HTTP transport
        await mcpServer.connect(streamableTransport);

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║       CloudCost Intelligence MCP (HTTP + SSE Ready)       ║
╠═══════════════════════════════════════════════════════════╣
║  Running on port ${PORT}                                       ║
║  StreamableHTTP: http://0.0.0.0:${PORT}/mcp                    ║
║  SSE (Inspector): http://0.0.0.0:${PORT}/sse                   ║
║  Health: http://0.0.0.0:${PORT}/health                         ║
║  Tools: ${toolCount}                                              ║
╚═══════════════════════════════════════════════════════════╝
      `);
        });
    } catch (err) {
        console.error("Failed to start MCP server:", err);
        process.exit(1);
    }
}

/**
 * Start Stdio Server (for local development)
 */
async function startStdioServer() {
    const server = createMCPServer();
    const transport = new StdioServerTransport();

    console.error(`CloudCost Intelligence MCP v1.0.0`);
    console.error(`Loaded ${toolCount} tools`);
    console.error(`Running in stdio mode`);

    await server.connect(transport);
}

/**
 * Main entry point
 */
async function main() {
    if (MODE === "stdio") {
        await startStdioServer();
    } else {
        await startHttpServer();
    }
}

main().catch((error) => {
    console.error("Failed to start CloudCost MCP:", error);
    process.exit(1);
});

export { app, mcpServer };
