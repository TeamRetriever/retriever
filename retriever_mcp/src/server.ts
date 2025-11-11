import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import z from "zod";

// initialize the server
const server = new McpServer({
  name: "retriever-mcp",
  version: "0.0.1",
});

server.registerTool(
  "list_services",
  {
    title: "Traced Microservices",
    description: "Get a list of all microservices with spans logged in Jaeger",
    inputSchema: {},
    outputSchema: { result: z.array(z.string()) },
  },
  async () => {
    const url = process.env.URL;

    if (!url) {
      throw new Error("No URL environmental variable defined!");
    }

    console.log(`beginning query to ${url}`);
    const output = await fetch(url);
    let traceList: { services: Array<String> } = await output.json();

    console.log(traceList.services);

    return {
      content: [{ type: "text", text: JSON.stringify(traceList.services) }],
      structuredContent: { result: traceList.services },
    };
  },
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
