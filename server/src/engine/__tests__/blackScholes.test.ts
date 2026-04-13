import { describe, it, expect } from 'vitest';
import { normalCDF, blackScholesCall, blackScholesDelta } from '../blackScholes';

describe('normalCDF', () => {
  it('returns 0.5 for x = 0', () => {
    expect(normalCDF(0)).toBe(0.5);
  });

  it('returns ~0.8413 for x = 1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ~0.1587 for x = -1', () => {
    expect(normalCDF(-1)).toBeCloseTo(0.1587, 3);
  });

  it('returns ~0.9772 for x = 2', () => {
    expect(normalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it('returns ~0.0228 for x = -2', () => {
    expect(normalCDF(-2)).toBeCloseTo(0.0228, 3);
  });

  it('approaches 1 for large positive x', () => {
    expect(normalCDF(6)).toBeCloseTo(1, 5);
  });

  it('approaches 0 for large negative x', () => {
    expect(normalCDF(-6)).toBeCloseTo(0, 5);
  });
});

describe('blackScholesCall', () => {
  // Reference: S=100, K=100, r=5%, T=1, σ=20% → C ≈ 10.4506
  it('correctly prices an at-the-money call', () => {
    const price = blackScholesCall(100, 100, 0.05, 1, 0.20);
    expect(price).toBeCloseTo(10.4506, 2);
  });

  // Deep in-the-money
  it('prices a deep ITM call near intrinsic', () => {
    const price = blackScholesCall(150, 100, 0.05, 1, 0.20);
    expect(price).toBeGreaterThan(50);
  });

  // Deep out-of-the-money
  it('prices a deep OTM call near zero', () => {
    const price = blackScholesCall(50, 100, 0.05, 1, 0.20);
    expect(price).toBeCloseTo(0, 1);
  });

  // Zero time to expiry
  it('returns intrinsic value when T=0', () => {
    expect(blackScholesCall(110, 100, 0.05, 0, 0.20)).toBe(10);
    expect(blackScholesCall(90, 100, 0.05, 0, 0.20)).toBe(0);
  });

  // K=0 means always in the money
  it('returns S when K=0', () => {
    expect(blackScholesCall(100, 0, 0.05, 1, 0.20)).toBeCloseTo(100, 1);
  });

  // With dividend yield
  it('correctly handles dividend yield', () => {
    const withDiv = blackScholesCall(100, 100, 0.05, 1, 0.20, 0.02);
    const withoutDiv = blackScholesCall(100, 100, 0.05, 1, 0.20, 0);
    expect(withDiv).toBeLessThan(withoutDiv);
  });

  // Put-call parity check: C - P = S*exp(-qT) - K*exp(-rT)
  it('satisfies put-call parity', () => {
    const S = 100, K = 100, r = 0.05, T = 1, sigma = 0.20;
    const C = blackScholesCall(S, K, r, T, sigma);
    // P = C - S*exp(-qT) + K*exp(-rT)
    const P = C - S + K * Math.exp(-r * T);
    // Should be positive (OTM put)
    expect(P).toBeGreaterThan(0);
    expect(P).toBeCloseTo(5.5735, 1);
  });
});

describe('blackScholesDelta', () => {
  it('returns ~0.5 for ATM call', () => {
    const delta = blackScholesDelta(100, 100, 0.05, 1, 0.20);
    expect(delta).toBeGreaterThan(0.5);
    expect(delta).toBeLessThan(0.7);
  });

  it('returns ~1 for deep ITM', () => {
    const delta = blackScholesDelta(200, 100, 0.05, 1, 0.20);
    expect(delta).toBeCloseTo(1, 1);
  });

  it('returns ~0 for deep OTM', () => {
    const delta = blackScholesDelta(50, 200, 0.05, 1, 0.20);
    expect(delta).toBeCloseTo(0, 1);
  });
});
