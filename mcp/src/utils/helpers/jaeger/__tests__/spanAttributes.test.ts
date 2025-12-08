import { describe, it, expect } from '@jest/globals';
import { getAttributeValue, findAttribute, extractRelevantTags } from '../spanAttributes';
import type { OTLPAttribute, OTLPSpan } from '../../../../types/jaeger';

describe('getAttributeValue', () => {
  it('should extract string value', () => {
    const attr: OTLPAttribute = {
      key: 'http.method',
      value: { stringValue: 'GET' },
    };
    expect(getAttributeValue(attr)).toBe('GET');
  });

  it('should extract int value', () => {
    const attr: OTLPAttribute = {
      key: 'http.status_code',
      value: { intValue: 200 },
    };
    expect(getAttributeValue(attr)).toBe(200);
  });

  it('should extract bool value', () => {
    const attr: OTLPAttribute = {
      key: 'error',
      value: { boolValue: true },
    };
    expect(getAttributeValue(attr)).toBe(true);
  });

  it('should extract double value', () => {
    const attr: OTLPAttribute = {
      key: 'duration',
      value: { doubleValue: 123.45 },
    };
    expect(getAttributeValue(attr)).toBe(123.45);
  });

  it('should return undefined for attribute without value', () => {
    const attr: OTLPAttribute = {
      key: 'test',
      value: {},
    };
    expect(getAttributeValue(attr)).toBeUndefined();
  });
});

describe('findAttribute', () => {
  const attributes: OTLPAttribute[] = [
    { key: 'http.method', value: { stringValue: 'GET' } },
    { key: 'http.status_code', value: { intValue: 200 } },
    { key: 'db.statement', value: { stringValue: 'SELECT * FROM users' } },
  ];

  it('should find existing attribute by key', () => {
    const result = findAttribute(attributes, 'http.method');
    expect(result).toBeDefined();
    expect(result?.key).toBe('http.method');
    expect(result?.value.stringValue).toBe('GET');
  });

  it('should return undefined for non-existent key', () => {
    const result = findAttribute(attributes, 'nonexistent');
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty attributes array', () => {
    const result = findAttribute([], 'http.method');
    expect(result).toBeUndefined();
  });

  it('should return undefined for undefined attributes', () => {
    const result = findAttribute(undefined, 'http.method');
    expect(result).toBeUndefined();
  });
});

describe('extractRelevantTags', () => {
  it('should extract error.* tags', () => {
    const span: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test',
      startTimeUnixNano: '1000000',
      attributes: [
        { key: 'error.type', value: { stringValue: 'TimeoutException' } },
        { key: 'error.message', value: { stringValue: 'Request timeout' } },
      ],
    };
    const tags = extractRelevantTags(span);
    expect(tags['error.type']).toBe('TimeoutException');
    expect(tags['error.message']).toBe('Request timeout');
  });

  it('should extract http.* tags', () => {
    const span: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test',
      startTimeUnixNano: '1000000',
      attributes: [
        { key: 'http.method', value: { stringValue: 'POST' } },
        { key: 'http.status_code', value: { intValue: 500 } },
        { key: 'http.url', value: { stringValue: '/api/users' } },
      ],
    };
    const tags = extractRelevantTags(span);
    expect(tags['http.method']).toBe('POST');
    expect(tags['http.status_code']).toBe(500);
    expect(tags['http.url']).toBe('/api/users');
  });

  it('should extract db.* tags', () => {
    const span: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test',
      startTimeUnixNano: '1000000',
      attributes: [
        { key: 'db.statement', value: { stringValue: 'SELECT * FROM users' } },
        { key: 'db.system', value: { stringValue: 'postgresql' } },
      ],
    };
    const tags = extractRelevantTags(span);
    expect(tags['db.statement']).toBe('SELECT * FROM users');
    expect(tags['db.system']).toBe('postgresql');
  });

  it('should filter out irrelevant tags', () => {
    const span: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test',
      startTimeUnixNano: '1000000',
      attributes: [
        { key: 'http.method', value: { stringValue: 'GET' } },
        { key: 'custom.tag', value: { stringValue: 'should be filtered' } },
        { key: 'service.name', value: { stringValue: 'should be filtered' } },
      ],
    };
    const tags = extractRelevantTags(span);
    expect(tags['http.method']).toBe('GET');
    expect(tags['custom.tag']).toBeUndefined();
    expect(tags['service.name']).toBeUndefined();
  });

  it('should return empty object for span without attributes', () => {
    const span: OTLPSpan = {
      traceId: 'trace1',
      spanId: 'span1',
      name: 'test',
      startTimeUnixNano: '1000000',
    };
    const tags = extractRelevantTags(span);
    expect(tags).toEqual({});
  });
});

