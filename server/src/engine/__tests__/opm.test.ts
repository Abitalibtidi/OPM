import { describe, it, expect } from 'vitest';
import { calculateOPM } from '../opm';
import { backsolve } from '../backsolve';
import type { ShareClass } from '../../../shared/types';

function makeShareClass(overrides: Partial<ShareClass>): ShareClass {
  return {
    id: overrides.id || 'class-' + Math.random().toString(36).slice(2, 8),
    valuationId: 'val-1',
    name: overrides.name || 'Test Class',
    type: overrides.type || 'common',
    sharesOutstanding: overrides.sharesOutstanding || 1000000,
    issuePrice: overrides.issuePrice || 0,
    liquidationPreference: overrides.liquidationPreference || 0,
    isParticipating: overrides.isParticipating || false,
    participationCap: overrides.participationCap || 0,
    conversionRatio: overrides.conversionRatio || 1,
    seniorityLevel: overrides.seniorityLevel || 1,
    liquidationSeniority: overrides.liquidationSeniority || 'pari_passu',
    strikePrice: overrides.strikePrice || 0,
    vestingPercent: overrides.vestingPercent || 100,
    sortOrder: overrides.sortOrder || 0,
  };
}

describe('OPM Calculation', () => {
  it('handles a simple common-only structure', () => {
    const classes = [
      makeShareClass({ id: 'common', name: 'Common', type: 'common', sharesOutstanding: 10000000 }),
    ];

    const result = calculateOPM({
      totalEquityValue: 50000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.results).toHaveLength(1);
    // All value should go to common
    expect(result.results[0].perShareValue).toBeGreaterThan(0);
    const totalAllocated = result.results.reduce((s, r) => s + r.optionValue, 0);
    expect(totalAllocated).toBeCloseTo(50000000, -3); // within $1000
  });

  it('handles common + preferred structure', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 8000000,
        seniorityLevel: 2,
      }),
      makeShareClass({
        id: 'seriesA',
        name: 'Series A',
        type: 'preferred',
        sharesOutstanding: 2000000,
        issuePrice: 5,
        liquidationPreference: 10000000,
        isParticipating: false,
        conversionRatio: 1,
        seniorityLevel: 1,
      }),
    ];

    const result = calculateOPM({
      totalEquityValue: 50000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.results).toHaveLength(2);
    expect(result.breakpoints.length).toBeGreaterThan(1);

    // Preferred should get at least its liquidation preference worth
    const prefResult = result.results.find((r) => r.shareClassId === 'seriesA')!;
    expect(prefResult.optionValue).toBeGreaterThan(0);

    // Common should get value too given high equity value
    const commonResult = result.results.find((r) => r.shareClassId === 'common')!;
    expect(commonResult.perShareValue).toBeGreaterThan(0);

    // Total should approximately equal equity value
    const totalAllocated = result.results.reduce((s, r) => s + r.optionValue, 0);
    expect(totalAllocated).toBeCloseTo(50000000, -4);
  });

  it('preferred gets more per share than common with liq pref', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 8000000,
        seniorityLevel: 2,
      }),
      makeShareClass({
        id: 'seriesA',
        name: 'Series A',
        type: 'preferred',
        sharesOutstanding: 2000000,
        issuePrice: 5,
        liquidationPreference: 10000000,
        isParticipating: false,
        conversionRatio: 1,
        seniorityLevel: 1,
      }),
    ];

    const result = calculateOPM({
      totalEquityValue: 20000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    const prefResult = result.results.find((r) => r.shareClassId === 'seriesA')!;
    const commonResult = result.results.find((r) => r.shareClassId === 'common')!;

    // Preferred should have higher per-share value due to liq pref
    expect(prefResult.perShareValue).toBeGreaterThan(commonResult.perShareValue);
  });

  it('returns empty results for empty share classes', () => {
    const result = calculateOPM({
      totalEquityValue: 50000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: [],
    });

    expect(result.results).toHaveLength(0);
    expect(result.breakpoints).toHaveLength(0);
  });
});

