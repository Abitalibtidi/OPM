import { describe, it, expect } from 'vitest';
import { calculateDLOM } from '../dlom';

describe('DLOM Models', () => {
  const typical = { volatility: 0.60, holdingPeriod: 3.0, riskFreeRate: 0.04 };

  it('returns results for all four models', () => {
    const results = calculateDLOM(typical);
    expect(results).toHaveLength(4);
    const names = results.map(r => r.modelName);
    expect(names).toContain('finnerty');
    expect(names).toContain('ghaidarov');
    expect(names).toContain('chaffe');
    expect(names).toContain('longstaff');
  });

  it('results are sorted ascending by DLOM%', () => {
    const results = calculateDLOM(typical);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].dlomPercentage).toBeGreaterThanOrEqual(results[i - 1].dlomPercentage);
    }
  });

  it('all DLOMs are in (0, 1) for typical inputs', () => {
    const results = calculateDLOM(typical);
    for (const r of results) {
      expect(r.dlomPercentage).toBeGreaterThan(0);
      expect(r.dlomPercentage).toBeLessThan(1);
    }
  });

  it('longstaff is the largest (upper bound)', () => {
    const results = calculateDLOM(typical);
    const longstaff = results.find(r => r.modelName === 'longstaff')!;
    for (const r of results) {
      if (r.modelName !== 'longstaff') {
        expect(longstaff.dlomPercentage).toBeGreaterThanOrEqual(r.dlomPercentage);
      }
    }
  });

  it('chaffe is higher than finnerty (conservative vs average-strike)', () => {
    const results = calculateDLOM(typical);
    const chaffe = results.find(r => r.modelName === 'chaffe')!;
    const finnerty = results.find(r => r.modelName === 'finnerty')!;
    expect(chaffe.dlomPercentage).toBeGreaterThan(finnerty.dlomPercentage);
  });

  it('ghaidarov <= finnerty when r > 0 (forward drift reduces discount)', () => {
    const results = calculateDLOM(typical);
    const ghaidarov = results.find(r => r.modelName === 'ghaidarov')!;
    const finnerty = results.find(r => r.modelName === 'finnerty')!;
    expect(ghaidarov.dlomPercentage).toBeLessThanOrEqual(finnerty.dlomPercentage);
  });

  it('finnerty equals ghaidarov when r = 0', () => {
    const zeroRate = { volatility: 0.60, holdingPeriod: 3.0, riskFreeRate: 0 };
    const results = calculateDLOM(zeroRate);
    const ghaidarov = results.find(r => r.modelName === 'ghaidarov')!;
    const finnerty = results.find(r => r.modelName === 'finnerty')!;
    expect(ghaidarov.dlomPercentage).toBeCloseTo(finnerty.dlomPercentage, 10);
  });

  it('returns zero DLOM for zero volatility', () => {
    const noVol = { volatility: 0, holdingPeriod: 3.0, riskFreeRate: 0.04 };
    const results = calculateDLOM(noVol);
    for (const r of results) {
      expect(r.dlomPercentage).toBe(0);
    }
  });

  it('DLOM increases with volatility (chaffe)', () => {
    const low = calculateDLOM({ volatility: 0.30, holdingPeriod: 3.0, riskFreeRate: 0.04 });
    const high = calculateDLOM({ volatility: 0.80, holdingPeriod: 3.0, riskFreeRate: 0.04 });
    const lowChaffe = low.find(r => r.modelName === 'chaffe')!;
    const highChaffe = high.find(r => r.modelName === 'chaffe')!;
    expect(highChaffe.dlomPercentage).toBeGreaterThan(lowChaffe.dlomPercentage);
  });

  it('DLOM increases with holding period (finnerty)', () => {
    const short = calculateDLOM({ volatility: 0.60, holdingPeriod: 1.0, riskFreeRate: 0.04 });
    const long = calculateDLOM({ volatility: 0.60, holdingPeriod: 5.0, riskFreeRate: 0.04 });
    const shortFinnerty = short.find(r => r.modelName === 'finnerty')!;
    const longFinnerty = long.find(r => r.modelName === 'finnerty')!;
    expect(longFinnerty.dlomPercentage).toBeGreaterThan(shortFinnerty.dlomPercentage);
  });

  it('typical chaffe DLOM is roughly 25-40% for σ=0.6, T=3', () => {
    const results = calculateDLOM(typical);
    const chaffe = results.find(r => r.modelName === 'chaffe')!;
    expect(chaffe.dlomPercentage).toBeGreaterThan(0.25);
    expect(chaffe.dlomPercentage).toBeLessThan(0.40);
  });
});
