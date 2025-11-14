import z from "zod";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import {parseLookback, searchAllServices, extractErrorSummary} from "../utils/toolHelpers"
import { JaegerOTLPResponse } from "../types/types";

export const getErrorsTool = {
    name: "get_errors", 
    description: 'Get error traces for a service. Use list_services first to see available services. Use service="all" to search all services. Warn that using all will take a bit longer',
    inputSchema: {
        service: z.string().describe('Service name to query for errors'), 
        limit: z.number().optional().default(5).describe('Maximum number of error traces to return'), 
        lookback :z.string().optional().default("1h").describe('Time range such as "1h", "30m", "2d"'), 
        operation:z.string().optional().describe('Optional operation name to filter'), 
        min_duration:z.string().optional().describe('Minimum duration like "10ms", "100ms"'), 

    }, 
    outputSchema: {result: z.any()}, 

    handler: async (params: {
        service: string;
        limit?: number; 
        lookback?: string; 
        operation?: string; 
        min_duration?: string; 
    }) => {
        const jaegerUrl = process.env.URL; 

        if (!jaegerUrl) {
            throw new Error ('No URL environment variable defined'); 
        }

        // calculate time ranges 
        const endTime = new Date(); 
        // getTime will convert Date to ms 
        const startTime = new Date(endTime.getTime() -parseLookback(params.lookback || "1h" ) )


    // Search all services
    if (params.service === "all") {
        return await searchAllServices(jaegerUrl, startTime, endTime, params.limit || 5);
      }
  

        // build query params. Here is where we utilize /api/v3 
        

        // URLSearchParams here takes an object and all values will either be a string or be converted to string. 
        // 
        const queryParams = new URLSearchParams({
            'query.service_name': params.service, 
            'query.start_time_min': startTime.toISOString(), // Jaeger expects ISO 8601 format so this will convert to that
            'query.start_time_max': endTime.toISOString(), // e.g. 2025-01-15T10:00:00.000Z"
            'query.attributes.error': 'true', 
            'query.search_depth': (params.limit || 10).toString(), 
        }); 

        // example of what queryParams would look like 
        // query.service_name=frontend&query.start_time_min=2025-01-15T14:00:00.000Z&query.start_time_max=2025-01-15T15:00:00.000Z&query.attributes.error=true&query.search_depth=1

        // if params.operation is specified then it will be added to the built out params query 
        if (params.operation) queryParams.append("query.operation_name", params.operation);
        if (params.min_duration) queryParams.append("query.duration_min", params.min_duration);
    

        const tracesUrl = `${jaegerUrl}/api/v3/traces?${queryParams}`;

        console.log(`Fetching errors from ${tracesUrl}`); 

        const response = await fetch(tracesUrl); 

        if (!response.ok) {
            throw new Error(`Jaeger API returned ${response.status}: ${response.statusText}`);
        }

        const data: JaegerOTLPResponse= await response.json(); 
        
        // data is significantly chopped down and key information related to each span's error are captured to make data collected much smaller. 
        const summary = extractErrorSummary(data, params.limit || 5)

        const textContent: TextContent = {
            type: 'text', 
            text: JSON.stringify(summary, null, 2), 
        };  

        return {
            content: [textContent], 
            structuredContent: {result: summary}
        };  
    }  
}; 
