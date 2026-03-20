import { describe, it, expect } from 'vitest';
import { classifyRevenueBucket, type RevenueBucket } from '../../fair-lending';

describe('classifyRevenueBucket', () => {
  it('returns "unknown" for null revenue', () => {
    expect(classifyRevenueBucket(null)).toBe('unknown');
  });

  it('returns "unknown" for undefined revenue', () => {
    expect(classifyRevenueBucket(undefined)).toBe('unknown');
  });

  it('returns "unknown" for NaN', () => {
    expect(classifyRevenueBucket(NaN)).toBe('unknown');
  });

  // Micro: < $1M (< 1,000K)
  it('classifies $0 revenue as micro', () => {
    expect(classifyRevenueBucket(0)).toBe('micro');
  });

  it('classifies $500K revenue as micro', () => {
    expect(classifyRevenueBucket(500)).toBe('micro');
  });

  it('classifies $999K revenue as micro', () => {
    expect(classifyRevenueBucket(999)).toBe('micro');
  });

  // Small: $1M–$10M (1,000K–9,999K)
  it('classifies $1M revenue as small', () => {
    expect(classifyRevenueBucket(1_000)).toBe('small');
  });

  it('classifies $5M revenue as small', () => {
    expect(classifyRevenueBucket(5_000)).toBe('small');
  });

  it('classifies $9.999M revenue as small', () => {
    expect(classifyRevenueBucket(9_999)).toBe('small');
  });

  // Medium: $10M–$100M (10,000K–99,999K)
  it('classifies $10M revenue as medium', () => {
    expect(classifyRevenueBucket(10_000)).toBe('medium');
  });

  it('classifies $50M revenue as medium', () => {
    expect(classifyRevenueBucket(50_000)).toBe('medium');
  });

  // Large: $100M–$1B (100,000K–999,999K)
  it('classifies $100M revenue as large', () => {
    expect(classifyRevenueBucket(100_000)).toBe('large');
  });

  it('classifies $500M revenue as large', () => {
    expect(classifyRevenueBucket(500_000)).toBe('large');
  });

  // Enterprise: >= $1B (>= 1,000,000K)
  it('classifies $1B revenue as enterprise', () => {
    expect(classifyRevenueBucket(1_000_000)).toBe('enterprise');
  });

  it('classifies $5B revenue as enterprise', () => {
    expect(classifyRevenueBucket(5_000_000)).toBe('enterprise');
  });

  // Negative revenue — classify by absolute magnitude
  it('classifies negative revenue by absolute value', () => {
    expect(classifyRevenueBucket(-500)).toBe('micro');
    expect(classifyRevenueBucket(-5_000)).toBe('small');
    expect(classifyRevenueBucket(-50_000)).toBe('medium');
    expect(classifyRevenueBucket(-500_000)).toBe('large');
    expect(classifyRevenueBucket(-5_000_000)).toBe('enterprise');
  });

  // Boundary precision
  it('handles exact boundary at each threshold', () => {
    const boundaries: Array<[number, RevenueBucket]> = [
      [1_000, 'small'],       // exactly $1M → small (not micro)
      [10_000, 'medium'],     // exactly $10M → medium (not small)
      [100_000, 'large'],     // exactly $100M → large (not medium)
      [1_000_000, 'enterprise'], // exactly $1B → enterprise (not large)
    ];
    for (const [revenue, expected] of boundaries) {
      expect(classifyRevenueBucket(revenue)).toBe(expected);
    }
  });
});
