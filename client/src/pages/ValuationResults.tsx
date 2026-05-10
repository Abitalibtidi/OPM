import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  PieChart,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Info,
  BarChart2,
  Calculator,
} from 'lucide-react';

type DLOMModelName = 'finnerty' | 'ghaidarov' | 'chaffe' | 'longstaff';

interface DLOMModelResult {
  modelName: DLOMModelName;
  dlomPercentage: number;
  description: string;
}

const DLOM_MODEL_LABELS: Record<DLOMModelName, string> = {
  finnerty: 'Finnerty (2012)',
  ghaidarov: 'Ghaidarov (2009)',
  chaffe: 'Chaffe (1993)',
  longstaff: 'Longstaff (1995) — upper bound',
};

interface Result {
  id: string;
  shareClassId: string;
  optionValue: number;
  perShareValue: number;
  totalValue: number;
  allocationPercent: number;
  fullyDilutedShares: number;
  shareClass: {
    name: string;
    type: string;
    sharesOutstanding: number;
  };
}

interface BreakpointParticipant {
  shareClassId: string;
  shareClassName: string;
  allocationPercent: number;
  sharesInTranche: number;
}

interface WaterfallBreakpoint {
  id: string;
  equityValue: number;
  description: string;
  cumulativePreference: number;
  participants: string; // JSON
  sortOrder: number;
}

interface TrancheAllocation {
  shareClassId: string;
  shareClassName: string;
  percent: number;
  value: number;
}

interface WaterfallTranche {
  id: string;
  lowerBreakpoint: number;
  upperBreakpoint: number | null;
  callValueLower: number;
  callValueUpper: number;
  trancheValue: number;
  allocations: string; // JSON
  sortOrder: number;
}

interface Valuation {
  id: string;
  name: string;
  companyName: string;
  valuationDate: string;
  totalEquityValue: number;
  volatility: number;
  riskFreeRate: number;
  term: number;
  dividendYield: number;
  backsolveTargetPPS: number | null;
  valuationResults: Result[];
  breakpointRecords: WaterfallBreakpoint[];
  trancheRecords: WaterfallTranche[];
  shareClasses: any[];
}

