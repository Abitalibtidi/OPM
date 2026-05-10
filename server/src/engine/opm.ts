/**
 * Option Pricing Model (OPM) Valuation Engine
 *
 * Implements the OPM framework for allocating total equity value across
 * multiple share classes with complex liquidation preferences, participation
 * rights, and conversion features.
 *
 * Method:
 * 1. Construct breakpoints from the capital structure waterfall
 * 2. Model each tranche between breakpoints as a call option spread
 * 3. Allocate tranche values to participating classes
 * 4. Sum allocations to get per-class values
 *
 * Reference: AICPA Practice Aid, "Valuation of Privately-Held-Company
 * Equity Securities Issued as Compensation" (2013, updated 2019)
 */

import { blackScholesCall } from './blackScholes';
import { constructBreakpoints, getFullyDilutedByClass } from './breakpoints';
import type {
  ShareClass,
  OPMCalculationResult,
  TrancheResult,
  ValuationResult,
} from '../../shared/types';

export interface OPMInputs {
  totalEquityValue: number;
  volatility: number;
  riskFreeRate: number;
  term: number;
  dividendYield: number;
  shareClasses: ShareClass[];
}

/**
 * Run the full OPM calculation.
 *
 * @param inputs - Equity value, option pricing parameters, and capital structure
 * @returns Complete calculation results including breakpoints, tranches, and per-class values
 */
export function calculateOPM(inputs: OPMInputs): OPMCalculationResult {
  const { totalEquityValue, volatility, riskFreeRate, term, dividendYield, shareClasses } = inputs;

  // Step 1: Construct breakpoints
  const breakpoints = constructBreakpoints(shareClasses);

  if (breakpoints.length === 0) {
    return {
      breakpoints: [],
      tranches: [],
      results: [],
      totalEquityValue,
      inputs: { volatility, riskFreeRate, term, dividendYield },
    };
  }

  // Step 2: Calculate call option values at each breakpoint
  const callValues = breakpoints.map((bp) =>
    blackScholesCall(totalEquityValue, bp.equityValue, riskFreeRate, term, volatility, dividendYield)
  );

  // Step 3: Calculate tranche values and allocate to classes
  const tranches: TrancheResult[] = [];
  const classValues = new Map<string, number>();

  // Initialize class values
  for (const sc of shareClasses) {
    classValues.set(sc.id, 0);
  }

  // Add a terminal breakpoint at infinity (call value = 0)
  for (let i = 0; i < breakpoints.length; i++) {
    const lowerBP = breakpoints[i];
    const upperBP = i < breakpoints.length - 1 ? breakpoints[i + 1] : null;

    const callLower = callValues[i];
    const callUpper = upperBP ? callValues[i + 1] : 0;

    const trancheValue = callLower - callUpper;

    if (trancheValue <= 0) continue;

    // Get participants for this tranche (use the lower breakpoint's participants
    // since they describe who gets value in the tranche above this point)
    const participants = lowerBP.participants;

    const allocations = participants.map((p) => {
      const value = trancheValue * p.allocationPercent;
      const current = classValues.get(p.shareClassId) || 0;
      classValues.set(p.shareClassId, current + value);

      return {
        shareClassId: p.shareClassId,
        shareClassName: p.shareClassName,
        percent: p.allocationPercent,
        value,
      };
    });

    tranches.push({
      lowerBreakpoint: lowerBP.equityValue,
      upperBreakpoint: upperBP ? upperBP.equityValue : Infinity,
      callValueLower: callLower,
      callValueUpper: callUpper,
      trancheValue,
      allocations,
    });
  }

  // Step 4: Build per-class results
  const fullyDilutedMap = getFullyDilutedByClass(shareClasses);
  const totalAllocated = Array.from(classValues.values()).reduce((s, v) => s + v, 0);

  const results: Omit<ValuationResult, 'id' | 'valuationId'>[] = shareClasses.map((sc) => {
    // grossValue = the OPM waterfall allocation for this class (call-spread sum).
    // This is what the OPM "bucket" captures — 100% of equity sums across all buckets.
    const grossValue = classValues.get(sc.id) || 0;
    const fdShares = fullyDilutedMap.get(sc.id) || 0;

    // perShareValue is the 409A FMV: for options the holder pays the exercise price,
    // so the net economic benefit per share is grossValue/shares − strike.
    // We floor at zero (options can't have negative intrinsic value).
    let perShareValue = fdShares > 0 ? grossValue / fdShares : 0;
    if ((sc.type === 'option' || sc.type === 'warrant') && sc.strikePrice > 0) {
      perShareValue = Math.max(perShareValue - sc.strikePrice, 0);
    }

    return {
      shareClassId: sc.id,
      shareClass: sc,
      // optionValue stores the gross OPM allocation for all class types (legacy field name).
      optionValue: grossValue,
      perShareValue,
      // totalValue is the gross OPM allocation so that Σ totalValue === totalEquityValue.
      // For options: totalValue (gross) − perShareValue × fdShares = aggregate exercise proceeds,
      // which flow back to the company rather than to option holders.
      totalValue: grossValue,
      allocationPercent: totalAllocated > 0 ? grossValue / totalAllocated : 0,
      fullyDilutedShares: fdShares,
    };
  });

  // Reconciliation guard: gross allocations must equal total equity within floating-point tolerance.
  if (process.env.NODE_ENV !== 'production') {
    const reconciled = results.reduce((s, r) => s + r.totalValue, 0);
    if (Math.abs(reconciled - totalEquityValue) > Math.max(0.01, totalEquityValue * 1e-9)) {
      console.warn(
        `OPM reconciliation error: allocated ${reconciled.toFixed(4)} vs equity ${totalEquityValue.toFixed(4)}, diff ${(reconciled - totalEquityValue).toFixed(4)}`
      );
    }
  }

  return {
    breakpoints,
    tranches,
    results,
    totalEquityValue,
    inputs: { volatility, riskFreeRate, term, dividendYield },
  };
}

/**
 * Quick calculation returning just the per-share value for a specific class.
 * Used internally by the backsolve algorithm.
 */
export function getPerShareValueForClass(
  inputs: OPMInputs,
  targetClassId: string
): number {
  const result = calculateOPM(inputs);
  const classResult = result.results.find((r) => r.shareClassId === targetClassId);
  return classResult ? classResult.perShareValue : 0;
}
