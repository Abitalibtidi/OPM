/**
 * Breakpoint Construction for OPM
 *
 * Constructs the equity value breakpoints that define the capital structure's
 * waterfall. At each breakpoint, the marginal allocation of value changes
 * among the share classes.
 *
 * The breakpoints are derived from:
 * 1. Liquidation preferences (by seniority)
 * 2. Conversion points (where preferred converts to common)
 * 3. Participation caps
 *
 * Reference: AICPA Accounting & Valuation Guide,
 * "Valuation of Privately-Held-Company Equity Securities Issued as Compensation"
 */

import type { ShareClass, Breakpoint, BreakpointParticipant } from '../../shared/types';

interface ParsedClass {
  id: string;
  name: string;
  type: 'common' | 'preferred' | 'option';
  shares: number;              // outstanding shares
  liquidationPref: number;     // total $ liq pref
  isParticipating: boolean;
  participationCap: number;    // multiple, 0 = uncapped
  conversionRatio: number;
  seniorityLevel: number;
  strikePrice: number;
  vestingPercent: number;
  asIfCommonShares: number;    // shares on as-converted basis
}

/**
 * Parse share classes from DB format into internal working format.
 */
function parseClasses(classes: ShareClass[]): ParsedClass[] {
  return classes.map((sc) => {
    const vestedShares = sc.sharesOutstanding * (sc.vestingPercent / 100);
    let asIfCommonShares: number;

    if (sc.type === 'option') {
      asIfCommonShares = vestedShares; // each option converts to 1 common share (net of strike via OPM)
    } else if (sc.type === 'preferred') {
      asIfCommonShares = vestedShares * sc.conversionRatio;
    } else {
      asIfCommonShares = vestedShares;
    }

    return {
      id: sc.id,
      name: sc.name,
      type: sc.type as ParsedClass['type'],
      shares: vestedShares,
      liquidationPref: sc.type === 'preferred' ? sc.liquidationPreference : 0,
      isParticipating: sc.isParticipating,
      participationCap: sc.participationCap,
      conversionRatio: sc.conversionRatio,
      seniorityLevel: sc.seniorityLevel,
      strikePrice: sc.type === 'option' ? sc.strikePrice : 0,
      vestingPercent: sc.vestingPercent,
      asIfCommonShares: asIfCommonShares,
    };
  });
}

/**
 * Calculate fully diluted shares across all classes (as-converted to common).
 */
function getFullyDilutedShares(classes: ParsedClass[]): number {
  return classes.reduce((sum, c) => sum + c.asIfCommonShares, 0);
}

/**
 * Construct breakpoints for the OPM from the capital structure.
 *
 * Returns breakpoints sorted by equity value ascending, each with
 * the participants who receive value in the tranche above that breakpoint.
 */