function formatCurrency(v: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

function formatNumber(v: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

function formatPercent(v: number) {
  return (v * 100).toFixed(2) + '%';
}

const CLASS_COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-red-500',
];

interface ZoneInfo {
  label: string;
  hint: string;
  accentBorder: string;
  badge: string;
  headerBg: string;
}

function classifyZone(description: string | undefined, allocTypes: Set<string>): ZoneInfo {
  const types = [...allocTypes];
  const hasPreferred = types.some(t => t === 'preferred');
  const hasCommon = types.some(t => t === 'common');
  const hasOption = types.some(t => t === 'option');
  const d = (description ?? '').toLowerCase();

  // Pure preferred — liquidation preference zone
  if (hasPreferred && !hasCommon && !hasOption) {
    return {
      label: 'Liquidation Preference Zone',
      hint: 'Preferred shareholders receive their liquidation preference here — before any value flows to common stockholders. This is their contractual "first in line" protection.',
      accentBorder: 'border-l-blue-400',
      badge: 'bg-blue-100 text-blue-700',
      headerBg: 'bg-blue-50',
    };
  }

  // Mixed preferred + common/option — participating preferred shares value with common
  if (hasPreferred && (hasCommon || hasOption)) {
    return {
      label: 'Participation Zone',
      hint: 'Participating preferred shareholders join common stockholders in sharing value here, on top of having already received their liquidation preference. Their share is proportional to their as-converted share count.',
      accentBorder: 'border-l-indigo-400',
      badge: 'bg-indigo-100 text-indigo-700',
      headerBg: 'bg-indigo-50',
    };
  }

  // Post-cap: a participating preferred just hit its return cap and was reclassified as common
  if (d.includes('participation cap')) {
    return {
      label: 'Post-Cap Common Zone',
      hint: 'A participating preferred class has reached its return cap and is now treated as if it converted to common. All classes shown split this value pro-rata based on as-converted share counts.',
      accentBorder: 'border-l-purple-400',
      badge: 'bg-purple-100 text-purple-700',
      headerBg: 'bg-purple-50',
    };
  }

  // Options-only or options + common
  if (hasOption && !hasPreferred) {
    return {
      label: 'Options Participation Zone',
      hint: 'Vested stock options are in-the-money and participate alongside common shares. Option holders receive this value net of their strike price — meaning the strike is subtracted from the per-share value.',
      accentBorder: 'border-l-amber-400',
      badge: 'bg-amber-100 text-amber-700',
      headerBg: 'bg-amber-50',
    };
  }

  // All common (including converted preferred) — upside zone
  const isPostConversion = d.includes('conversion point');
  return {
    label: 'Common Upside Zone',
    hint: isPostConversion
      ? 'Preferred shareholders have now converted to common — converting yields more than their liquidation preference at this equity level. All classes here share the upside pro-rata based on as-converted share counts.'
      : 'All liquidation preferences and participation rights have been satisfied. Value here flows pro-rata to common shareholders and any preferred that has converted to common.',
    accentBorder: 'border-l-green-400',
    badge: 'bg-green-100 text-green-700',
    headerBg: 'bg-green-50',
  };
}

export default function ValuationResults() {
  const { id } = useParams<{ id: string }>();
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [showWaterfall, setShowWaterfall] = useState(true);
  const [showDLOM, setShowDLOM] = useState(false);
  const [dlomVolatility, setDlomVolatility] = useState(0);
  const [dlomPeriod, setDlomPeriod] = useState(0);
  const [dlomRate, setDlomRate] = useState(0);
  const [dlomResults, setDlomResults] = useState<DLOMModelResult[] | null>(null);
  const [selectedModel, setSelectedModel] = useState<DLOMModelName>('finnerty');
  const [dlomEnabled, setDlomEnabled] = useState<Record<string, boolean>>({});
  const [calculating, setCalculating] = useState(false);
  const [dlomError, setDlomError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Valuation>(`/valuations/${id}`);
        setValuation(data);
        setDlomVolatility(data.volatility);
        setDlomPeriod(data.term);
        setDlomRate(data.riskFreeRate);
        // Default: DLOM applied to common only
        const defaults: Record<string, boolean> = {};
        for (const sc of data.shareClasses) {
          defaults[sc.id] = sc.type === 'common';
        }
        setDlomEnabled(defaults);
        // Load any previously saved DLOM results
        try {
          const saved = await api.get<any[]>(`/valuations/${id}/dlom`);
          if (saved.length > 0) {
            const byModel: Record<string, DLOMModelResult> = {};
            for (const r of saved) {
              byModel[r.modelName] = {
                modelName: r.modelName as DLOMModelName,
                dlomPercentage: r.dlomPercentage,
                description: '',
              };
            }
            const ordered: DLOMModelName[] = ['finnerty', 'ghaidarov', 'chaffe', 'longstaff'];
            const results = ordered.filter(m => byModel[m]).map(m => byModel[m]);
            if (results.length > 0) setDlomResults(results);
          }
        } catch {
          // No saved DLOM results yet — ignore
        }
      } catch (err) {
        console.error('Failed to load:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleExport(format: 'pdf' | 'excel') {
    setDownloading(format);
    try {
      const blob = await api.getBlob(`/valuations/${id}/export/${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${valuation?.name || 'valuation'}_OPM_Report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setDownloading('');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!valuation) {
    return <div className="text-center py-12 text-red-600">Valuation not found</div>;
  }

  const results = valuation.valuationResults;
  const totalAllocated = results.reduce((s, r) => s + r.totalValue, 0);
  const hasResults = results.length > 0;

  // Lookup maps used by the waterfall section
  const classColorMap = new Map<string, number>(results.map((r, i) => [r.shareClassId, i]));
  const shareClassTypeMap = new Map<string, string>(
    valuation.shareClasses.map((sc: any) => [sc.id as string, sc.type as string])
  );
  const breakpointDescMap = new Map<number, string>(
    valuation.breakpointRecords.map((bp) => [bp.equityValue, bp.description])
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/valuations/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Valuation Results</h1>
            <p className="text-sm text-gray-500">{valuation.name} &middot; {valuation.companyName}</p>
          </div>
        </div>
        {hasResults && (
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={downloading === 'pdf'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {downloading === 'pdf' ? 'Generating...' : 'Export PDF'}
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={downloading === 'excel'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {downloading === 'excel' ? 'Generating...' : 'Export Excel'}
            </button>
          </div>
        )}
      </div>

      {!hasResults ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <PieChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No Results Yet</h3>
          <p className="text-gray-500 mt-1 mb-4">Run the OPM calculation first to see results.</p>
          <Link
            to={`/valuations/${id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go to Editor
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Total Equity Value
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(valuation.totalEquityValue, 0)}</div>
              {valuation.backsolveTargetPPS && (
                <div className="text-xs text-purple-600 mt-1">Via backsolve</div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <PieChart className="h-4 w-4" />
                Total Allocated
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalAllocated, 0)}</div>
              <div className="text-xs text-gray-400 mt-1">
                Reconciliation: {formatPercent(valuation.totalEquityValue > 0 ? totalAllocated / valuation.totalEquityValue : 0)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Download className="h-4 w-4" />
                Assumptions
              </div>
              <div className="text-sm space-y-0.5 text-gray-700 mt-1">
                <div>Vol: {formatPercent(valuation.volatility)}</div>
                <div>Rate: {formatPercent(valuation.riskFreeRate)} &middot; Term: {valuation.term}y</div>
              </div>
            </div>
          </div>

          {/* Allocation Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Value Allocation</h2>
            <div className="w-full h-8 rounded-full overflow-hidden flex bg-gray-100">
              {results.filter(r => r.allocationPercent > 0).map((r, i) => (
                <div
                  key={r.id}
                  className={`${CLASS_COLORS[i % CLASS_COLORS.length]} h-full transition-all`}
                  style={{ width: `${Math.max(r.allocationPercent * 100, 1)}%` }}
                  title={`${r.shareClass.name}: ${formatPercent(r.allocationPercent)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {results.filter(r => r.allocationPercent > 0).map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${CLASS_COLORS[i % CLASS_COLORS.length]}`} />
                  <span className="text-gray-700">{r.shareClass.name}</span>
                  <span className="text-gray-400">{formatPercent(r.allocationPercent)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Value Waterfall */}
          {valuation.trancheRecords.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Collapsible header */}
              <button
                onClick={() => setShowWaterfall(!showWaterfall)}
                className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-900">Value Waterfall</h2>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Step-by-step: how equity value flows through the capital structure &mdash; {valuation.trancheRecords.length} zones
                  </p>
                </div>
                {showWaterfall
                  ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
              </button>

              {showWaterfall && (
                <div className="p-6">
                  {/* How-to-read explanation */}
                  <div className="mb-6 flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-900">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <span className="font-semibold">How to read this: </span>
                      The OPM divides total equity value into zones. Value in each zone is distributed only
                      among the share classes whose economic rights are active in that range. Zones at the
                      bottom of the waterfall (low equity values) are claimed first — typically by preferred
                      shareholders. Any remaining upside flows upward to common stockholders.
                    </div>
                  </div>

                  {/* Zone cards */}
                  {valuation.trancheRecords.map((tr, i) => {
                    const allocations: TrancheAllocation[] = JSON.parse(tr.allocations);
                    const bpDesc = breakpointDescMap.get(tr.lowerBreakpoint);
                    const allocTypes = new Set(
                      allocations.map(a => shareClassTypeMap.get(a.shareClassId) ?? 'common')
                    );
                    const zone = classifyZone(bpDesc, allocTypes);
                    const upperLabel = tr.upperBreakpoint == null
                      ? '∞'
                      : formatCurrency(tr.upperBreakpoint, 0);

                    return (
                      <div key={tr.id}>
                        {/* Connector between cards */}
                        {i > 0 && (
                          <div className="flex flex-col items-center my-1">
                            <div className="w-px h-4 bg-gray-200" />
                            <ChevronDown className="h-4 w-4 text-gray-300 -mt-1" />
                          </div>
                        )}

                        {/* Zone card */}
                        <div className={`rounded-xl border border-gray-200 overflow-hidden border-l-4 ${zone.accentBorder}`}>

                          {/* Card header: zone badge + equity range */}
                          <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${zone.headerBg}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${zone.badge}`}>
                                {zone.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                Zone {i + 1} of {valuation.trancheRecords.length}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                              Equity &nbsp;{formatCurrency(tr.lowerBreakpoint, 0)}&nbsp;&rarr;&nbsp;{upperLabel}
                            </span>
                          </div>

                          {/* Card body */}
                          <div className="px-4 py-4 space-y-4">

                            {/* Value distributed */}
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Value distributed in this zone
                              </span>
                              <span className="text-xl font-bold text-gray-900 font-mono">
                                {formatCurrency(tr.trancheValue, 0)}
                              </span>
                            </div>

                            {/* Per-class allocation rows */}
                            <div className="space-y-3">
                              {allocations.map((a, ai) => {
                                const colorIdx = classColorMap.get(a.shareClassId) ?? ai;
                                const color = CLASS_COLORS[colorIdx % CLASS_COLORS.length];
                                return (
                                  <div key={a.shareClassId}>
                                    {/* Name + amounts */}
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                                        {a.shareClassName}
                                      </span>
                                      <span className="text-sm font-semibold text-gray-900 font-mono">
                                        {formatCurrency(a.value, 0)}
                                      </span>
                                      <span className="text-xs text-gray-500 font-mono w-14 text-right">
                                        {formatPercent(a.percent)}
                                      </span>
                                    </div>
                                    {/* Allocation bar */}
                                    <div className="ml-[18px] h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${color}`}
                                        style={{ width: `${Math.max(a.percent * 100, 1)}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Plain-language hint */}
                            <div className="flex gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                              <span>{zone.hint}</span>
                            </div>

                            {/* Technical footnote: Black-Scholes call spread */}
                            <div className="text-xs text-gray-400 font-mono flex flex-wrap gap-x-5 gap-y-1 pt-1 border-t border-gray-100">
                              <span title="Black-Scholes call option value at the lower equity bound">
                                C(low) = {formatCurrency(tr.callValueLower)}
                              </span>
                              <span title="Black-Scholes call option value at the upper equity bound">
                                C(high) = {formatCurrency(tr.callValueUpper)}
                              </span>
                              <span title="Tranche value = C(low) − C(high), the call spread">
                                Spread = {formatCurrency(tr.trancheValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Results Table */}
          {(() => {
            // Compute exercise proceeds: for option classes, grossValue − perShare × shares.
            // After the engine fix, totalValue IS the gross OPM allocation, so:
            //   exerciseProceeds = totalValue − perShareValue × fullyDilutedShares
            const totalExerciseProceeds = results
              .filter(r => r.shareClass.type === 'option')
              .reduce((s, r) => s + (r.totalValue - r.perShareValue * r.fullyDilutedShares), 0);
            const hasOptions = results.some(r => r.shareClass.type === 'option');

            return (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Per-Class Results</h2>
                  <p className="text-xs text-gray-400 mt-0.5">OPM gross allocation — all classes sum to total equity value</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FD Shares</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">OPM Allocation</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FMV / Share</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net to Holders</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Allocation %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.map((r) => {
                        const netToHolders = r.perShareValue * r.fullyDilutedShares;
                        const isOption = r.shareClass.type === 'option';
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.shareClass.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 capitalize">{r.shareClass.type}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatNumber(r.fullyDilutedShares)}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatCurrency(r.totalValue)}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono font-semibold">{formatCurrency(r.perShareValue, 4)}</td>
                            <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${isOption ? 'text-gray-500' : 'text-gray-900'}`}>
                              {formatCurrency(netToHolders)}
                              {isOption && <span className="text-xs text-gray-400 ml-1">net</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatPercent(r.allocationPercent)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 text-sm font-semibold divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-3 text-gray-900" colSpan={3}>Total OPM Allocation</td>
                        <td className="px-6 py-3 text-gray-900 text-right font-mono">{formatCurrency(totalAllocated)}</td>
                        <td />
                        <td className="px-6 py-3 text-gray-500 text-right font-mono text-xs font-normal">
                          {hasOptions && `${formatCurrency(totalAllocated - totalExerciseProceeds)} net`}
                        </td>
                        <td className="px-6 py-3 text-gray-900 text-right font-mono">100.00%</td>
                      </tr>
                      {hasOptions && totalExerciseProceeds > 0.005 && (
                        <tr className="font-normal text-xs text-gray-400">
                          <td className="px-6 py-2" colSpan={3}>Less: option exercise proceeds</td>
                          <td className="px-6 py-2 text-right font-mono">({formatCurrency(totalExerciseProceeds)})</td>
                          <td colSpan={3} />
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
                {hasOptions && (
                  <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                    OPM Allocation is the gross waterfall value captured by each class. For options, Net to Holders = OPM Allocation − exercise proceeds (strike × shares). Exercise proceeds flow back to the company and do not reduce the total equity value.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Methodology Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Methodology Note</p>
            <p>
              Values are calculated using the Option Pricing Model (OPM) as described in the AICPA Accounting
              and Valuation Guide. The model uses Black-Scholes option pricing to allocate equity value across
              share classes based on their economic rights in the capital structure waterfall. This approach is
              consistent with IPEV valuation principles for privately-held company equity.
            </p>
          </div>

          {/* ── DLOM Summary ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowDLOM(!showDLOM)}
              className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">DLOM Summary</h2>
                  {dlomResults && (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Calculated
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">
                  Discount for Lack of Marketability — AICPA Valuation Advisory #4
                </p>
              </div>
              {showDLOM
                ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
            </button>

            {showDLOM && (
              <div className="p-6 space-y-6">

                {/* ── Inputs ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Model Inputs</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Volatility</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={Math.round(dlomVolatility * 10000) / 100}
                          onChange={e => setDlomVolatility(parseFloat(e.target.value) / 100 || 0)}
                          step={1}
                          min={1}
                          max={500}
                          className="w-full px-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Pre-filled from OPM assumptions</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Holding Period</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={dlomPeriod}
                          onChange={e => setDlomPeriod(parseFloat(e.target.value) || 0)}
                          step={0.5}
                          min={0.1}
                          max={30}
                          className="w-full px-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">yr</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Expected restriction period</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Risk-Free Rate</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={Math.round(dlomRate * 10000) / 100}
                          onChange={e => setDlomRate(parseFloat(e.target.value) / 100 || 0)}
                          step={0.1}
                          min={0}
                          max={100}
                          className="w-full px-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Used by Chaffe &amp; Ghaidarov only</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        setCalculating(true);
                        setDlomError('');
                        try {
                          const res = await api.post<{ results: DLOMModelResult[] }>(`/valuations/${id}/dlom`, {
                            volatility: dlomVolatility,
                            holdingPeriod: dlomPeriod,
                            riskFreeRate: dlomRate,
                          });
                          setDlomResults(res.results);
                        } catch (err: any) {
                          setDlomError(err.message ?? 'Calculation failed');
                        } finally {
                          setCalculating(false);
                        }
                      }}
                      disabled={calculating}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                      {calculating ? 'Calculating…' : 'Calculate DLOM'}
                    </button>
                    {dlomError && (
                      <span className="text-sm text-red-600 flex items-center gap-1">
                        <Info className="h-4 w-4" /> {dlomError}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Model Results ── */}
                {dlomResults && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Model Results
                        <span className="ml-2 text-xs font-normal text-gray-400">— select one to apply to value summary</span>
                      </h3>
                      <div className="space-y-2">
                        {dlomResults.map((r) => (
                          <label
                            key={r.modelName}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedModel === r.modelName
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="dlomModel"
                              value={r.modelName}
                              checked={selectedModel === r.modelName}
                              onChange={() => setSelectedModel(r.modelName)}
                              className="text-primary-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {DLOM_MODEL_LABELS[r.modelName]}
                                </span>
                                <span className={`text-base font-bold font-mono ${
                                  r.modelName === 'longstaff' ? 'text-amber-600' : 'text-gray-900'
                                }`}>
                                  {(r.dlomPercentage * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{r.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── Per-class DLOM toggle ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Apply DLOM to Classes</h3>
                      <p className="text-xs text-gray-400 mb-3">
                        Toggle which share classes receive the DLOM adjustment. Preferred stock typically does not receive a DLOM in 409A analyses.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.map((r) => (
                          <label
                            key={r.shareClassId}
                            className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={dlomEnabled[r.shareClassId] ?? false}
                              onChange={(e) => setDlomEnabled((prev) => ({
                                ...prev,
                                [r.shareClassId]: e.target.checked,
                              }))}
                              className="rounded text-primary-600"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-800 font-medium">{r.shareClass.name}</span>
                              <span className="ml-2 text-xs text-gray-400 capitalize">{r.shareClass.type}</span>
                            </div>
                            {dlomEnabled[r.shareClassId] && (
                              <span className="text-xs font-mono text-primary-600">
                                −{(dlomResults.find(m => m.modelName === selectedModel)!.dlomPercentage * 100).toFixed(1)}%
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── Final Value Summary ── */}
                    {(() => {
                      const activeDLOM = dlomResults.find(m => m.modelName === selectedModel)!.dlomPercentage;
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">
                              Final Value Summary
                              <span className="ml-2 text-xs font-normal text-gray-400">
                                — {DLOM_MODEL_LABELS[selectedModel]}, {(activeDLOM * 100).toFixed(1)}% DLOM
                              </span>
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="border-b-2 border-gray-200">
                                  {[
                                    ['Share Class', 'left'],
                                    ['Type', 'left'],
                                    ['OPM FMV/Share', 'right'],
                                    ['DLOM Applied', 'center'],
                                    ['DLOM %', 'right'],
                                    ['Adj FMV/Share', 'right'],
                                    ['FD Shares', 'right'],
                                    ['Adjusted Total', 'right'],
                                  ].map(([label, align]) => (
                                    <th
                                      key={label}
                                      className={`px-3 py-2 text-${align} text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap`}
                                    >
                                      {label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {results.map((r) => {
                                  const applyDLOM = dlomEnabled[r.shareClassId] ?? false;
                                  const adjPPS = applyDLOM
                                    ? r.perShareValue * (1 - activeDLOM)
                                    : r.perShareValue;
                                  const adjTotal = adjPPS * r.fullyDilutedShares;
                                  return (
                                    <tr key={r.shareClassId} className="border-b border-gray-100 hover:bg-gray-50">
                                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                                        {r.shareClass.name}
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-500 capitalize">{r.shareClass.type}</td>
                                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                                        {formatCurrency(r.perShareValue, 4)}
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        {applyDLOM ? (
                                          <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Yes</span>
                                        ) : (
                                          <span className="text-xs text-gray-400">No</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono">
                                        {applyDLOM
                                          ? <span className="text-primary-600">−{(activeDLOM * 100).toFixed(1)}%</span>
                                          : <span className="text-gray-300">—</span>
                                        }
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                                        {formatCurrency(adjPPS, 4)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                                        {formatNumber(r.fullyDilutedShares)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                                        {formatCurrency(adjTotal, 0)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-gray-50">
                                <tr className="border-t-2 border-gray-200">
                                  <td colSpan={7} className="px-3 py-2.5 text-sm font-semibold text-gray-700">
                                    Total Adjusted Equity Value
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">
                                    {formatCurrency(results.reduce((s, r) => {
                                      const applyDLOM = dlomEnabled[r.shareClassId] ?? false;
                                      const adjPPS = applyDLOM ? r.perShareValue * (1 - activeDLOM) : r.perShareValue;
                                      return s + adjPPS * r.fullyDilutedShares;
                                    }, 0), 0)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* AICPA reference */}
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2 text-xs text-amber-800">
                            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                            <span>
                              Per AICPA Valuation Advisory #4, DLOM is typically applied to common stock and options.
                              The Longstaff model represents an upper bound and is shown for reference only.
                              Finnerty and Ghaidarov are the most commonly cited models for 409A purposes.
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
