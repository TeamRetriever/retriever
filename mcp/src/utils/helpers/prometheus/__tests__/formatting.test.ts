import { describe, it, expect } from '@jest/globals';
import { formatHealthReport } from '../formatting';
import type { ServiceHealthMetrics } from '../../../../types/prometheus';

describe('formatHealthReport', () => {
  const createMockHealthReport = (overrides?: Partial<ServiceHealthMetrics>): ServiceHealthMetrics => ({
    service: 'test-service',
    period: '15m',
    health_status: 'healthy',
    metrics: {
      throughput: '10.00 req/s',
      error_count: 5,
      error_rate: '0.50%',
      success_rate: '99.50%',
      latency: {
        p50: '50.0ms',
        p95: '100.0ms',
        p99: '200.0ms',
      },
    },
    slowest_operations: [],
    ...overrides,
  });

  it('should format healthy service in summary format', () => {
    const report = createMockHealthReport();
    const formatted = formatHealthReport(report, 'summary');

    expect(formatted).toContain('✅');
    expect(formatted).toContain('TEST-SERVICE');
    expect(formatted).toContain('HEALTHY');
    expect(formatted).toContain('10.00 req/s');
    expect(formatted).toContain('0.50%');
    expect(formatted).toContain('50.0ms');
    expect(formatted).not.toContain('Slowest Operations');
  });

  it('should include top errors when present', () => {
    const report = createMockHealthReport({
      top_errors: [
        { operation: 'GET /users', error_rate: '5.20%', requests_per_sec: '10.00' },
        { operation: 'POST /orders', error_rate: '3.10%', requests_per_sec: '5.00' },
      ],
    });
    const formatted = formatHealthReport(report, 'summary');

    expect(formatted).toContain('Top Error Operations');
    expect(formatted).toContain('GET /users');
    expect(formatted).toContain('5.20%');
  });

  it('should include slowest operations in detailed format', () => {
    const report = createMockHealthReport({
      slowest_operations: [
        { operation: 'GET /slow', p95_latency: '500.0ms', requests_per_sec: '2.00' },
        { operation: 'POST /heavy', p95_latency: '300.0ms', requests_per_sec: '1.00' },
      ],
    });
    const formatted = formatHealthReport(report, 'detailed');

    expect(formatted).toContain('Slowest Operations');
    expect(formatted).toContain('GET /slow');
    expect(formatted).toContain('500.0ms');
  });

  it('should not include slowest operations in summary format', () => {
    const report = createMockHealthReport({
      slowest_operations: [
        { operation: 'GET /slow', p95_latency: '500.0ms', requests_per_sec: '2.00' },
      ],
    });
    const formatted = formatHealthReport(report, 'summary');

    expect(formatted).not.toContain('Slowest Operations');
  });

  it('should include trend information when present', () => {
    const report = createMockHealthReport({
      trend: {
        direction: 'improving',
        previous_error_rate: '2.50%',
        change: '-1.50% (-60.0%)',
      },
    });
    const formatted = formatHealthReport(report, 'summary');

    expect(formatted).toContain('Trend');
    expect(formatted).toContain('IMPROVING');
    expect(formatted).toContain('📈');
    expect(formatted).toContain('2.50%');
  });

  it('should return JSON format when requested', () => {
    const report = createMockHealthReport();
    const formatted = formatHealthReport(report, 'json');

    expect(() => JSON.parse(formatted)).not.toThrow();
    const parsed = JSON.parse(formatted);
    expect(parsed.service).toBe('test-service');
    expect(parsed.health_status).toBe('healthy');
  });
});

