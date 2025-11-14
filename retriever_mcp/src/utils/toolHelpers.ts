import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { ServiceTraceResult, JaegerOTLPResponse, OTLPAttribute,  ExtractedTraces, TraceSummary, AllServicesResult, JaegerServicesResponse, OTLPSpan, OTLPResourceSpan  } from "../types/types";


// get_errors tool helpers // 

// convert lookback time to match jaeger ms format 
function parseLookback(lookback: string): number {
    const match = lookback.match(/^(\d+)(h|m|d|s)$/);
    if (!match) {
      throw new Error(`Invalid lookback format: ${lookback}`);
    }
  
    const value = parseInt(match[1]);
    const unit = match[2];
  
    const multipliers: { [key: string]: number } = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
    };
  
    return value * multipliers[unit];
  }

  // FILTER FUNCTIONS: Reusable predicates for different trace types

// Filter for error spans only
function isErrorSpan(span: OTLPSpan): boolean {
    const hasErrorStatus = span.status?.code === 2; // OTLP status code 2 = ERROR
    const errorAttr = span.attributes ? findAttribute(span.attributes, 'error') : undefined;
    const hasErrorAttribute = errorAttr?.value?.boolValue === true; // Some libs use error: true attribute
    return hasErrorStatus || hasErrorAttribute;
}

// Filter for successful spans only
function isSuccessfulSpan(span: OTLPSpan): boolean {
    return !isErrorSpan(span);
}

  

  function getFilterFunction(filter: 'all' | 'errors' | 'successful'): ((span: OTLPSpan) => boolean) | undefined {
    switch (filter) {
        case 'errors':
            return isErrorSpan;
        case 'successful':
            return isSuccessfulSpan;
        case 'all':
        default:
            return undefined; // No filter - include all spans
    }
}


// Search all services with optional filtering
async function searchAllServices(
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



// Extracts the actual value from an OTLP attribute's variant type
// Since Jaeger key values will always only have 1 property populated, this function returns the one true value
// Returns undefined if no value is present
function getAttributeValue(attr: OTLPAttribute): string | number | boolean | undefined {
    if (!attr.value) return undefined;
    
    return attr.value.stringValue ?? 
           attr.value.intValue ?? 
           attr.value.boolValue ?? 
           attr.value.doubleValue;
}

// Searches an array of attributes for one with a specific key name
// Returns the matching attribute or undefined if not found
function findAttribute(attributes: OTLPAttribute[] | undefined, key: string): OTLPAttribute | undefined {
    return attributes?.find(attr => attr.key === key);
}




// Calculates span duration in milliseconds from nanosecond timestamps
function calculateDuration(span: OTLPSpan): string {
    if (!span.endTimeUnixNano) {
        return 'unknown'; // Span didn't finish (crashed or still running)
    }
    const durationMs = (Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano)) / 1000000;
    return `${durationMs}ms`;
}

// Determines the status of a span (ok, error, or unset)
function getSpanStatus(span: OTLPSpan): 'ok' | 'error' | 'unset' {
    if (span.status?.code === 1) return 'ok';
    if (span.status?.code === 2) return 'error';
    return 'unset';
}

// Extracts relevant tags from span attributes
// Filters to keep only error.*, http.*, db.*, rpc.*, messaging.* tags
function extractRelevantTags(span: OTLPSpan): Record<string, string | number | boolean> {
    const tags: Record<string, string | number | boolean> = {};
    
    if (!span.attributes) {
        return tags;
    }
    
    for (const attr of span.attributes) {
        // Only keep tags that are useful for debugging and analysis
        const isRelevant = attr.key.startsWith('error.') || 
                          attr.key.startsWith('http.') ||
                          attr.key.startsWith('db.') ||
                          attr.key.startsWith('rpc.') ||
                          attr.key.startsWith('messaging.');
        
        if (isRelevant) {
            const value = getAttributeValue(attr);
            if (value !== undefined) {
                tags[attr.key] = value;
            }
        }
    }
    
    return tags;
}

