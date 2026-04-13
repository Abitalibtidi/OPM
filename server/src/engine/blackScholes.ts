/**
 * Black-Scholes Option Pricing Model
 *
 * Implements the analytical Black-Scholes formula for European call options.
 * Uses the Abramowitz & Stegun rational approximation for the cumulative
 * normal distribution function (accuracy ~1e-7).
 *
 * References:
 * - Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities"
 * - Abramowitz, M. & Stegun, I.A. (1964). Handbook of Mathematical Functions, formula 7.1.26
 */

/**
 * Cumulative standard normal distribution function.
 * Uses the Abramowitz & Stegun approximation (formula 7.1.26)
 * with maximum error of 1.5×10⁻⁷.
 */
export function normalCDF(x: number): number {
  if (x === 0) return 0.5;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard normal probability density function.
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Black-Scholes European call option price.
 *
 * @param S - Current value of the underlying asset (equity value)
 * @param K - Strike price (breakpoint value)
 * @param r - Risk-free interest rate (annual, as decimal)
 * @param T - Time to expiration in years
 * @param sigma - Volatility (annual, as decimal)
 * @param q - Continuous dividend yield (annual, as decimal)
 * @returns Call option value
 */
export function blackScholesCall(
  S: number,
  K: number,
  r: number,
  T: number,
  sigma: number,
  q: number = 0
): number {
  // Edge cases
  if (T <= 0) return Math.max(S - K, 0);
  if (S <= 0) return 0;
  if (sigma <= 0) return Math.max(S * Math.exp(-q * T) - K * Math.exp(-r * T), 0);

  // K = 0 means the option is always in the money
  if (K <= 0) return S * Math.exp(-q * T);

  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callValue =
    S * Math.exp(-q * T) * normalCDF(d1) -
    K * Math.exp(-r * T) * normalCDF(d2);

  return Math.max(callValue, 0);
}

/**
 * Vega of a European call option (sensitivity to volatility).
 * Used for Newton-Raphson iteration in backsolve.
 *
 * @returns dC/dσ
 */
export function blackScholesVega(
  S: number,
  K: number,
  r: number,
  T: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0 || S <= 0 || K <= 0 || sigma <= 0) return 0;

  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));

  return S * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T);
}

/**
 * Delta of a European call option (sensitivity to underlying price).
 * Used for Newton-Raphson in backsolve to find implied equity value.
 *
 * @returns ∂C/∂S
 */
export function blackScholesDelta(
  S: number,
  K: number,
  r: number,
  T: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0) return S > K ? 1 : 0;
  if (S <= 0 || sigma <= 0) return 0;
  if (K <= 0) return Math.exp(-q * T);

  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));

  return Math.exp(-q * T) * normalCDF(d1);
}
