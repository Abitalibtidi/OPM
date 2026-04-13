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
} from 'lucide-react';

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

export default function ValuationResults() {
  const { id } = useParams<{ id: string }>();
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Valuation>(`/valuations/${id}`);
        setValuation(data);
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

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Per-Class Results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FD Shares</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Option Value</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Per Share</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.shareClass.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 capitalize">{r.shareClass.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatNumber(r.fullyDilutedShares)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatCurrency(r.optionValue)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono font-semibold">{formatCurrency(r.perShareValue, 4)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono font-semibold">{formatCurrency(r.totalValue)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">{formatPercent(r.allocationPercent)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={5}>Total</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">{formatCurrency(totalAllocated)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">100.00%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

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
        </>
      )}
    </div>
  );
}
