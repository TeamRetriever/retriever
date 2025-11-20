import type { PrometheusQueryResult } from "../../../types/prometheus";

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