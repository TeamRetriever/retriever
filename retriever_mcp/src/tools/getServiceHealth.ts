import z from "zod";
import { buildHealthReport } from "../utils/helpers/prometheus/metrics";
import { formatHealthReport } from "../utils/helpers/prometheus/formatting";
import { queryPrometheus } from "../utils/helpers/prometheus/query";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";

export const getServiceHealthTool = {
    name: "get_service_health",
    description: "Get comprehensive health metrics for a service using Prometheus spanmetrics. Returns error rates, latency percentiles (P50/P95/P99), throughput, and identifies problematic operations.",
    inputSchema: {
      service: z.string().describe("Service name to check health for"),
      lookback: z.string().optional().default("15m").describe('Time range like "15m", "1h", "4h"'),
      format: z.enum(['summary', 'detailed', 'json']).optional().default('summary').describe('Output format'),
      include_trends: z.boolean().optional().default(false).describe('Compare with previous period'),
    },
    outputSchema: { result: z.any() },
  
    handler: async (params: {
      service: string;
      lookback?: string;
      format?: 'summary' | 'detailed' | 'json';
      include_trends?: boolean;
    }) => {
      const prometheusUrl = process.env.PROMETHEUS_URL || "http://prometheus:9090";
      const lookback = params.lookback || "15m";
      const format = params.format || "summary";
  
      console.log(`Querying Prometheus at ${prometheusUrl} for service: ${params.service}`);
  
      // Execute all Prometheus queries in parallel
      const [
        throughputData,
        errorRateData,
        p50Data,
        p95Data,
        p99Data,
        errorsByOpData,
        slowestOpsData,
        trendData
      ] = await Promise.all([
        // Total throughput (requests/sec)
        queryPrometheus(prometheusUrl, 
          `rate(traces_span_metrics_calls_total{service_name="${params.service}"}[${lookback}])`
        ),
        
        // Error rate
        queryPrometheus(prometheusUrl,
          `(
            rate(traces_span_metrics_calls_total{service_name="${params.service}",status_code="STATUS_CODE_ERROR"}[${lookback}])
            /
            rate(traces_span_metrics_calls_total{service_name="${params.service}"}[${lookback}])
          ) * 100`
        ),
        
        // P50 latency
        queryPrometheus(prometheusUrl,
          `histogram_quantile(0.50, 
            rate(traces_span_metrics_duration_milliseconds_bucket{service_name="${params.service}"}[${lookback}])
          )`
        ),
        
        // P95 latency
        queryPrometheus(prometheusUrl,
          `histogram_quantile(0.95, 
            rate(traces_span_metrics_duration_milliseconds_bucket{service_name="${params.service}"}[${lookback}])
          )`
        ),
        
        // P99 latency
        queryPrometheus(prometheusUrl,
          `histogram_quantile(0.99, 
            rate(traces_span_metrics_duration_milliseconds_bucket{service_name="${params.service}"}[${lookback}])
          )`
        ),
        
        // Top error operations (group by span_name)
        queryPrometheus(prometheusUrl,
          `topk(5,
            (
              rate(traces_span_metrics_calls_total{service_name="${params.service}",status_code="STATUS_CODE_ERROR"}[${lookback}])
              /
              rate(traces_span_metrics_calls_total{service_name="${params.service}"}[${lookback}])
            ) * 100
          )`
        ),
        
        // Slowest operations by P95
        queryPrometheus(prometheusUrl,
          `topk(5,
            histogram_quantile(0.95, 
              rate(traces_span_metrics_duration_milliseconds_bucket{service_name="${params.service}"}[${lookback}])
            )
          )`
        ),
        
        // Previous period error rate (for trend comparison)
        params.include_trends ? queryPrometheus(prometheusUrl,
          `(
            rate(traces_span_metrics_calls_total{service_name="${params.service}",status_code="STATUS_CODE_ERROR"}[${lookback}] offset ${lookback})
            /
            rate(traces_span_metrics_calls_total{service_name="${params.service}"}[${lookback}] offset ${lookback})
          ) * 100`
        ) : Promise.resolve(null)
      ]);
  
      // Build health report from Prometheus data
      const healthReport = buildHealthReport(
        params.service,
        lookback,
        throughputData,
        errorRateData,
        p50Data,
        p95Data,
        p99Data,
        errorsByOpData,
        slowestOpsData,
        trendData
      );
  
      // Format output
      const formattedOutput = formatHealthReport(healthReport, format);
  
      const textContent: TextContent = {
        type: "text",
        text: formattedOutput,
      };
  
      return {
        content: [textContent],
        structuredContent: { result: healthReport },
      };
    },
  };
  