import { describe, it, expect } from 'vitest';
import {
  calculateTotalDebtToCapital,
  calculateSeniorDebtToEBITDA,
  calculateInterestCoverageRatio,
  calculateDebtToEquityRatio,
  calculateProfitMargin,
  calculateCurrentRatio,
} from '../ratio-calculator';

describe('calculateTotalDebtToCapital', () => {
  it('calculates ratio correctly', () => {
    // Total Capital = 1000 + 500 = 1500; ratio = 1000/1500 = 0.6667
    expect(calculateTotalDebtToCapital(1000, 500)).toBeCloseTo(0.6667, 3);
  });

  it('returns null when totalDebt is null', () => {
    expect(calculateTotalDebtToCapital(null, 500)).toBeNull();
  });

  it('returns null when shareholdersEquity is null', () => {
    expect(calculateTotalDebtToCapital(1000, null)).toBeNull();
  });

  it('returns null when total capital is zero (equity exactly offsets debt)', () => {
    // totalCapital = -500 + 500 = 0 → undefined ratio
    expect(calculateTotalDebtToCapital(-500, 500)).toBeNull();
  });

  it('returns ratio > 1 for negative equity (distress signal)', () => {
    // Negative equity: totalCapital = 1000 + (-200) = 800; ratio = 1000/800 = 1.25
    const result = calculateTotalDebtToCapital(1000, -200);
    expect(result).toBeCloseTo(1.25, 3);
    expect(result!).toBeGreaterThan(1);
  });

  it('returns negative ratio when totalCapital is negative (severe distress)', () => {
    // totalCapital = 500 + (-1000) = -500; ratio = 500/-500 = -1.0
    const result = calculateTotalDebtToCapital(500, -1000);
    expect(result).toBeCloseTo(-1.0, 3);
  });

  it('handles zero debt correctly', () => {
    expect(calculateTotalDebtToCapital(0, 500)).toBe(0);
  });
});

describe('calculateSeniorDebtToEBITDA', () => {
  it('calculates ratio correctly', () => {
    // 5000 / 2000 = 2.5x
    expect(calculateSeniorDebtToEBITDA(5000, 2000)).toBe(2.5);
  });

  it('returns null when seniorDebt is null', () => {
    expect(calculateSeniorDebtToEBITDA(null, 2000)).toBeNull();
  });

  it('returns null when ebitda is null', () => {
    expect(calculateSeniorDebtToEBITDA(5000, null)).toBeNull();
  });

  it('returns null when ebitda is zero (division by zero)', () => {
    expect(calculateSeniorDebtToEBITDA(5000, 0)).toBeNull();
  });

  it('returns negative ratio for negative EBITDA (distress signal)', () => {
    // 5000 / -1000 = -5.0x
    const result = calculateSeniorDebtToEBITDA(5000, -1000);
    expect(result).toBe(-5);
    expect(result!).toBeLessThan(0);
  });

  it('returns zero when seniorDebt is zero', () => {
    expect(calculateSeniorDebtToEBITDA(0, 2000)).toBe(0);
  });
});

describe('calculateInterestCoverageRatio', () => {
  it('calculates ratio correctly', () => {
    // 10000 / 2000 = 5.0x
    expect(calculateInterestCoverageRatio(10000, 2000)).toBe(5);
  });

  it('returns null when ebitda is null', () => {
    expect(calculateInterestCoverageRatio(null, 2000)).toBeNull();
  });

  it('returns null when interest is null', () => {
    expect(calculateInterestCoverageRatio(10000, null)).toBeNull();
  });

  it('returns null when interest is zero', () => {
    expect(calculateInterestCoverageRatio(10000, 0)).toBeNull();
  });

  it('returns negative ratio for negative EBITDA', () => {
    expect(calculateInterestCoverageRatio(-5000, 2000)).toBe(-2.5);
  });
});

describe('calculateDebtToEquityRatio', () => {
  it('calculates ratio correctly', () => {
    // 8000 / 4000 = 2.0x
    expect(calculateDebtToEquityRatio(8000, 4000)).toBe(2);
  });

  it('returns null when totalDebt is null', () => {
    expect(calculateDebtToEquityRatio(null, 4000)).toBeNull();
  });

  it('returns null when equity is null', () => {
    expect(calculateDebtToEquityRatio(8000, null)).toBeNull();
  });

  it('returns null when equity is zero', () => {
    expect(calculateDebtToEquityRatio(8000, 0)).toBeNull();
  });

  it('returns negative ratio for negative equity (solvency signal)', () => {
    // 8000 / -2000 = -4.0x
    expect(calculateDebtToEquityRatio(8000, -2000)).toBe(-4);
  });
});

describe('calculateProfitMargin', () => {
  it('calculates margin as decimal', () => {
    // 1500 / 10000 = 0.15 (15%)
    expect(calculateProfitMargin(1500, 10000)).toBeCloseTo(0.15, 4);
  });

  it('returns null when netIncome is null', () => {
    expect(calculateProfitMargin(null, 10000)).toBeNull();
  });

  it('returns null when revenue is null', () => {
    expect(calculateProfitMargin(1500, null)).toBeNull();
  });

  it('returns null when revenue is zero', () => {
    expect(calculateProfitMargin(1500, 0)).toBeNull();
  });

  it('returns negative margin for net loss', () => {
    // -500 / 10000 = -0.05 (-5%)
    expect(calculateProfitMargin(-500, 10000)).toBeCloseTo(-0.05, 4);
  });
});

describe('calculateCurrentRatio', () => {
  it('calculates ratio correctly', () => {
    // 3000 / 2000 = 1.5x
    expect(calculateCurrentRatio(3000, 2000)).toBe(1.5);
  });

  it('returns null when currentAssets is null', () => {
    expect(calculateCurrentRatio(null, 2000)).toBeNull();
  });

  it('returns null when currentLiabilities is null', () => {
    expect(calculateCurrentRatio(3000, null)).toBeNull();
  });

  it('returns null when currentLiabilities is zero', () => {
    expect(calculateCurrentRatio(3000, 0)).toBeNull();
  });

  it('returns ratio < 1 when liabilities exceed assets (liquidity concern)', () => {
    expect(calculateCurrentRatio(800, 2000)).toBe(0.4);
  });
});
