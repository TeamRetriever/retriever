
import type { ServiceHealthMetrics } from "../../../types/prometheus";

/**
 * Formats a service health report into a human-readable string or JSON
 * Provides three output formats: summary (key metrics only), detailed (includes slow operations), or json (raw data)
 *  report - The structured health metrics report
 *  format - The desired output format
 *  Formatted string representation of the health report
 */
export function formatHealthReport(report: ServiceHealthMetrics, format: 'summary' | 'detailed' | 'json'): string {
    // Return raw JSON if requested
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // Build human-readable text output with emojis and formatting
    const statusEmoji = report.health_status === 'healthy' ? '✅' 
                      : report.health_status === 'degraded' ? '⚠️' 
                      : '🚨';
  
    // Header section with service name and overall health status
    let output = `${statusEmoji} Service Health: ${report.service.toUpperCase()} - ${report.health_status.toUpperCase()}\n`;
    output += `Period: Last ${report.period}\n\n`;

    // Core metrics section: throughput, errors, and latency percentiles
    output += `📊 Key Metrics:\n`;
    output += `  • Throughput: ${report.metrics.throughput}\n`;
    output += `  • Error Rate: ${report.metrics.error_rate} (~${report.metrics.error_count} errors)\n`;
    output += `  • Success Rate: ${report.metrics.success_rate}\n`;
    output += `  • P50 Latency: ${report.metrics.latency.p50}\n`;
    output += `  • P95 Latency: ${report.metrics.latency.p95}\n`;
    output += `  • P99 Latency: ${report.metrics.latency.p99}\n`;

    // Trend section: shows if service is improving or degrading (if trend data was requested)
    if (report.trend) {
      const trendEmoji = report.trend.direction === 'improving' ? '📈' 
                       : report.trend.direction === 'degrading' ? '📉' 
                       : '➡️';
      output += `\n${trendEmoji} Trend: ${report.trend.direction.toUpperCase()}\n`;
      output += `  • Previous error rate: ${report.trend.previous_error_rate}\n`;
      output += `  • Change: ${report.trend.change}\n`;
    }

    // Problem operations: highlights which specific endpoints/operations are failing most
    if (report.top_errors && report.top_errors.length > 0) {
      output += `\n🔴 Top Error Operations:\n`;
      report.top_errors.forEach(err => {
        output += `  • ${err.operation}: ${err.error_rate} error rate\n`;
      });
    }

    // Performance bottlenecks: only shown in detailed format, lists slowest operations by P95 latency
    if (format === 'detailed') {
      output += `\n🐌 Slowest Operations (by P95):\n`;
      report.slowest_operations.forEach(op => {
        output += `  • ${op.operation}: ${op.p95_latency}\n`;
      });
    }
  
    return output;
  }
  
  
  
  
  
  
  