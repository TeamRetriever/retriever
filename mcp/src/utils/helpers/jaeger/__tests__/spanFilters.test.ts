import { describe, it, expect } from '@jest/globals';
import { isErrorSpan, isSuccessfulSpan, getFilterFunction } from '../spanFilters';
import type { OTLPSpan } from '../../../../types/jaeger';

describe('isErrorSpan', () => {
  it('should return true for spans with error status code', () => {
    const errorSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
      status: { code: 2 }, // ERROR
    };
    expect(isErrorSpan(errorSpan)).toBe(true);
  });

  it('should return false for spans without error status', () => {
    const okSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
      status: { code: 1 }, // OK
    };
    expect(isErrorSpan(okSpan)).toBe(false);
  });

  it('should return false for spans without status', () => {
    const noStatusSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
    };
    expect(isErrorSpan(noStatusSpan)).toBe(false);
  });
});

describe('isSuccessfulSpan', () => {
  it('should return true for spans without error status', () => {
    const okSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
      status: { code: 1 }, // OK
    };
    expect(isSuccessfulSpan(okSpan)).toBe(true);
  });

  it('should return true for spans without status', () => {
    const noStatusSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
    };
    expect(isSuccessfulSpan(noStatusSpan)).toBe(true);
  });

  it('should return false for spans with error status', () => {
    const errorSpan: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test-operation',
      startTimeUnixNano: '1000000',
      status: { code: 2 }, // ERROR
    };
    expect(isSuccessfulSpan(errorSpan)).toBe(false);
  });
});

describe('getFilterFunction', () => {
  const mockSpan: OTLPSpan = {
    traceId: 'trace1',
    spanId: 'span1',
    name: 'test-operation',
    startTimeUnixNano: '1000000',
    status: { code: 2 }, // ERROR
  };

  it('should return error filter function for "errors"', () => {
    const filterFn = getFilterFunction('errors');
    expect(filterFn).toBeDefined();
    expect(filterFn!(mockSpan)).toBe(true);
  });

  it('should return success filter function for "successful"', () => {
    const filterFn = getFilterFunction('successful');
    expect(filterFn).toBeDefined();
    expect(filterFn!(mockSpan)).toBe(false);
  });

  it('should return undefined for "all"', () => {
    const filterFn = getFilterFunction('all');
    expect(filterFn).toBeUndefined();
  });

  it('should return undefined for default case', () => {
    const filterFn = getFilterFunction('all' as any);
    expect(filterFn).toBeUndefined();
  });
});

