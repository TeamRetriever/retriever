import z from "zod";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { parseLookback, getAllServicesTraceSummary, extractTraceSummary, getFilterFunction } from "../utils/toolHelpers"
import { JaegerOTLPResponse, OTLPSpan } from "../types/types";

export const getTracesTool = {
    name: "get_traces", 
    description: 'Get traces for a service with optional filtering by status. Use list_services first to see available services. Use service="all" to search all services (this will take longer).',
    inputSchema: {
        service: z.string().describe('Service name to query for traces'), 
        limit: z.number().optional().default(5).describe('Maximum number of traces to return'), 
        lookback: z.string().optional().default("1h").describe('Time range such as "1h", "30m", "2d"'), 
        operation: z.string().optional().describe('Optional operation name to filter'), 
        min_duration: z.string().optional().describe('Minimum duration like "10ms", "100ms"'),
        filter: z.enum(['all', 'errors', 'successful']).optional().default('all').describe('Filter traces by status: "all" (default), "errors" only, or "successful" only'),
    }, 
    outputSchema: {result: z.any()},

    handler: async (params: {
        service: string;
        limit?: number; 
        lookback?: string; 
        operation?: string; 
        min_duration?: string;
        filter?: 'all' | 'errors' | 'successful';
    }) => {
        const jaegerUrl = process.env.URL; 

        if (!jaegerUrl) {
            throw new Error('No URL environment variable defined'); 
        }

        // Calculate time ranges 
        const endTime = new Date(); 
        const startTime = new Date(endTime.getTime() - parseLookback(params.lookback || "1h"))

        // Search all services with the specified filter
        if (params.service === "all") {
            return await getAllServicesTraceSummary(
                jaegerUrl, 
                startTime, 
                endTime, 
                params.limit || 5, 
                params.filter || 'all'
            );
        }

        // Build query params for single service using Jaeger's /api/v3 endpoint
        // URLSearchParams takes an object and converts all values to strings
        const queryParams = new URLSearchParams({
            'query.service_name': params.service, 
            'query.start_time_min': startTime.toISOString(), // ISO 8601 format: 2025-01-15T10:00:00.000Z
            'query.start_time_max': endTime.toISOString(),
            'query.search_depth': (params.limit || 10).toString(), 
        }); 

        // Add server-side error filter if specifically requesting errors
        // This makes Jaeger filter at the source, reducing data transfer
        if (params.filter === 'errors') {
            queryParams.append('query.attributes.error', 'true');
        }

        // Add optional filters if specified
        if (params.operation) queryParams.append("query.operation_name", params.operation);
        if (params.min_duration) queryParams.append("query.duration_min", params.min_duration);

        const tracesUrl = `${jaegerUrl}/api/v3/traces?${queryParams}`;
        console.log(`Fetching traces from ${tracesUrl}`); 

        const response = await fetch(tracesUrl); 

        if (!response.ok) {
            throw new Error(`Jaeger API returned ${response.status}: ${response.statusText}`);
        }

        const data: JaegerOTLPResponse = await response.json(); 
        
        // Apply client-side filter based on the filter parameter
       const filterFn = getFilterFunction(params.filter || 'all')
        
        // Extract trace summaries - data is significantly reduced to key information
        // Uses refactored helper functions to build compact trace summaries
        const summary = extractTraceSummary(data, params.limit || 5, filterFn);

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