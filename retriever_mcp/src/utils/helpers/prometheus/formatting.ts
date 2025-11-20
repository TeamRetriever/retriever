
import type { ServiceHealthMetrics } from "../../../types/prometheus";

export function formatHealthReport(report: ServiceHealthMetrics, format: 'summary' | 'detailed' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }
  
    const statusEmoji = report.health_status === 'healthy' ? '✅' 
                      : report.health_status === 'degraded' ? '⚠️' 
                      : '🚨';
  
    let output = `${statusEmoji} Service Health: ${report.service.toUpperCase()} - ${report.health_status.toUpperCase()}\n`;
    output += `Period: Last ${report.period}\n\n`;
    
    output += `📊 Key Metrics:\n`;
    output += `  • Throughput: ${report.metrics.throughput}\n`;
    output += `  • Error Rate: ${report.metrics.error_rate} (~${report.metrics.error_count} errors)\n`;
    output += `  • Success Rate: ${report.metrics.success_rate}\n`;
    output += `  • P50 Latency: ${report.metrics.latency.p50}\n`;
    output += `  • P95 Latency: ${report.metrics.latency.p95}\n`;
    output += `  • P99 Latency: ${report.metrics.latency.p99}\n`;
  
    if (report.trend) {
      const trendEmoji = report.trend.direction === 'improving' ? '📈' 
                       : report.trend.direction === 'degrading' ? '📉' 
                       : '➡️';
      output += `\n${trendEmoji} Trend: ${report.trend.direction.toUpperCase()}\n`;
      output += `  • Previous error rate: ${report.trend.previous_error_rate}\n`;
      output += `  • Change: ${report.trend.change}\n`;
    }
  
    if (report.top_errors && report.top_errors.length > 0) {
      output += `\n🔴 Top Error Operations:\n`;
      report.top_errors.forEach(err => {
        output += `  • ${err.operation}: ${err.error_rate} error rate\n`;
      });
    }
  
    if (format === 'detailed') {
      output += `\n🐌 Slowest Operations (by P95):\n`;
      report.slowest_operations.forEach(op => {
        output += `  • ${op.operation}: ${op.p95_latency}\n`;
      });
    }
  
    return output;
  }
  
  
  
  
  
  
  