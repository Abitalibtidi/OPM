// ─── User & Auth ─────────────────────────────────────────────
export type Role = 'analyst' | 'reviewer' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Valuation ───────────────────────────────────────────────
export type ValuationStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface Valuation {
  id: string;
  name: string;
  description?: string;
  companyName: string;
  valuationDate: string;
  status: ValuationStatus;

  // OPM Inputs
  totalEquityValue: number;
  volatility: number;        // as decimal, e.g. 0.60 = 60%
  riskFreeRate: number;       // as decimal, e.g. 0.04 = 4%
  term: number;               // years
  dividendYield: number;      // as decimal

  // Backsolve
  backsolveTargetClassId?: string;
  backsolveTargetPPS?: number;

  createdById: string;
  createdBy?: User;
  shareClasses?: ShareClass[];
  results?: ValuationResult[];
  createdAt: string;
  updatedAt: string;
}

// ─── Capital Structure ───────────────────────────────────────
export type ShareClassType = 'common' | 'preferred' | 'option';
export type LiquidationSeniority = 'senior' | 'pari_passu' | 'junior';

export interface ShareClass {
  id: string;
  valuationId: string;
  name: string;
  type: ShareClassType;
  sharesOutstanding: number;
  issuePrice: number;
  liquidationPreference: number;     // total dollar amount
  isParticipating: boolean;
  participationCap: number;          // multiple (e.g. 3x = 3.0), 0 = uncapped
  conversionRatio: number;           // shares of common per preferred
  seniorityLevel: number;            // 1 = most senior
  liquidationSeniority: LiquidationSeniority;
  strikePrice: number;               // for options only
  vestingPercent: number;            // % vested, 0-100
  sortOrder: number;
}

// ─── Valuation Results ───────────────────────────────────────
export interface ValuationResult {
  id: string;
  valuationId: string;
  shareClassId: string;
  shareClass?: ShareClass;
  optionValue: number;
  perShareValue: number;
  totalValue: number;
  allocationPercent: number;
  fullyDilutedShares: number;
}

export interface Breakpoint {
  equityValue: number;
  description: string;
  cumulativePreference: number;
  participants: BreakpointParticipant[];
}

export interface BreakpointParticipant {
  shareClassId: string;
  shareClassName: string;
  allocationPercent: number;
  sharesInTranche: number;
}

export interface TrancheResult {
  lowerBreakpoint: number;
  upperBreakpoint: number;
  callValueLower: number;
  callValueUpper: number;
  trancheValue: number;
  allocations: {
    shareClassId: string;
    shareClassName: string;
    percent: number;
    value: number;
  }[];
}

export interface OPMCalculationResult {
  breakpoints: Breakpoint[];
  tranches: TrancheResult[];
  results: Omit<ValuationResult, 'id' | 'valuationId'>[];
  totalEquityValue: number;
  inputs: {
    volatility: number;
    riskFreeRate: number;
    term: number;
    dividendYield: number;
  };
}

export interface BacksolveResult extends OPMCalculationResult {
  impliedEquityValue: number;
  targetClassId: string;
  targetPPS: number;
  iterations: number;
  converged: boolean;
}

// ─── Audit Log ───────────────────────────────────────────────
export type AuditAction =
  | 'valuation_created'
  | 'valuation_updated'
  | 'valuation_calculated'
  | 'valuation_backsolve'
  | 'valuation_status_changed'
  | 'valuation_exported'
  | 'share_class_added'
  | 'share_class_updated'
  | 'share_class_deleted'
  | 'user_login'
  | 'user_created';

export interface AuditLogEntry {
  id: string;
  userId: string;
  user?: User;
  valuationId?: string;
  valuation?: Valuation;
  action: AuditAction;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

// ─── API Request/Response ────────────────────────────────────
export interface ApiError {
  error: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
