
import { getFilterFunction } from "./spanFilters";
import { extractTraceSummary } from "./spanExtraction";
import type { AllServicesResult, JaegerServicesResponse, ServiceTraceResult, JaegerOTLPResponse } from "../../../types/jaeger";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
// Search all services with optional filtering
async function getAllServicesTraceSummary(
    jaegerUrl: string,
    startTime: Date,
    endTime: Date,
    limit: number,
    filter: 'all' | 'errors' | 'successful' = 'all'
): Promise<{
    content: TextContent[];
    structuredContent: { result: AllServicesResult };
}> {
    // Fetch list of all services from Jaeger
    const servicesResponse = await fetch(`${jaegerUrl}/api/v3/services`);
    
    if (!servicesResponse.ok) {
        throw new Error(`Failed to fetch services: ${servicesResponse.status}`);
    }
    
    const servicesData: JaegerServicesResponse = await servicesResponse.json();
    const services = servicesData.services || [];

    const allTraces: ServiceTraceResult[] = [];

    
    for (const service of services) {
        try {
           
            const queryParams = new URLSearchParams({
                "query.service_name": service,
                "query.start_time_min": startTime.toISOString(),
                "query.start_time_max": endTime.toISOString(),
                "query.search_depth": limit.toString(),
            });

            // Add server-side error filter if specifically requesting errors
            // This reduces data transfer by having Jaeger filter at the source
            if (filter === 'errors') {
                queryParams.append("query.attributes.error", "true");
            }

            // Fetch traces for this service
            const response = await fetch(`${jaegerUrl}/api/v3/traces?${queryParams}`);
            if (!response.ok) continue; // Skip services that error out

            const data: JaegerOTLPResponse = await response.json();
            
            // Process traces if we got any data back
            if (data.result?.resourceSpans?.length && data.result.resourceSpans.length > 0) {
                // Determine which filter function to apply based on filter parameter
                const filterFn = getFilterFunction(filter);
                
                // Extract trace summaries using our refactored function
                const summary = extractTraceSummary(data, limit, filterFn);
                
                // Only add to results if we actually found matching traces
                if (summary.tracesFound > 0) {
                    allTraces.push({
                        service,
                        trace_count: summary.tracesFound,
                        traces: summary.traces,
                    });
                }
            }
        } catch (error) {
            // Log error but continue processing other services
            console.error(`Error querying ${service}:`, error);
        }
    }

    // Build final result with summary statistics
    const result: AllServicesResult = {
        summary: { 
            total: services.length,           // Total services checked
            with_traces: allTraces.length     // Services that had matching traces
        },
        traces_by_service: allTraces
    };

    // Format for MCP response
    const textContent: TextContent = {
        type: "text",
        text: JSON.stringify(result, null, 2)
    };

    return {
        content: [textContent],
        structuredContent: { result }
    };
}

