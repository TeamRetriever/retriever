import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { trace } from 'console';
import express from 'express';
import { z } from 'zod';

// Create an MCP server
const server = new McpServer({
    name: 'jaeger-mcp-test',
    version: '0.0.1'
});

// Add an addition tool
server.registerTool(
    'list services',
    {
        title: 'Traced Microservices',
        description: 'Get a list of all microservices with spans logged in Jaeger',
        inputSchema: {},
        outputSchema: { result: z.array(z.string()) }
    },
    async () => {
        const url = process.env.URL

        if (!url) {
          throw new Error("No URL environmental variable defined!")
        }

        console.log(`beginning query to ${url}`)
        const output = await fetch(url)
        let traceList: { services: Array<String> } = await output.json()

        console.log(traceList.services)

        // if (!Array.isArray(traceList)) {
        //   traceList = []
        // }

        return {
            content: [{ type: 'text', text: JSON.stringify(traceList.services) }],
            structuredContent: { result: traceList.services }
        };
    }
);

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
    console.log(`target fetch URL set to ${process.env.URL}`)
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});