import {nanoToISOString} from "../shared/time"
import {extractRelevantTags, findAttribute} from "../jaeger/spanAttributes"
import type { OTLPSpan, TraceSummary, OTLPResourceSpan, JaegerOTLPResponse, ExtractedTraces} from "../../../types/jaeger";

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
    //const startTime = nanoToISOString(span.startTimeUnixNano);
    const startTime = nanoToISOString(span.startTimeUnixNano)

    // Extract commonly-needed attributes for top-level access
    const errorTypeAttr = span.attributes ? findAttribute(span.attributes, 'error.type') : undefined;
    const httpStatusAttr = span.attributes ? findAttribute(span.attributes, 'http.status_code') : undefined;
    
    return {
        traceId: span.traceId,
        spanId: span.spanId,
        service: serviceName,
        operation: span.name,
        startTime, 
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

export  {buildTraceSummary, extractTraceSummary}