// Extracts log entries/events from a span
// Limits to first 3 events with max 5 attributes each to prevent huge payloads
function extractSpanLogs(span: OTLPSpan): TraceSummary['logs'] {
    if (!span.events || span.events.length === 0) {
        return undefined;
    }
    
    return span.events.slice(0, 3).map(event => ({
        timestamp: event.timeUnixNano,
        name: event.name,
        attributes: event.attributes?.slice(0, 5)
    }));
}

// Builds a complete TraceSummary object from a span
function buildTraceSummary(span: OTLPSpan, serviceName: string): TraceSummary {
    const status = getSpanStatus(span);
    const duration = calculateDuration(span);
    const tags = extractRelevantTags(span);
    
    // Extract commonly-needed attributes for top-level access
    const errorTypeAttr = span.attributes ? findAttribute(span.attributes, 'error.type') : undefined;
    const httpStatusAttr = span.attributes ? findAttribute(span.attributes, 'http.status_code') : undefined;
    
    return {
        traceId: span.traceId,
        spanId: span.spanId,
        service: serviceName,
        operation: span.name,
        startTime: span.startTimeUnixNano,
        duration,
        status,
        errorMessage: status === 'error' ? (span.status?.message || 'No error message') : undefined,
        errorType: errorTypeAttr?.value?.stringValue,
        httpStatusCode: httpStatusAttr?.value?.intValue,
        tags,
        logs: extractSpanLogs(span)
    };
}

// Processes a single ResourceSpan and extracts matching traces
function processResourceSpan(
    resourceSpan: OTLPResourceSpan,
    limit: number,
    currentCount: number,
    filterFn?: (span: OTLPSpan) => boolean
): { summaries: TraceSummary[]; newCount: number } {
    const summaries: TraceSummary[] = [];
    let count = currentCount;
    
    // Extract service name from resource attributes
    const serviceAttr = findAttribute(resourceSpan.resource.attributes, 'service.name');
    const serviceName = serviceAttr?.value?.stringValue || 'unknown';
    
    // Loop through scope spans (instrumentation library groupings)
    for (const scopeSpan of resourceSpan.scopeSpans) {
        if (count >= limit) break;
        
        // Loop through actual spans (operations)
        for (const span of scopeSpan.spans) {
            if (count >= limit) break;
            
            // Apply filter if provided
            if (filterFn && !filterFn(span)) {
                continue; // Skip spans that don't match filter
            }
            
            // Build the trace summary
            const traceSummary = buildTraceSummary(span, serviceName);
            summaries.push(traceSummary);
            count++;
        }
    }
    
    return { summaries, newCount: count };
}

// Main extraction function - now much simpler!
// Converts massive nested trace structures into lightweight reports
// Params:
//   - data: Full OTLP response from Jaeger API containing all trace spans
//   - limit: Maximum number of trace summaries to extract (stops early to control size)
//   - filterFn: Optional filter function to select specific spans (errors, successful, etc.)
// Returns: Object with metadata (traces searched, traces found) and array of trace summaries
function extractTraceSummary(
    data: JaegerOTLPResponse, 
    limit: number,
    filterFn?: (span: OTLPSpan) => boolean
): ExtractedTraces {
    const resourceSpans = data.result.resourceSpans;
    const allSummaries: TraceSummary[] = [];
    let count = 0;
    
    // Process each resource span (one per service/host)
    for (const resourceSpan of resourceSpans) {
        if (count >= limit) break;
        
        const { summaries, newCount } = processResourceSpan(
            resourceSpan, 
            limit, 
            count, 
            filterFn
        );
        
        allSummaries.push(...summaries);
        count = newCount;
    }
    
    return {
        totalTracesSearched: resourceSpans.length,
        tracesFound: allSummaries.length,
        traces: allSummaries
    };
}

export {parseLookback, searchAllServices, extractTraceSummary, isErrorSpan, isSuccessfulSpan}