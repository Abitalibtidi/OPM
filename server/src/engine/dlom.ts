/**
 * Discount for Lack of Marketability (DLOM) Models
 *
 * Implements four DLOM models per AICPA Valuation Advisory #4:
 *   1. Chaffe (1993) — European ATM put option
 *   2. Finnerty (2012) — Average-strike put option
 *   3. Ghaidarov (2009) — Forward price-adjusted average-strike put
 *   4. Longstaff (1995) — Lookback option upper bound
 *
 * References:
 *   Chaffe, D.B.H. (1993). Option Pricing as a Proxy for Discount for Lack of
 *     Marketability in Private Company Valuations. Business Valuation Review.
 *   Finnerty, J.D. (2012). An Average-Strike Put Option Model of the Marketability
 *     Discount. Journal of Derivatives.
 *   Ghaidarov, A.B. (2009). Analytical Put Models for Valuing Restricted and Freely
 *     Tradeable Shares. Business Valuation Review.
 *   Longstaff, F.A. (1995). How Much Can Marketability Affect Security Values?
 *     Journal of Finance.
 *   AICPA Valuation Advisory #4 (2019).
 */

import { normalCDF } from './blackScholes';

export type DLOMModelName = 'finnerty' | 'chaffe' | 'ghaidarov' | 'longstaff';

export interface DLOMInputs {
  volatility: number;    // annual, decimal (e.g. 0.60 = 60%)
  holdingPeriod: number; // years
  riskFreeRate: number;  // annual, decimal (e.g. 0.04 = 4%)
}

export interface DLOMModelResult {
  modelName: DLOMModelName;
  dlomPercentage: number; // 0–1
  inputs: DLOMInputs;
  description: string;
}

/**
 * Chaffe (1993) — European ATM put option (S = K = 1, no dividends).
 *
 * The DLOM equals the cost of buying an at-the-money put to protect against
 * selling at a lower price during the restriction period.
 * This is the most conservative of the four models.
 *
 *   d1 = (r + σ²/2)·T / (σ√T)
 *   d2 = d1 − σ√T
 *   DLOM = e^{−rT}·N(−d2) − N(−d1)
 */
function chaffeModel(inputs: DLOMInputs): number {
  const { volatility: σ, holdingPeriod: T, riskFreeRate: r } = inputs;
  if (T <= 0 || σ <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (r + 0.5 * σ * σ) * T / (σ * sqrtT);
  const d2 = d1 - σ * sqrtT;
  const dlom = Math.exp(-r * T) * normalCDF(-d2) - normalCDF(-d1);
  return Math.max(0, Math.min(1, dlom));
}

/**
 * Finnerty (2012) — Average-strike put option (no risk-free drift).
 *
 * Models DLOM as the cost of an average-strike European put, where the strike
 * equals the geometric average price over the holding period.  Because the average
 * is below the current price in expected value (Jensen's inequality), this gives a
 * lower DLOM than Chaffe.
 *
 *   d = 0.5·σ·√T
 *   DLOM = N(−d) − e^{σ²T/2}·N(−d − σ√T)
 */
function finnetryModel(inputs: DLOMInputs): number {
  const { volatility: σ, holdingPeriod: T } = inputs;
  if (T <= 0 || σ <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d = 0.5 * σ * sqrtT;
  const dlom = normalCDF(-d) - Math.exp(0.5 * σ * σ * T) * normalCDF(-d - σ * sqrtT);
  return Math.max(0, Math.min(1, dlom));
}

/**
 * Ghaidarov (2009) — Forward price-adjusted average-strike put.
 *
 * Extends Finnerty by incorporating the risk-free drift of the forward price.
 * When r > 0 the expected stock price grows, so the average-strike put is worth
 * less — yielding a modestly lower DLOM than Finnerty.
 *
 *   d = 0.5·σ·√T
 *   DLOM = N(−d) − e^{(r + σ²/2)·T}·N(−d − σ√T)
 */
function ghaidarovModel(inputs: DLOMInputs): number {
  const { volatility: σ, holdingPeriod: T, riskFreeRate: r } = inputs;
  if (T <= 0 || σ <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d = 0.5 * σ * sqrtT;
  const dlom = normalCDF(-d) - Math.exp((r + 0.5 * σ * σ) * T) * normalCDF(-d - σ * sqrtT);
  return Math.max(0, Math.min(1, dlom));
}

/**
 * Longstaff (1995) — Lookback option upper bound.
 *
 * Derives a theoretical maximum DLOM based on the value of a lookback option
 * (the right to sell at the maximum price over the restriction period).  This
 * is explicitly an upper bound and will exceed the other three models.
 *
 *   DLOM = 2·N(0.5·σ·√T) − 1
 */
function longstaffModel(inputs: DLOMInputs): number {
  const { volatility: σ, holdingPeriod: T } = inputs;
  if (T <= 0 || σ <= 0) return 0;
  const dlom = 2 * normalCDF(0.5 * σ * Math.sqrt(T)) - 1;
  return Math.max(0, Math.min(1, dlom));
}

const MODEL_DESCRIPTIONS: Record<DLOMModelName, string> = {
  chaffe:
    'Chaffe (1993): Costs an at-the-money European put to protect against downside during the restriction period. Most conservative model.',
  finnerty:
    'Finnerty (2012): Values the right to sell at the average (geometric mean) price during the restriction period. No risk-free drift adjustment.',
  ghaidarov:
    'Ghaidarov (2009): Extends Finnerty by incorporating the risk-free forward price, reducing the discount slightly when r > 0.',
  longstaff:
    'Longstaff (1995): Theoretical upper bound based on a lookback option — the right to sell at the highest price during the restriction period.',
};

/**
 * Run a single DLOM model.
 */
function runModel(name: DLOMModelName, inputs: DLOMInputs): DLOMModelResult {
  let dlom: number;
  switch (name) {
    case 'chaffe':     dlom = chaffeModel(inputs);    break;
    case 'finnerty':   dlom = finnetryModel(inputs);  break;
    case 'ghaidarov':  dlom = ghaidarovModel(inputs); break;
    case 'longstaff':  dlom = longstaffModel(inputs); break;
  }
  return {
    modelName: name,
    dlomPercentage: dlom,
    inputs,
    description: MODEL_DESCRIPTIONS[name],
  };
}

/**
 * Run all four DLOM models for the given inputs.
 * Returns results ordered from lowest to highest DLOM.
 */
export function calculateDLOM(inputs: DLOMInputs): DLOMModelResult[] {
  const models: DLOMModelName[] = ['finnerty', 'ghaidarov', 'chaffe', 'longstaff'];
  return models
    .map((name) => runModel(name, inputs))
    .sort((a, b) => a.dlomPercentage - b.dlomPercentage);
}

export const DLOM_MODEL_NAMES: DLOMModelName[] = ['finnerty', 'ghaidarov', 'chaffe', 'longstaff'];
