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
    const jaegerUrl = process.env.URL;

    if (!jaegerUrl) {
      throw new Error("No URL environmental variable defined!");
    }

    

    // Build traces URL
    const tracesUrl = `${jaegerUrl}/api/v3/traces?query.service_name=${serviceName}&query.start_time_min=${startTimeMin}&query.start_time_max=${startTimeMax}`;

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
      content: [textContent], 
      structuredContent: {result: data}
    };
  },
};

