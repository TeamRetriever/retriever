import { z } from "zod";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";

export const getTraceSampleTool = {
  name: "get_trace_sample",
  description: "Get a sample trace with full structure for debugging",
  inputSchema: {
    service: z
      .string()
      .optional()
      .describe(
        "Service name to get traces from (optional, defaults to first available service)"
      ),
    lookback: z
      .string()
      .optional()
      .describe('Time range to look back (e.g., "1h", "30m", "2d"). Default: "1h"'),
  },
  outputSchema: { result: z.any() },
  handler: async (params: { service?: string; lookback?: string }) => {
    const baseUrl = process.env.URL;

    if (!baseUrl) {
      throw new Error("No URL environmental variable defined!");
    }

    // Extract base URL (remove /api/v3/services)
    const jaegerBaseUrl = baseUrl.replace("/api/v3/services", "");

    // If no service specified, get the first available service
    let serviceName = params.service;
    if (!serviceName) {
      console.log("No service specified, fetching first available service...");
      const servicesResponse = await fetch(baseUrl);
      const servicesData: { services: string[] } = await servicesResponse.json();
      serviceName = servicesData.services[0];
      console.log(`Using service: ${serviceName}`);
    }

    // Use lookback parameter (default to 1 hour)
    const lookback = params.lookback || "1h";

    // Build traces URL using the legacy API that works
    const tracesUrl = `${jaegerBaseUrl}/api/traces?service=${serviceName}&lookback=${lookback}&limit=1`;

    console.log(`Fetching sample trace from: ${tracesUrl}`);

    // Fetch raw data from Jaeger
    const response = await fetch(tracesUrl);
    const data = await response.json();

    // Log it - shows in docker logs
    console.log("=== Trace Structure ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("=======================");

    // TextContent is specified in the SDK docs to take a string literal 'text' for type and then just string for the text 
    const textContent: TextContent = {
        type: 'text', 
        text: JSON.stringify(data, null, 2)
    }

    // Return it so mcp client can see it
    return {
      content: [textContent]
    };
  },
};

