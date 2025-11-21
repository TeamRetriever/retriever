import { extractValue, extractTopK } from "./query";
import { parseLookbackToSeconds } from "../shared/time";
import type { PrometheusQueryResult } from "../../../types/prometheus";
import type { ServiceHealthMetrics } from "../../../types/prometheus";

/**
 * Determines the overall health status of a service based on error rate and latency
 * @param errorRate - Percentage of requests that failed
 * @param p95Latency - 95th percentile latency in milliseconds
 * @returns 'healthy', 'degraded', or 'critical' status
 */
function determineHealthStatus(errorRate: number, p95Latency: number): 'healthy' | 'degraded' | 'critical' {
    if (errorRate > 5 || p95Latency > 1000) {
      return 'critical';
    } else if (errorRate > 1 || p95Latency > 500) {
      return 'degraded';
    }
    return 'healthy';
  }

/**
 * Transforms raw Prometheus query results into a structured service health report
 * Aggregates all metrics, calculates derived values, and structures the data for easy consumption
 */
function buildHealthReport(
    service: string,
    lookback: string,
    throughputData: PrometheusQueryResult | null,
    errorRateData: PrometheusQueryResult | null,
    p50Data: PrometheusQueryResult | null,
    p95Data: PrometheusQueryResult | null,
    p99Data: PrometheusQueryResult | null,
    errorsByOpData: PrometheusQueryResult | null,
    slowestOpsData: PrometheusQueryResult | null,
    trendData: PrometheusQueryResult | null
  ): ServiceHealthMetrics {

    // Section 1: Extract core scalar metrics from Prometheus results
    // Converts Prometheus query responses to simple numeric values
    const throughputRps = extractValue(throughputData, 0);
    const errorRate = extractValue(errorRateData, 0);
    const p50 = extractValue(p50Data, 0);
    const p95 = extractValue(p95Data, 0);
    const p99 = extractValue(p99Data, 0);

    // Section 2: Calculate derived metrics
    // Computes success rate and estimates total request/error counts based on throughput
    const successRate = Math.max(0, 100 - errorRate);
    
    // Estimate total requests (throughput * seconds in period)
    const secondsInPeriod = parseLookbackToSeconds(lookback);
    const estimatedTotalRequests = Math.round(throughputRps * secondsInPeriod);
    const estimatedErrorCount = Math.round((errorRate / 100) * estimatedTotalRequests);

    // Section 3: Extract problem operations
    // Identifies which specific operations are failing most frequently
    const topErrors = extractTopK(errorsByOpData).map(item => ({
      operation: item.metric.span_name || item.metric.operation || 'unknown',
      error_rate: `${item.value.toFixed(2)}%`,
      requests_per_sec: throughputRps.toFixed(2), // TODO: per-operation throughput if available
    }));

    // Section 4: Extract performance bottlenecks
    // Identifies which operations are slowest (highest P95 latency)
    const slowestOps = extractTopK(slowestOpsData).map(item => ({
      operation: item.metric.span_name || item.metric.operation || 'unknown',
      p95_latency: `${item.value.toFixed(1)}ms`,
      requests_per_sec: throughputRps.toFixed(2), // TODO: per-operation throughput
    }));

    // Section 5: Determine overall health status
    // Uses error rate and latency thresholds to categorize service health
    const healthStatus = determineHealthStatus(errorRate, p95);

    // Section 6: Calculate trends (if requested)
    // Compares current metrics with previous period to detect improving/degrading patterns
    let trend: ServiceHealthMetrics['trend'] = undefined;
    if (trendData) {
      const previousErrorRate = extractValue(trendData, 0);
      const errorRateDelta = errorRate - previousErrorRate;
      
      let direction: 'improving' | 'stable' | 'degrading';
      if (Math.abs(errorRateDelta) < 0.5) {
        direction = 'stable';
      } else if (errorRateDelta > 0) {
        direction = 'degrading';
      } else {
        direction = 'improving';
      }
      
      const percentChange = previousErrorRate > 0 
        ? ((errorRateDelta / previousErrorRate) * 100).toFixed(1)
        : 'N/A';
      
      trend = {
        direction,
        previous_error_rate: `${previousErrorRate.toFixed(2)}%`,
        change: `${errorRateDelta >= 0 ? '+' : ''}${errorRateDelta.toFixed(2)}% (${percentChange}%)`,
      };
    }

    // Section 7: Assemble final report structure
    // Combines all analyzed data into a comprehensive health report
    return {
      service,
      period: lookback,
      health_status: healthStatus,
      metrics: {
        throughput: `${throughputRps.toFixed(2)} req/s`,
        error_count: estimatedErrorCount,
        error_rate: `${errorRate.toFixed(2)}%`,
        success_rate: `${successRate.toFixed(2)}%`,
        latency: {
          p50: `${p50.toFixed(1)}ms`,
          p95: `${p95.toFixed(1)}ms`,
          p99: `${p99.toFixed(1)}ms`,
        },
      },
      top_errors: topErrors.length > 0 ? topErrors : undefined,
      slowest_operations: slowestOps,
      trend,
    };
  }

  export {determineHealthStatus, buildHealthReport}