export function constructBreakpoints(shareClasses: ShareClass[]): Breakpoint[] {
  const classes = parseClasses(shareClasses);
  const fullyDiluted = getFullyDilutedShares(classes);

  if (fullyDiluted === 0 || classes.length === 0) {
    return [];
  }

  // Sort preferred by seniority (1 = most senior first)
  const preferredClasses = classes
    .filter((c) => c.type === 'preferred')
    .sort((a, b) => a.seniorityLevel - b.seniorityLevel);

  const commonClasses = classes.filter((c) => c.type === 'common');
  const optionClasses = classes.filter((c) => c.type === 'option');

  const breakpointSet = new Map<number, Breakpoint>();

  // Helper to add or get a breakpoint
  const getOrCreateBP = (value: number, description: string): Breakpoint => {
    // Round to avoid floating point duplicates
    const rounded = Math.round(value * 100) / 100;
    if (!breakpointSet.has(rounded)) {
      breakpointSet.set(rounded, {
        equityValue: rounded,
        description,
        cumulativePreference: 0,
        participants: [],
      });
    }
    return breakpointSet.get(rounded)!;
  };

  // ── Breakpoint 0: Zero value ──
  getOrCreateBP(0, 'Zero equity value');

  // ── Breakpoints from liquidation preferences ──
  let cumulativePref = 0;
  for (const pref of preferredClasses) {
    if (pref.liquidationPref > 0) {
      cumulativePref += pref.liquidationPref;
      const bp = getOrCreateBP(
        cumulativePref,
        `Liquidation preference satisfied: ${pref.name}`
      );
      bp.cumulativePreference = cumulativePref;
    }
  }

  // ── Breakpoints from conversion points ──
  // For each preferred class, find the equity value at which converting
  // to common yields more than the liquidation preference
  for (const pref of preferredClasses) {
    if (pref.liquidationPref > 0 && pref.asIfCommonShares > 0) {
      // At conversion point: pref's share of common pool = liq pref
      // prefAsConverted / fullyDiluted * equityAboveAllPrefs = liqPref
      // Only relevant for non-participating or capped participating
      const prefProRataShare = pref.asIfCommonShares / fullyDiluted;

      if (prefProRataShare > 0) {
        // Total pref amount that must be paid before common participates
        const totalPrefAmount = preferredClasses.reduce(
          (sum, p) => sum + p.liquidationPref, 0
        );

        // Conversion breakpoint: equity value where converting is better
        // For non-participating: conversionBP = totalPrefs + liqPref / prefShare
        // At this point: prefShare * (E - totalPrefs) = liqPref
        // E = totalPrefs + liqPref / prefShare
        if (!pref.isParticipating) {
          const conversionBP = totalPrefAmount + pref.liquidationPref / prefProRataShare;
          getOrCreateBP(
            conversionBP,
            `Conversion point: ${pref.name} (non-participating)`
          );
        }
      }
    }
  }

  // ── Breakpoints from participation caps ──
  for (const pref of preferredClasses) {
    if (pref.isParticipating && pref.participationCap > 0 && pref.shares > 0) {
      // Participation cap = multiple of original investment
      // Total cap = participationCap * liquidationPref (often cap is expressed as multiple)
      // Cap reached when: liqPref + proRata * (E - totalPrefs) = cap * liqPref
      const totalPrefAmount = preferredClasses.reduce(
        (sum, p) => sum + p.liquidationPref, 0
      );
      const prefProRataShare = pref.asIfCommonShares / fullyDiluted;
      const capAmount = pref.participationCap * pref.liquidationPref;
      const additionalNeeded = capAmount - pref.liquidationPref;

      if (prefProRataShare > 0 && additionalNeeded > 0) {
        const capBP = totalPrefAmount + additionalNeeded / prefProRataShare;
        getOrCreateBP(capBP, `Participation cap reached: ${pref.name}`);
      }
    }
  }

  // ── Breakpoints from option strike prices ──
  for (const opt of optionClasses) {
    if (opt.strikePrice > 0 && opt.shares > 0) {
      // Options enter the money when per-share value exceeds strike
      // Need to figure out at what total equity value this happens
      // Approximate: strike * fullyDiluted (simplified)
      // More precisely: this is handled in the tranche allocation
      // We add the aggregate strike value as a breakpoint reference
      const totalPrefAmount = preferredClasses.reduce(
        (sum, p) => sum + p.liquidationPref, 0
      );
      const strikeBP = totalPrefAmount + opt.strikePrice * fullyDiluted;
      if (strikeBP > 0) {
        getOrCreateBP(strikeBP, `Options in the money: ${opt.name}`);
      }
    }
  }

  // ── Sort breakpoints and compute tranche allocations ──
  const sortedBPs = Array.from(breakpointSet.values()).sort(
    (a, b) => a.equityValue - b.equityValue
  );

  // Compute participants for each tranche (between consecutive breakpoints)
  for (let i = 0; i < sortedBPs.length; i++) {
    const bpValue = sortedBPs[i].equityValue;
    sortedBPs[i].participants = computeParticipants(
      bpValue,
      classes,
      preferredClasses,
      commonClasses,
      optionClasses,
      fullyDiluted
    );
  }

  return sortedBPs;
}

/**
 * Determine which classes participate in the marginal dollar above a given
 * equity value level, and their allocation percentages.
 */
