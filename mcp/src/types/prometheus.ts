
// service health metrics and prometheus query results 

interface ServiceHealthMetrics {
    service: string;
    period: string;
    health_status: 'healthy' | 'degraded' | 'critical';
    metrics: {
      throughput: string; // requests per second
      error_count: number;
      error_rate: string;
      success_rate: string;
      latency: {
        p50: string;
        p95: string;
        p99: string;
      };
    };
    top_errors?: Array<{
      operation: string;
      error_rate: string;
      requests_per_sec: string;
    }>;
    slowest_operations: Array<{
      operation: string;
      p95_latency: string;
      requests_per_sec: string;
    }>;
    trend?: {
      direction: 'improving' | 'stable' | 'degrading';
      previous_error_rate?: string;
      change?: string;
    };
  }
  

  interface PrometheusQueryResult {
    status: string;
    data: {
      resultType: string;
      result: Array<{
        metric: Record<string, string>;
        value?: [number, string];
        values?: Array<[number, string]>;
      }>;
    };
  }
  
  export {ServiceHealthMetrics, PrometheusQueryResult}