import { describe, it, expect } from '@jest/globals';
import { parseLookback, parseLookbackToSeconds, nanoToISOString } from '../time';

describe('parseLookback', () => {
  it('should convert minutes to milliseconds', () => {
    expect(parseLookback('15m')).toBe(15 * 60 * 1000);
    expect(parseLookback('30m')).toBe(30 * 60 * 1000);
  });

  it('should convert hours to milliseconds', () => {
    expect(parseLookback('1h')).toBe(60 * 60 * 1000);
    expect(parseLookback('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('should convert days to milliseconds', () => {
    expect(parseLookback('1d')).toBe(24 * 60 * 60 * 1000);
    expect(parseLookback('2d')).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('should convert seconds to milliseconds', () => {
    expect(parseLookback('30s')).toBe(30 * 1000);
    expect(parseLookback('60s')).toBe(60 * 1000);
  });

  it('should throw error for invalid format', () => {
    expect(() => parseLookback('invalid')).toThrow('Invalid lookback format');
    expect(() => parseLookback('15')).toThrow('Invalid lookback format');
    expect(() => parseLookback('15x')).toThrow('Invalid lookback format');
  });
});

describe('parseLookbackToSeconds', () => {
  it('should convert seconds to seconds', () => {
    expect(parseLookbackToSeconds('30s')).toBe(30);
    expect(parseLookbackToSeconds('60s')).toBe(60);
  });

  it('should convert minutes to seconds', () => {
    expect(parseLookbackToSeconds('15m')).toBe(15 * 60);
    expect(parseLookbackToSeconds('30m')).toBe(30 * 60);
  });

  it('should convert hours to seconds', () => {
    expect(parseLookbackToSeconds('1h')).toBe(3600);
    expect(parseLookbackToSeconds('2h')).toBe(2 * 3600);
  });

  it('should convert days to seconds', () => {
    expect(parseLookbackToSeconds('1d')).toBe(86400);
    expect(parseLookbackToSeconds('2d')).toBe(2 * 86400);
  });

  it('should return default 900 seconds for invalid format', () => {
    expect(parseLookbackToSeconds('invalid')).toBe(900);
    expect(parseLookbackToSeconds('15x')).toBe(900);
  });
});

describe('nanoToISOString', () => {
  it('should convert nanosecond timestamp to ISO string', () => {
    // Test with a known timestamp: 1609459200000 milliseconds = 2021-01-01T00:00:00.000Z
    const nanoTimestamp = '1609459200000000000'; // nanoseconds
    const result = nanoToISOString(nanoTimestamp);
    expect(result).toBe('2021-01-01T00:00:00.000Z');
  });

  it('should handle large nanosecond timestamps', () => {
    // Current timestamp in nanoseconds
    const now = Date.now();
    const nanoTimestamp = (BigInt(now) * BigInt(1000000)).toString();
    const result = nanoToISOString(nanoTimestamp);
    const expected = new Date(now).toISOString();
    expect(result).toBe(expected);
  });
});

