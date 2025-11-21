import type { PrometheusQueryResult } from "../../../types/prometheus";

/**
 * Executes a PromQL query against the Prometheus API
 * @param baseUrl - The base URL of the Prometheus server
 * @param query - The PromQL query string to execute
 * @returns Prometheus query result or null if the query fails
 */
async function queryPrometheus(
    baseUrl: string,
    query: string
  ): Promise<PrometheusQueryResult | null> {
    try {
      const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`;
      console.log(`Prometheus query: ${query}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Prometheus query failed: ${response.status} ${response.statusText}`);
        return null;
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error querying Prometheus:`, error);
      return null;
    }
  }

/**
 * Extracts a single numeric value from a Prometheus query result
 * Useful for scalar metrics like error rates, throughput, or percentiles
 * @param result - The Prometheus query result
 * @param defaultValue - Value to return if no result is found (default: 0)
 * @returns The extracted numeric value
 */
function extractValue(result: PrometheusQueryResult | null, defaultValue: number = 0): number {
    if (!result || !result.data.result || result.data.result.length === 0) {
      return defaultValue;
    }
    
    // Get the first result's value
    const firstResult = result.data.result[0];
    if (firstResult.value) {
      return parseFloat(firstResult.value[1]);
    }
    
    return defaultValue;
  }

/**
 * Extracts multiple results from a topk() Prometheus query
 * Returns an array of metrics with their labels and values
 * Useful for identifying top error operations, slowest endpoints, etc.
 * @param result - The Prometheus query result from a topk() query
 * @returns Array of metrics with their labels and numeric values
 */
function extractTopK(result: PrometheusQueryResult | null): Array<{metric: Record<string, string>, value: number}> {
    if (!result || !result.data.result) {
      return [];
    }

    return result.data.result.map(r => ({
        metric: r.metric,
        value: r.value ? parseFloat(r.value[1]) : 0
      }));
    }


    export {queryPrometheus, extractValue, extractTopK}