// Jaeger OTLP trace structure types

// Key-value pair for metadata/tags - can hold string, number, or boolean values
export interface OTLPAttribute {
    key: string; // Attribute name (e.g., "http.status_code", "error.type")
    value: {
        stringValue?: string;   // Text values (e.g., "GET", "SQLException")
        intValue?: number;      // Integer values (e.g., 500, 404)
        boolValue?: boolean;    
        doubleValue?: number;   // Decimal values (e.g., 3.14, latency percentiles)
    };
}

// A log entry or exception that occurred during a span's execution
export interface OTLPSpanEvent {
    timeUnixNano: string;        // When the event occurred (nanosecond timestamp)
    name: string;                // Event type (e.g., "exception", "log", "annotation")
    attributes?: OTLPAttribute[]; // Additional context about the event
}

// Indicates whether a span completed successfully or with an error
export interface OTLPSpanStatus {
    code: number;      // 0 = UNSET, 1 = OK, 2 = ERROR
    message?: string;  // Human-readable error description (e.g., "Database timeout")
}

// A single unit of work in a distributed trace (e.g., API call, DB query, cache lookup)
export interface OTLPSpan {
    traceId: string;              // Links all spans in one distributed request
    spanId: string;               // Unique identifier for this specific operation
    parentSpanId?: string;        // ID of the calling span (if this is a child operation)
    name: string;                 // Operation description (e.g., "GET /api/users", "SELECT FROM orders")
    startTimeUnixNano: string;    // When the operation started (nanoseconds since epoch)
    endTimeUnixNano?: string;     // When the operation completed (undefined if still running/crashed)
    attributes?: OTLPAttribute[]; // Tags describing the operation (e.g., http.method, db.statement)
    events?: OTLPSpanEvent[];     // Logs/exceptions that occurred during execution
    status?: OTLPSpanStatus;      // Success or failure indicator
}

// Groups spans by instrumentation library (not really important for us since we are set to OTLP. but is apart of how trace data is captured. )
export interface OTLPScopeSpan {
    spans: OTLPSpan[]; // Array of operation spans from the same instrumentation library
}

// Represents all spans from a single service/host in the trace
export interface OTLPResourceSpan {
    resource: {
        attributes: OTLPAttribute[]; // Service metadata (e.g., service.name, host.name, deployment.environment)
    };
    scopeSpans: OTLPScopeSpan[];    // Groups of spans organized by instrumentation library
}

// Top-level response from Jaeger's /api/v3/traces endpoint
export interface JaegerOTLPResponse {
    result: {
        resourceSpans: OTLPResourceSpan[]; // Array of traces from different services/hosts
    };
}



// Condensed representation of a single error span with only essential debugging info
export interface ErrorSummary {
    traceId: string;          // Links to full distributed trace
    spanId: string;           // Unique ID for this errored operation
    service: string;          // Which service had the error (e.g., "frontend", "payment-service")
    operation: string;        // What it was doing (e.g., "POST /checkout", "query-user-balance")
    startTime: string;        // When the error occurred (nanosecond timestamp)
    duration: string;         // How long before it failed (e.g., "250ms", "5s")
    errorMessage: string;     // Human-readable error description
    errorType?: string;       // Error classification (e.g., "SQLException", "TimeoutException")
    httpStatusCode?: number;  // HTTP status if applicable (e.g., 500, 404)
    tags: Record<string, string | number | boolean>; // All error.* and http.* attributes
    logs?: Array<{            // Up to 3 log entries with details about the error
        timestamp: string;    // When the log occurred
        name: string;         // Log type (e.g., "exception", "error")
        attributes?: OTLPAttribute[]; // Up to 5 attributes per log entry
    }>;
}

// Result of processing traces to extract error information
export interface ExtractedErrors {
    totalTracesSearched: number; // How many traces we examined
    errorsFound: number;         // How many had errors
    errors: ErrorSummary[];      // Array of compact error summaries
}

// Response from Jaeger's /api/v3/services endpoint
export interface JaegerServicesResponse {
    services?: string[]; // List of service names (e.g., ["frontend", "backend", "database"])
}

// Error summary for a single service when searching across all services
export interface ServiceErrorResult {
    service: string;     // Service name (e.g., "frontend")
    error_count: number; // Number of errors found in this service
    errors: ErrorSummary[]; // Array of error summaries from this service
}

// Result of searching for errors across multiple services
export interface AllServicesResult {
    summary: {
        total: number;        // Total number of services searched
        with_errors: number;  // How many services had errors
    };
    errors_by_service: ServiceErrorResult[]; // Error details grouped by service
}