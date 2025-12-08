# MCP Server Unit Tests

This document describes the unit tests available for the MCP server.

## Setup

Install dependencies:
```bash
npm install
```

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Test Categories

### 1. Time Utilities (`src/utils/helpers/shared/__tests__/time.test.ts`)

Tests for time parsing and conversion functions:

- **`parseLookback`**: Converts time strings (e.g., "15m", "1h", "2d") to milliseconds
  - Tests various time units (seconds, minutes, hours, days)
  - Tests error handling for invalid formats

- **`parseLookbackToSeconds`**: Converts time strings to seconds
  - Tests all time units
  - Tests default fallback for invalid formats

- **`nanoToISOString`**: Converts nanosecond timestamps to ISO 8601 strings
  - Tests timestamp conversion accuracy

### 2. Span Filters (`src/utils/helpers/jaeger/__tests__/spanFilters.test.ts`)

Tests for filtering Jaeger spans by status:

- **`isErrorSpan`**: Identifies spans with error status (code 2)
- **`isSuccessfulSpan`**: Identifies spans without errors
- **`getFilterFunction`**: Returns appropriate filter function based on filter type
  - Tests "errors", "successful", and "all" filter types

### 3. Span Attributes (`src/utils/helpers/jaeger/__tests__/spanAttributes.test.ts`)

Tests for extracting and processing span attributes:

- **`getAttributeValue`**: Extracts values from OTLP attributes
  - Tests string, int, bool, and double value types
  - Tests undefined handling

- **`findAttribute`**: Finds attributes by key name
  - Tests finding existing attributes
  - Tests handling of missing attributes

- **`extractRelevantTags`**: Filters and extracts relevant tags from spans
  - Tests extraction of error.*, http.*, db.*, rpc.*, messaging.* tags
  - Tests filtering out irrelevant tags

### 4. Prometheus Query Utilities (`src/utils/helpers/prometheus/__tests__/query.test.ts`)

Tests for extracting data from Prometheus query results:

- **`extractValue`**: Extracts single numeric values from Prometheus results
  - Tests valid results
  - Tests null/empty result handling
  - Tests custom default values

- **`extractTopK`**: Extracts multiple results from topk() queries
  - Tests extracting multiple metrics with labels
  - Tests handling of empty results
  - Tests preservation of metric labels

### 5. Health Metrics (`src/utils/helpers/prometheus/__tests__/metrics.test.ts`)

Tests for health status determination and report building:

- **`determineHealthStatus`**: Determines service health based on error rate and latency
  - Tests "healthy", "degraded", and "critical" status thresholds
  - Tests various combinations of error rates and latencies

- **`buildHealthReport`**: Builds comprehensive health reports from Prometheus data
  - Tests building healthy reports
  - Tests including top errors
  - Tests including slowest operations
  - Tests trend calculation
  - Tests handling of null/empty Prometheus results

### 6. Formatting (`src/utils/helpers/prometheus/__tests__/formatting.test.ts`)

Tests for formatting health reports:

- **`formatHealthReport`**: Formats health reports in different output formats
  - Tests "summary" format (key metrics only)
  - Tests "detailed" format (includes slow operations)
  - Tests "json" format (raw data)
  - Tests emoji indicators for health status
  - Tests inclusion of top errors and trends
  - Tests exclusion of slow operations in summary format

## Test Coverage

These tests focus on **pure utility functions** that:
- Don't require external dependencies (no network calls, no file system)
- Have clear input/output contracts
- Are easy to mock and test in isolation

## Future Test Opportunities

More complex tests that could be added (requiring mocking):

1. **Tool Handlers** (`src/tools/*.ts`):
   - Mock fetch calls to Jaeger/Prometheus APIs
   - Test error handling and response parsing
   - Test input validation

2. **Span Extraction** (`src/utils/helpers/jaeger/spanExtraction.ts`):
   - Test trace summary extraction from Jaeger responses
   - Test filtering and limiting logic

3. **Multi-Service Queries** (`src/utils/helpers/jaeger/multiService.ts`):
   - Test aggregating traces across multiple services
   - Test error handling for failed service queries

4. **Server Integration** (`src/server.ts`):
   - Test MCP server initialization
   - Test tool registration
   - Test HTTP endpoint handling

## Running Specific Tests

Run a specific test file:
```bash
npm test -- time.test.ts
```

Run tests matching a pattern:
```bash
npm test -- --testNamePattern="parseLookback"
```

