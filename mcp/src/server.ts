import 'dotenv/config'; 
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import {validateJWT} from "../authentication/src/verify_jwt"


import { listServicesTool, getServiceHealthTool,  getTracesTool } from "./tools/index";







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
  getServiceHealthTool.name,
  {
    title: "Check a Services' Health",
    description: getServiceHealthTool.description,
    inputSchema: getServiceHealthTool.inputSchema,
    outputSchema: getServiceHealthTool.outputSchema,
  },
  getServiceHealthTool.handler
);

server.registerTool(
  getTracesTool.name, 
{
  title: "Get Trace Data",
  description: getTracesTool.description, 
  inputSchema: getTracesTool.inputSchema, 
  outputSchema: getTracesTool.outputSchema
}, 
getTracesTool.handler
)

// HTTP transport
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});



app.get("/mcp", validateJWT, async (request, response) => {
  console.log(' SSE connection authenticated:', request.jwtPayload?.sub);
  
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  
  response.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(request, response, request.body);
});



app.post("/mcp", validateJWT, async (request, response) => {
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
    console.log("JWT authentication enabled. ")
  })
  .on("error", (err) => {
    console.error("server error:", err);
    process.exit(1);
  });