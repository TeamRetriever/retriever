import { describe, it, expect } from '@jest/globals';
import { determineHealthStatus, buildHealthReport } from '../metrics';
import type { PrometheusQueryResult } from '../../../../types/prometheus';

describe('determineHealthStatus', () => {
  it('should return "healthy" for low error rate and latency', () => {
    expect(determineHealthStatus(0.5, 200)).toBe('healthy');
    expect(determineHealthStatus(0.1, 100)).toBe('healthy');
  });

  it('should return "degraded" for moderate error rate', () => {
    expect(determineHealthStatus(2, 200)).toBe('degraded');
    expect(determineHealthStatus(1.5, 100)).toBe('degraded');
  });

  it('should return "degraded" for moderate latency', () => {
    expect(determineHealthStatus(0.5, 600)).toBe('degraded');
    expect(determineHealthStatus(0.1, 800)).toBe('degraded');
  });

  it('should return "critical" for high error rate', () => {
    expect(determineHealthStatus(6, 200)).toBe('critical');
    expect(determineHealthStatus(10, 100)).toBe('critical');
  });

  it('should return "critical" for high latency', () => {
    expect(determineHealthStatus(0.5, 1200)).toBe('critical');
    expect(determineHealthStatus(0.1, 2000)).toBe('critical');
  });

  it('should return "critical" for both high error rate and latency', () => {
    expect(determineHealthStatus(6, 1200)).toBe('critical');
  });
});

describe('buildHealthReport', () => {
  const createMockPrometheusResult = (value: number): PrometheusQueryResult => ({
    status: 'success',
    data: {
      resultType: 'vector',
      result: [
        {
          metric: {},
          value: [Date.now() / 1000, value.toString()],
        },
      ],
    },
  });

  const createMockTopKResult = (items: Array<{ operation: string; value: number }>): PrometheusQueryResult => ({
    status: 'success',
    data: {
      resultType: 'vector',
      result: items.map(item => ({
        metric: { span_name: item.operation },
        value: [Date.now() / 1000, item.value.toString()],
      })),
    },
  });

  it('should build a healthy health report', () => {
    const report = buildHealthReport(
      'test-service',
      '15m',
      createMockPrometheusResult(10), // throughput: 10 req/s
      createMockPrometheusResult(0.5), // error rate: 0.5%
      createMockPrometheusResult(50),  // p50: 50ms
      createMockPrometheusResult(100), // p95: 100ms
      createMockPrometheusResult(200), // p99: 200ms
      null, // no errors by op
      null, // no slowest ops
      null  // no trends
    );

    expect(report.service).toBe('test-service');
    expect(report.period).toBe('15m');
    expect(report.health_status).toBe('healthy');
    expect(report.metrics.error_rate).toBe('0.50%');
    expect(report.metrics.success_rate).toBe('99.50%');
    expect(report.metrics.latency.p50).toBe('50.0ms');
    expect(report.metrics.latency.p95).toBe('100.0ms');
    expect(report.metrics.latency.p99).toBe('200.0ms');
  });

  it('should include top errors when provided', () => {
    const errorsByOp = createMockTopKResult([
      { operation: 'GET /users', value: 5.2 },
      { operation: 'POST /orders', value: 3.1 },
    ]);

    const report = buildHealthReport(
      'test-service',
      '15m',
      createMockPrometheusResult(10),
      createMockPrometheusResult(1),
      createMockPrometheusResult(50),
      createMockPrometheusResult(100),
      createMockPrometheusResult(200),
      errorsByOp,
      null,
      null
    );

    expect(report.top_errors).toBeDefined();
    expect(report.top_errors!.length).toBe(2);
    expect(report.top_errors![0].operation).toBe('GET /users');
    expect(report.top_errors![0].error_rate).toBe('5.20%');
  });

  it('should include slowest operations when provided', () => {
    const slowestOps = createMockTopKResult([
      { operation: 'GET /slow-endpoint', value: 500 },
      { operation: 'POST /heavy-operation', value: 300 },
    ]);

    const report = buildHealthReport(
      'test-service',
      '15m',
      createMockPrometheusResult(10),
      createMockPrometheusResult(0.5),
      createMockPrometheusResult(50),
      createMockPrometheusResult(100),
      createMockPrometheusResult(200),
      null,
      slowestOps,
      null
    );

    expect(report.slowest_operations.length).toBe(2);
    expect(report.slowest_operations[0].operation).toBe('GET /slow-endpoint');
    expect(report.slowest_operations[0].p95_latency).toBe('500.0ms');
  });

  it('should calculate trend when provided', () => {
    const trendData = createMockPrometheusResult(2.5); // previous error rate: 2.5%

    const report = buildHealthReport(
      'test-service',
      '15m',
      createMockPrometheusResult(10),
      createMockPrometheusResult(1.0), // current error rate: 1.0%
      createMockPrometheusResult(50),
      createMockPrometheusResult(100),
      createMockPrometheusResult(200),
      null,
      null,
      trendData
    );

    expect(report.trend).toBeDefined();
    expect(report.trend!.direction).toBe('improving');
    expect(report.trend!.previous_error_rate).toBe('2.50%');
    expect(report.trend!.change).toContain('-1.50%');
  });

  it('should handle null/empty Prometheus results', () => {
    const report = buildHealthReport(
      'test-service',
      '15m',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    );

    expect(report.metrics.throughput).toBe('0.00 req/s');
    expect(report.metrics.error_rate).toBe('0.00%');
    expect(report.metrics.latency.p50).toBe('0.0ms');
    expect(report.health_status).toBe('healthy');
  });
});

