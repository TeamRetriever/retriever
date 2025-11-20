import { extractValue, extractTopK } from "./query";
import { parseLookbackToSeconds } from "../shared/time";
import type { PrometheusQueryResult } from "../../../types/prometheus";
import type { ServiceHealthMetrics } from "../../../types/prometheus";



function determineHealthStatus(errorRate: number, p95Latency: number): 'healthy' | 'degraded' | 'critical' {
    if (errorRate > 5 || p95Latency > 1000) {
      return 'critical';
    } else if (errorRate > 1 || p95Latency > 500) {
      return 'degraded';
    }
    return 'healthy';
  }

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
    
    // Extract scalar metrics
    const throughputRps = extractValue(throughputData, 0);
    const errorRate = extractValue(errorRateData, 0);
    const p50 = extractValue(p50Data, 0);
    const p95 = extractValue(p95Data, 0);
    const p99 = extractValue(p99Data, 0);
    
    // Calculate success rate
    const successRate = Math.max(0, 100 - errorRate);
    
    // Estimate total requests (throughput * seconds in period)
    const secondsInPeriod = parseLookbackToSeconds(lookback);
    const estimatedTotalRequests = Math.round(throughputRps * secondsInPeriod);
    const estimatedErrorCount = Math.round((errorRate / 100) * estimatedTotalRequests);
  
    // Extract top error operations
    const topErrors = extractTopK(errorsByOpData).map(item => ({
      operation: item.metric.span_name || item.metric.operation || 'unknown',
      error_rate: `${item.value.toFixed(2)}%`,
      requests_per_sec: throughputRps.toFixed(2), // TODO: per-operation throughput if available
    }));
  
    // Extract slowest operations
    const slowestOps = extractTopK(slowestOpsData).map(item => ({
      operation: item.metric.span_name || item.metric.operation || 'unknown',
      p95_latency: `${item.value.toFixed(1)}ms`,
      requests_per_sec: throughputRps.toFixed(2), // TODO: per-operation throughput
    }));
  
    // Determine health status
    const healthStatus = determineHealthStatus(errorRate, p95);
  
    // Build trend data if available
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