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


server.registerTool(
  'get_trace_sample', 
  {
      title: 'Get Sample Trace', 
      description: "Get a sample trace with full structure for debugging", 
      inputSchema: {
          service: z.string().optional().describe('Service name to get traces from (optional, defaults to first available service)'),
          lookback: z.string().optional().describe('Time range to look back (e.g., "1h", "30m", "2d"). Default: "1h"')
      }, 
      outputSchema: {result: z.any()}
  }, 
  async (params: { service?: string, lookback?: string }) => {
      const baseUrl = process.env.URL;
      
      if (!baseUrl) {
          throw new Error("No URL environmental variable defined!");
      }
      
      // Extract base URL (remove /api/v3/services)
      const jaegerBaseUrl = baseUrl.replace('/api/v3/services', '');
      
      // If no service specified, get the first available service
      let serviceName = params.service;
      if (!serviceName) {
          console.log('No service specified, fetching first available service...');
          const servicesResponse = await fetch(baseUrl);
          const servicesData: { services: string[] } = await servicesResponse.json();
          serviceName = servicesData.services[0];
          console.log(`Using service: ${serviceName}`);
      }
      
      // Use lookback parameter (default to 1 hour)
      const lookback = params.lookback || '1h';
      
      // Build traces URL using the legacy API that works
      const tracesUrl = `${jaegerBaseUrl}/api/traces?service=${serviceName}&lookback=${lookback}&limit=1`;
      
      console.log(`Fetching sample trace from: ${tracesUrl}`);
      
      // Fetch raw data from Jaeger 
      const response = await fetch(tracesUrl); 
      const data = await response.json(); 

      // Log it - shows in docker logs 
      console.log('=== Trace Structure ===');
      console.log(JSON.stringify(data, null, 2)); 
      console.log("=======================");

      // Return it so mcp client can see it 
      return {
          content: [{type: 'text', text: JSON.stringify(data, null, 2)}], 
          structuredContent: {result: data}
      };
  }
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
