import { describe, it, expect } from '@jest/globals';
import { extractValue, extractTopK } from '../query';
import type { PrometheusQueryResult } from '../../../../types/prometheus';

describe('extractValue', () => {
  it('should extract value from valid Prometheus result', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: {},
            value: [1234567890, '42.5'],
          },
        ],
      },
    };
    expect(extractValue(result)).toBe(42.5);
  });

  it('should return default value for null result', () => {
    expect(extractValue(null)).toBe(0);
  });

  it('should return default value for empty result array', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [],
      },
    };
    expect(extractValue(result)).toBe(0);
  });

  it('should return custom default value', () => {
    expect(extractValue(null, 100)).toBe(100);
  });

  it('should handle result without value field', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: {},
          },
        ],
      },
    };
    expect(extractValue(result)).toBe(0);
  });

  it('should parse integer values', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: {},
            value: [1234567890, '100'],
          },
        ],
      },
    };
    expect(extractValue(result)).toBe(100);
  });
});

describe('extractTopK', () => {
  it('should extract multiple results from topk query', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: { span_name: 'GET /users', service_name: 'api' },
            value: [1234567890, '5.2'],
          },
          {
            metric: { span_name: 'POST /orders', service_name: 'api' },
            value: [1234567890, '3.1'],
          },
        ],
      },
    };

    const extracted = extractTopK(result);
    expect(extracted.length).toBe(2);
    expect(extracted[0].metric.span_name).toBe('GET /users');
    expect(extracted[0].value).toBe(5.2);
    expect(extracted[1].metric.span_name).toBe('POST /orders');
    expect(extracted[1].value).toBe(3.1);
  });

  it('should return empty array for null result', () => {
    expect(extractTopK(null)).toEqual([]);
  });

  it('should return empty array for result without data', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [],
      },
    };
    expect(extractTopK(result)).toEqual([]);
  });

  it('should handle results without value field', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: { span_name: 'GET /users' },
          },
        ],
      },
    };

    const extracted = extractTopK(result);
    expect(extracted.length).toBe(1);
    expect(extracted[0].value).toBe(0);
  });

  it('should preserve all metric labels', () => {
    const result: PrometheusQueryResult = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: {
              span_name: 'GET /users',
              service_name: 'api',
              status_code: 'STATUS_CODE_ERROR',
            },
            value: [1234567890, '5.2'],
          },
        ],
      },
    };

    const extracted = extractTopK(result);
    expect(extracted[0].metric).toEqual({
      span_name: 'GET /users',
      service_name: 'api',
      status_code: 'STATUS_CODE_ERROR',
    });
  });
});

