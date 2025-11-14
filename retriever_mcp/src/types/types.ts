interface ServiceErrorResult {
    service: string;
    error_count: number;
    errors: unknown; // raw Jaeger API response
  }


  export {ServiceErrorResult}