import { z } from "zod";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";

export const listServicesTool = {
  name: "list_services",
  description: "Get a list of all microservices with spans logged in Jaeger",
  inputSchema: {},
  outputSchema: { result: z.array(z.string()) },
  handler: async () => {
    const url = process.env.URL;

    if (!url) {
      throw new Error("No URL environmental variable defined!");
    }

    console.log(`beginning query to ${url}`);
    const output = await fetch(url);
    const traceList: { services: Array<string> } = await output.json();

    console.log(traceList.services);

    const textContent: TextContent = {
      type: "text",
      text: JSON.stringify(traceList.services)
    };

    return {
      content: [textContent]
    };
  },
};