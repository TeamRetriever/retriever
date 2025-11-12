"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const zod_1 = __importDefault(require("zod"));
// initialize the server
const server = new mcp_js_1.McpServer({
    name: "retriever-mcp",
    version: "0.0.1",
});
server.registerTool("list_services", {
    title: "Traced Microservices",
    description: "Get a list of all microservices with spans logged in Jaeger",
    inputSchema: {},
    outputSchema: { result: zod_1.default.array(zod_1.default.string()) },
}, async () => {
    const url = process.env.URL;
    if (!url) {
        throw new Error("No URL environmental variable defined!");
    }
    console.log(`beginning query to ${url}`);
    const output = await fetch(url);
    let traceList = await output.json();
    console.log(traceList.services);
    return {
        content: [{ type: "text", text: JSON.stringify(traceList.services) }],
        structuredContent: { result: traceList.services },
    };
});
// HTTP transport
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post("/mcp", async (request, response) => {
    try {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        response.on("close", () => {
            transport.close();
        });
        await server.connect(transport);
        await transport.handleRequest(request, response, request.body);
    }
    catch (error) {
        console.error("MCP request error:", error);
        response.status(500).json({ error: "MCP server error" });
    }
});
// port management
const port = parseInt(process.env.PORT || "3000");
app
    .listen(port, () => {
    console.log(`Server started on port ${port}/mcp`);
})
    .on("error", (err) => {
    console.error("server error:", err);
    process.exit(1);
});
