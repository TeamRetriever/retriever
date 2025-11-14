import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { ServiceErrorResult, JaegerOTLPResponse, OTLPAttribute,  ExtractedErrors, ErrorSummary, AllServicesResult, JaegerServicesResponse  } from "../types/types";


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



  async function searchAllServices(
    jaegerUrl: string,
    startTime: Date,
    endTime: Date,
    limit: number
): Promise<{
    content: TextContent[];
    structuredContent: { result: AllServicesResult };
}> {
    const servicesResponse = await fetch(`${jaegerUrl}/api/v3/services`);
    
    if (!servicesResponse.ok) {
        throw new Error(`Failed to fetch services: ${servicesResponse.status}`);
    }
    
    const servicesData: JaegerServicesResponse = await servicesResponse.json();
    const services = servicesData.services || [];

    const allErrors: ServiceErrorResult[] = [];

    for (const service of services) {
        try {
            const queryParams = new URLSearchParams({
                "query.service_name": service,
                "query.start_time_min": startTime.toISOString(),
                "query.start_time_max": endTime.toISOString(),
                "query.attributes.error": "true",
                "query.search_depth": limit.toString(),
            });

            const response = await fetch(`${jaegerUrl}/api/v3/traces?${queryParams}`);
            if (!response.ok) continue;

            const data: JaegerOTLPResponse = await response.json();
            
            // Check if the API response contains any trace data before processing
            // First check: data.result?.resourceSpans?.length - safely verify the array exists
            // Second check: data.result.resourceSpans.length > 0 - confirm it's not empty
            if (data.result?.resourceSpans?.length && data.result.resourceSpans.length > 0) {
                const summary = extractErrorSummary(data, limit);
                
                // Only add to results if we actually found errors
                if (summary.errorsFound > 0) {
                    allErrors.push({
                        service,
                        error_count: summary.errorsFound,
                        errors: summary.errors,  // Now typed ErrorSummary[] instead of raw data
                    });
                }
            }
        } catch (error) {
            console.error(`Error querying ${service}:`, error);
            // Continue to next service rather than failing completely
        }
    }

    const result: AllServicesResult = {
        summary: { 
            total: services.length, 
            with_errors: allErrors.length 
        },
        errors_by_service: allErrors
    };

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

// Main function: extracts compact error summaries from raw Jaeger trace data
// Converts massive nested trace structures into lightweight error reports
// Params:
//   - data: Full OTLP response from Jaeger API containing all trace spans
//   - limit: Maximum number of error summaries to extract (stops early to control size)
// Returns: Object with metadata (traces searched, errors found) and array of error summaries
 function extractErrorSummary(data: JaegerOTLPResponse, limit: number): ExtractedErrors {
    // Direct access to resourceSpans array (required field in OTLP)
    const traces = data.result.resourceSpans; 

    // Accumulator array for error summaries we extract
    const errorSummaries: ErrorSummary[] = [];
    
    // Counter to enforce the limit and enable early termination
    let count = 0;
    
    // LAYER 1: Loop through ResourceSpans (one per service/host)
    for (const resourceSpan of traces) {
        if (count >= limit) break; 
        
        // Extract service name from resource attributes (e.g., "frontend", "payment-service")
        const serviceAttr = findAttribute(resourceSpan.resource.attributes, 'service.name');
        const serviceName = serviceAttr?.value?.stringValue || 'unknown';
        
        // LAYER 2: Loop through ScopeSpans (instrumentation library groupings)
        // This layer exists for OTLP structure but isn't particularly useful for analysis
        for (const scopeSpan of resourceSpan.scopeSpans) {
            if (count >= limit) break;
            
            // LAYER 3: Loop through Spans (actual operations - this is where errors live)
            for (const span of scopeSpan.spans) {
                if (count >= limit) break;
                
                // ERROR DETECTION: Check two ways a span can indicate an error
                const hasErrorStatus = span.status?.code === 2; // OTLP status code 2 = ERROR
                const errorAttr = span.attributes ? findAttribute(span.attributes, 'error') : undefined;
                const hasErrorAttribute = errorAttr?.value?.boolValue === true; // Some libs use error: true attribute
                
                // Process this span only if it's marked as an error
                if (hasErrorStatus || hasErrorAttribute) {
                    // DURATION CALCULATION: Convert nanoseconds to milliseconds for readability
                    // Formula: (endTime - startTime) / 1,000,000 = milliseconds
                    const duration = span.endTimeUnixNano 
                        ? `${(Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano)) / 1000000}ms`
                        : 'unknown'; // Some spans may not have endTime if they crashed
                    
                    // TAG EXTRACTION: Build object with only error-related and HTTP-related tags
                    // This filters out irrelevant tags (thread.id, peer.service, etc.) to reduce size
                    const tags: Record<string, string | number | boolean> = {};
                    span.attributes?.forEach(attr => {
                        // Only keep tags starting with "error." or "http."
                        if (attr.key.startsWith('error.') || attr.key.startsWith('http.')) {
                            const value = getAttributeValue(attr);
                            if (value !== undefined) {
                                tags[attr.key] = value; // e.g., { "error.type": "SQLException", "http.status_code": 500 }
                            }
                        }
                    });
                    
                    // SPECIFIC ATTRIBUTE EXTRACTION: Pull out commonly-needed fields for top-level access
                    // These also exist in tags, but having them at the top level makes them easier to access
                    const errorTypeAttr = span.attributes ? findAttribute(span.attributes, 'error.type') : undefined;
                    const httpStatusAttr = span.attributes ? findAttribute(span.attributes, 'http.status_code') : undefined;
                    
                    // BUILD ERROR SUMMARY: Construct compact representation with only essential debugging info
                    const errorInfo: ErrorSummary = {
                        traceId: span.traceId,              // Links to full distributed trace
                        spanId: span.spanId,                // Unique ID for this specific operation
                        service: serviceName,               // Which service errored
                        operation: span.name,               // What it was doing when it failed
                        startTime: span.startTimeUnixNano,  // When the error occurred
                        duration,                           // How long before failure
                        errorMessage: span.status?.message || 'No error message', // Human-readable error
                        errorType: errorTypeAttr?.value?.stringValue,    // Error classification (optional)
                        httpStatusCode: httpStatusAttr?.value?.intValue, // HTTP status (optional)
                        tags,                               // Filtered error/HTTP tags

                        // LOG EXTRACTION: Include up to 3 most recent log entries with up to 5 attributes each
                        // This provides exception stack traces and error context without overwhelming the payload
                        logs: span.events?.slice(0, 3).map(event => ({
                            timestamp: event.timeUnixNano,
                            name: event.name,
                            attributes: event.attributes?.slice(0, 5) // Limit prevents huge log dumps
                        }))
                    };
                    
                    // Add this error to our collection and increment counter
                    errorSummaries.push(errorInfo);
                    count++;
                }
            }
        }
    }
    
    // Return summary with metadata about the search and all extracted errors
    return {
        totalTracesSearched: traces.length,    // How many traces we examined
        errorsFound: errorSummaries.length,    // How many contained errors
        errors: errorSummaries                 // The actual error details
    };
}


export {parseLookback, searchAllServices, extractErrorSummary}