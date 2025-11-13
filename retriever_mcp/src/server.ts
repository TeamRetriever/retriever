import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { listServicesTool, getTraceSampleTool } from "./tools/index";

// initialize the server
const server = new McpServer({
  name: "retriever-mcp",
  version: "0.0.1",
});

// Register tools
server.registerTool(
  listServicesTool.name,
  {
    title: "Traced Microservices",
    description: listServicesTool.description,
    inputSchema: listServicesTool.inputSchema,
    outputSchema: listServicesTool.outputSchema,
  },
  listServicesTool.handler // handler is in place of tool functionality before. This handler is a property where the respective tool function lives 
);

server.registerTool(
  getTraceSampleTool.name,
  {
    title: "Get Sample Trace",
    description: getTraceSampleTool.description,
    inputSchema: getTraceSampleTool.inputSchema,
    outputSchema: getTraceSampleTool.outputSchema,
  },
  getTraceSampleTool.handler
);

// HTTP transport
const app = express();
app.use(express.json());

app.post("/mcp", async (request, response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on("close", () => {
      transport.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
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