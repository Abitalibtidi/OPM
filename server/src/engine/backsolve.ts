/**
 * OPM Backsolve Engine
 *
 * Given a known (or estimated) per-share value for one share class,
 * iteratively solves for the implied total equity value using the
 * OPM allocation framework.
 *
 * Uses the bisection method for robustness, with optional
 * Newton-Raphson refinement for faster convergence.
 *
 * Reference: AICPA Practice Aid, Chapter 7 - "Backsolve Method"
 */

import { calculateOPM, getPerShareValueForClass } from './opm';
import type { ShareClass, BacksolveResult } from '../../shared/types';

export interface BacksolveInputs {
  targetClassId: string;
  targetPerShareValue: number;
  volatility: number;
  riskFreeRate: number;
  term: number;
  dividendYield: number;
  shareClasses: ShareClass[];
  maxIterations?: number;
  tolerance?: number;
}

/**
 * Solve for implied total equity value using the backsolve method.
 *
 * @param inputs - Target class, target PPS, and OPM parameters
 * @returns Full OPM results at the implied equity value, plus convergence info
 */
export function backsolve(inputs: BacksolveInputs): BacksolveResult {
  const {
    targetClassId,
    targetPerShareValue,
    volatility,
    riskFreeRate,
    term,
    dividendYield,
    shareClasses,
    maxIterations = 200,
    tolerance = 0.01, // $0.01 tolerance on PPS
  } = inputs;

  // Validate target class exists
  const targetClass = shareClasses.find((sc) => sc.id === targetClassId);
  if (!targetClass) {
    throw new Error(`Target share class not found: ${targetClassId}`);
  }

  // ── Bisection Method ──
  // Find bounds: lower bound where PPS = 0, upper bound where PPS > target
  let lower = 0;
  let upper = targetPerShareValue * shareClasses.reduce(
    (sum, sc) => sum + sc.sharesOutstanding, 0
  ) * 10; // generous upper bound

  // Ensure upper bound is sufficient
  const makeOPMInputs = (equityValue: number) => ({
    totalEquityValue: equityValue,
    volatility,
    riskFreeRate,
    term,
    dividendYield,
    shareClasses,
  });

  let upperPPS = getPerShareValueForClass(makeOPMInputs(upper), targetClassId);
  while (upperPPS < targetPerShareValue && upper < 1e15) {
    upper *= 2;
    upperPPS = getPerShareValueForClass(makeOPMInputs(upper), targetClassId);
  }

  let iterations = 0;
  let mid = (lower + upper) / 2;
  let midPPS = 0;
  let converged = false;

  while (iterations < maxIterations) {
    mid = (lower + upper) / 2;
    midPPS = getPerShareValueForClass(makeOPMInputs(mid), targetClassId);

    const error = midPPS - targetPerShareValue;

    if (Math.abs(error) < tolerance) {
      converged = true;
      break;
    }

    if (error < 0) {
      lower = mid;
    } else {
      upper = mid;
    }

    iterations++;
  }

  // Run full OPM at the converged equity value
  const finalResult = calculateOPM(makeOPMInputs(mid));

  return {
    ...finalResult,
    impliedEquityValue: Math.round(mid * 100) / 100,
    targetClassId,
    targetPPS: targetPerShareValue,
    iterations,
    converged,
  };
}

/**
 * Validate that backsolve inputs are reasonable.
 */
export function validateBacksolveInputs(inputs: BacksolveInputs): string[] {
  const errors: string[] = [];

  if (inputs.targetPerShareValue <= 0) {
    errors.push('Target per-share value must be positive');
  }
  if (inputs.volatility <= 0 || inputs.volatility > 3) {
    errors.push('Volatility must be between 0 and 300%');
  }
  if (inputs.riskFreeRate < 0 || inputs.riskFreeRate > 0.5) {
    errors.push('Risk-free rate must be between 0% and 50%');
  }
  if (inputs.term <= 0 || inputs.term > 30) {
    errors.push('Term must be between 0 and 30 years');
  }
  if (inputs.dividendYield < 0 || inputs.dividendYield > 1) {
    errors.push('Dividend yield must be between 0% and 100%');
  }

  const targetClass = inputs.shareClasses.find((sc) => sc.id === inputs.targetClassId);
  if (!targetClass) {
    errors.push('Target share class not found');
  }

  if (inputs.shareClasses.length === 0) {
    errors.push('At least one share class is required');
  }

  return errors;
}