describe('Warrant support', () => {
  it('treats warrants like options — nets strike from per-share value', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 9000000,
      }),
      makeShareClass({
        id: 'warrants',
        name: 'Investor Warrants',
        type: 'warrant',
        sharesOutstanding: 1000000,
        strikePrice: 2.00,
        vestingPercent: 100,
      }),
    ];

    const result = calculateOPM({
      totalEquityValue: 50000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.results).toHaveLength(2);

    const warrantResult = result.results.find((r) => r.shareClassId === 'warrants')!;
    // Gross allocation should be positive
    expect(warrantResult.optionValue).toBeGreaterThan(0);
    // Per-share value should be gross/shares - strike
    expect(warrantResult.perShareValue).toBeGreaterThan(0);
    // Per-share value should be less than gross/shares
    const grossPerShare = warrantResult.optionValue / 1000000;
    expect(warrantResult.perShareValue).toBeCloseTo(grossPerShare - 2.00, 4);

    // Total allocation sums to equity value
    const totalAllocated = result.results.reduce((s, r) => s + r.optionValue, 0);
    expect(totalAllocated).toBeCloseTo(50000000, -3);
  });

  it('out-of-money warrant gets zero per-share value', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 1000000,
      }),
      makeShareClass({
        id: 'warrants',
        name: 'Warrants',
        type: 'warrant',
        sharesOutstanding: 100000,
        strikePrice: 500.00, // absurdly high strike
        vestingPercent: 100,
      }),
    ];

    const result = calculateOPM({
      totalEquityValue: 1000000, // $1 per common share before warrant dilution
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    const warrantResult = result.results.find((r) => r.shareClassId === 'warrants')!;
    // Per-share value floored at zero for deep OTM warrants
    expect(warrantResult.perShareValue).toBe(0);
  });

  it('warrant coexists correctly with preferred and common', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 7000000,
        seniorityLevel: 2,
      }),
      makeShareClass({
        id: 'seriesA',
        name: 'Series A',
        type: 'preferred',
        sharesOutstanding: 2000000,
        liquidationPreference: 10000000,
        isParticipating: false,
        conversionRatio: 1,
        seniorityLevel: 1,
      }),
      makeShareClass({
        id: 'warrants',
        name: 'Lender Warrants',
        type: 'warrant',
        sharesOutstanding: 500000,
        strikePrice: 3.00,
        vestingPercent: 100,
      }),
    ];

    const result = calculateOPM({
      totalEquityValue: 60000000,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.results).toHaveLength(3);
    const totalAllocated = result.results.reduce((s, r) => s + r.optionValue, 0);
    expect(totalAllocated).toBeCloseTo(60000000, -3);

    // All classes should get some value at this equity level
    result.results.forEach((r) => {
      expect(r.optionValue).toBeGreaterThan(0);
    });
  });
});

describe('Backsolve', () => {
  it('finds implied equity value from known PPS', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 10000000,
      }),
    ];

    // For common-only, if PPS = $5, equity value should be ~$50M
    const result = backsolve({
      targetClassId: 'common',
      targetPerShareValue: 5,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.converged).toBe(true);
    // For common-only, implied equity should be close to PPS * shares
    expect(result.impliedEquityValue).toBeCloseTo(50000000, -5);
  });

  it('converges for complex capital structure', () => {
    const classes = [
      makeShareClass({
        id: 'common',
        name: 'Common',
        type: 'common',
        sharesOutstanding: 8000000,
        seniorityLevel: 2,
      }),
      makeShareClass({
        id: 'seriesA',
        name: 'Series A',
        type: 'preferred',
        sharesOutstanding: 2000000,
        issuePrice: 5,
        liquidationPreference: 10000000,
        isParticipating: true,
        participationCap: 3,
        conversionRatio: 1,
        seniorityLevel: 1,
      }),
    ];

    const result = backsolve({
      targetClassId: 'seriesA',
      targetPerShareValue: 8.0,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    });

    expect(result.converged).toBe(true);
    expect(result.impliedEquityValue).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('throws for non-existent target class', () => {
    const classes = [
      makeShareClass({ id: 'common', name: 'Common' }),
    ];

    expect(() => backsolve({
      targetClassId: 'nonexistent',
      targetPerShareValue: 5,
      volatility: 0.60,
      riskFreeRate: 0.04,
      term: 3,
      dividendYield: 0,
      shareClasses: classes,
    })).toThrow('Target share class not found');
  });
});