function computeParticipants(
  equityValue: number,
  allClasses: ParsedClass[],
  preferredClasses: ParsedClass[],
  commonClasses: ParsedClass[],
  optionClasses: ParsedClass[],
  fullyDiluted: number
): BreakpointParticipant[] {
  const participants: BreakpointParticipant[] = [];

  // Determine cumulative preferences
  const totalPref = preferredClasses.reduce((s, p) => s + p.liquidationPref, 0);

  if (equityValue < totalPref) {
    // We're in the liquidation preference waterfall
    let remaining = equityValue;
    let cumulativePaid = 0;

    // Group by seniority
    const seniorityGroups = new Map<number, ParsedClass[]>();
    for (const p of preferredClasses) {
      const group = seniorityGroups.get(p.seniorityLevel) || [];
      group.push(p);
      seniorityGroups.set(p.seniorityLevel, group);
    }

    const sortedLevels = Array.from(seniorityGroups.keys()).sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const group = seniorityGroups.get(level)!;
      const groupPref = group.reduce((s, g) => s + g.liquidationPref, 0);

      if (cumulativePaid + groupPref <= equityValue) {
        // This group is fully paid, doesn't receive marginal dollars here
        cumulativePaid += groupPref;
      } else {
        // This group receives the marginal dollar
        // Allocate pro-rata within the group by liquidation preference
        for (const p of group) {
          if (groupPref > 0) {
            participants.push({
              shareClassId: p.id,
              shareClassName: p.name,
              allocationPercent: p.liquidationPref / groupPref,
              sharesInTranche: p.shares,
            });
          }
        }
        break;
      }
    }
  } else {
    // Above all liquidation preferences - common/converted pool
    // Check which preferred have converted vs staying as preferred
    const participatingPrefs: ParsedClass[] = [];
    const convertedPrefs: ParsedClass[] = [];

    for (const pref of preferredClasses) {
      if (!pref.isParticipating) {
        // Non-participating: check if conversion is better
        const proRataShare = pref.asIfCommonShares / fullyDiluted;
        const commonValue = proRataShare * (equityValue - totalPref);
        if (commonValue >= pref.liquidationPref) {
          convertedPrefs.push(pref);
        }
        // If not yet at conversion point, preferred just keeps liq pref
        // and doesn't participate in upside
      } else {
        // Participating preferred
        if (pref.participationCap > 0) {
          const capAmount = pref.participationCap * pref.liquidationPref;
          const proRataShare = pref.asIfCommonShares / fullyDiluted;
          const participationValue = pref.liquidationPref + proRataShare * (equityValue - totalPref);

          if (participationValue >= capAmount) {
            // Cap reached, treat as converted
            convertedPrefs.push(pref);
          } else {
            participatingPrefs.push(pref);
          }
        } else {
          // Uncapped participating
          participatingPrefs.push(pref);
        }
      }
    }

    // Calculate pro-rata shares for the common pool
    // Includes: common, converted preferred, participating preferred, in-the-money options
    let poolShares = 0;
    const poolMembers: { id: string; name: string; shares: number }[] = [];

    for (const c of commonClasses) {
      poolShares += c.asIfCommonShares;
      poolMembers.push({ id: c.id, name: c.name, shares: c.asIfCommonShares });
    }

    for (const p of convertedPrefs) {
      poolShares += p.asIfCommonShares;
      poolMembers.push({ id: p.id, name: p.name, shares: p.asIfCommonShares });
    }

    for (const p of participatingPrefs) {
      poolShares += p.asIfCommonShares;
      poolMembers.push({ id: p.id, name: p.name, shares: p.asIfCommonShares });
    }

    for (const o of optionClasses) {
      // Options participate if in the money
      if (o.shares > 0) {
        poolShares += o.asIfCommonShares;
        poolMembers.push({ id: o.id, name: o.name, shares: o.asIfCommonShares });
      }
    }

    if (poolShares > 0) {
      for (const member of poolMembers) {
        participants.push({
          shareClassId: member.id,
          shareClassName: member.name,
          allocationPercent: member.shares / poolShares,
          sharesInTranche: member.shares,
        });
      }
    }
  }

  return participants;
}

/**
 * Get the fully diluted share count for each class (as-converted basis).
 */
export function getFullyDilutedByClass(
  shareClasses: ShareClass[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const sc of shareClasses) {
    const vestedShares = sc.sharesOutstanding * (sc.vestingPercent / 100);
    let asConverted: number;

    if (sc.type === 'option') {
      asConverted = vestedShares;
    } else if (sc.type === 'preferred') {
      asConverted = vestedShares * sc.conversionRatio;
    } else {
      asConverted = vestedShares;
    }

    result.set(sc.id, asConverted);
  }
  return result;
}
