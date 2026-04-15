import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Save,
  Plus,
  Trash2,
  Calculator,
  Target,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

interface ShareClass {
  id: string;
  name: string;
  type: string;
  sharesOutstanding: number;
  issuePrice: number;
  liquidationPreference: number;
  isParticipating: boolean;
  participationCap: number;
  conversionRatio: number;
  seniorityLevel: number;
  liquidationSeniority: string;
  strikePrice: number;
  vestingPercent: number;
  sortOrder: number;
}

interface Valuation {
  id: string;
  name: string;
  description: string;
  companyName: string;
  valuationDate: string;
  status: string;
  totalEquityValue: number;
  volatility: number;
  riskFreeRate: number;
  term: number;
  dividendYield: number;
  backsolveTargetClassId: string | null;
  backsolveTargetPPS: number | null;
  shareClasses: ShareClass[];
  createdBy: { name: string };
}

function NumberInput({ label, value, onChange, step, min, max, suffix, prefix, help }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; suffix?: string; prefix?: string; help?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step || 'any'}
          min={min}
          max={max}
          className={`w-full py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
      {help && <p className="text-xs text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

export default function ValuationEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [backsolving, setBacksolving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Share class form
  const [showAddClass, setShowAddClass] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<Partial<ShareClass> | null>(null);

  // Backsolve inputs
  const [bsTargetClass, setBsTargetClass] = useState('');
  const [bsTargetPPS, setBsTargetPPS] = useState(0);
  const [showBacksolve, setShowBacksolve] = useState(false);

  const loadValuation = useCallback(async () => {
    try {
      const data = await api.get<Valuation>(`/valuations/${id}`);
      setValuation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadValuation(); }, [loadValuation]);

  async function saveCurrentValues() {
    if (!valuation) return;
    await api.put(`/valuations/${id}`, {
      name: valuation.name,
      companyName: valuation.companyName,
      valuationDate: valuation.valuationDate,
      description: valuation.description,
      totalEquityValue: valuation.totalEquityValue,
      volatility: valuation.volatility,
      riskFreeRate: valuation.riskFreeRate,
      term: valuation.term,
      dividendYield: valuation.dividendYield,
      status: valuation.status,
    });
  }

  async function handleSave() {
    if (!valuation) return;
    setSaving(true);
    setError('');
    try {
      await saveCurrentValues();
      setSuccess('Saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculate() {
    if (!valuation) return;
    setCalculating(true);
    setError('');
    try {
      // Save current form values first so the server uses them
      await saveCurrentValues();
      await api.post(`/valuations/${id}/calculate`);
      setSuccess('Calculation complete! View results.');
      setTimeout(() => setSuccess(''), 5000);
      await loadValuation();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  }

  async function handleBacksolve() {
    if (!valuation) return;
    if (!bsTargetClass || bsTargetPPS <= 0) {
      setError('Select a target class and enter a positive per-share value');
      return;
    }
    setBacksolving(true);
    setError('');
    try {
      // Save current form values first so the server uses them
      await saveCurrentValues();
      const result = await api.post<any>(`/valuations/${id}/backsolve`, {
        targetClassId: bsTargetClass,
        targetPerShareValue: bsTargetPPS,
      });
      setSuccess(`Backsolve complete! Implied equity value: $${result.impliedEquityValue.toLocaleString()}`);
      await loadValuation();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBacksolving(false);
    }
  }

  async function handleAddShareClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass) return;
    try {
      await api.post(`/valuations/${id}/share-classes`, editingClass);
      setShowAddClass(false);
      setEditingClass(null);
      await loadValuation();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateShareClass(classId: string, data: Partial<ShareClass>) {
    try {
      await api.put(`/valuations/${id}/share-classes/${classId}`, data);
      await loadValuation();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteShareClass(classId: string) {
    try {
      await api.delete(`/valuations/${id}/share-classes/${classId}`);
      await loadValuation();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function newShareClassDefaults(): Partial<ShareClass> {
    return {
      name: '',
      type: 'common',
      sharesOutstanding: 0,
      issuePrice: 0,
      liquidationPreference: 0,
      isParticipating: false,
      participationCap: 0,
      conversionRatio: 1,
      seniorityLevel: 1,
      liquidationSeniority: 'pari_passu',
      strikePrice: 0,
      vestingPercent: 100,
      sortOrder: valuation?.shareClasses.length || 0,
    };
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

  const v = valuation;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{v.name}</h1>
          <p className="text-sm text-gray-500">{v.companyName} &middot; {v.valuationDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={v.status}
            onChange={(e) => setValuation({ ...v, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {success}
        </div>
      )}

      {/* OPM Assumptions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">OPM Assumptions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberInput
            label="Total Equity Value"
            value={v.totalEquityValue}
            onChange={(val) => setValuation({ ...v, totalEquityValue: val })}
            prefix="$"
            min={0}
            help="Enter 0 if using backsolve"
          />
          <NumberInput
            label="Equity Volatility"
            value={Math.round(v.volatility * 10000) / 100}
            onChange={(val) => setValuation({ ...v, volatility: val / 100 })}
            suffix="%"
            min={1}
            max={300}
            step={1}
            help="Annual equity volatility"
          />
          <NumberInput
            label="Risk-Free Rate"
            value={Math.round(v.riskFreeRate * 10000) / 100}
            onChange={(val) => setValuation({ ...v, riskFreeRate: val / 100 })}
            suffix="%"
            min={0}
            max={50}
            step={0.1}
            help="Matched to expected term"
          />
          <NumberInput
            label="Expected Term"
            value={v.term}
            onChange={(val) => setValuation({ ...v, term: val })}
            suffix="yrs"
            min={0.1}
            max={30}
            step={0.1}
            help="Time to liquidity event"
          />
          <NumberInput
            label="Dividend Yield"
            value={Math.round(v.dividendYield * 10000) / 100}
            onChange={(val) => setValuation({ ...v, dividendYield: val / 100 })}
            suffix="%"
            min={0}
            max={100}
            step={0.1}
          />
        </div>
      </div>

      {/* Capital Structure */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Capital Structure</h2>
          <button
            onClick={() => { setEditingClass(newShareClassDefaults()); setShowAddClass(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </button>
        </div>

        {v.shareClasses.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No share classes yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {v.shareClasses.map((sc) => (
              <div key={sc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedClass(expandedClass === sc.id ? null : sc.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                      sc.type === 'preferred' ? 'bg-blue-500' : sc.type === 'option' ? 'bg-purple-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <span className="font-medium text-gray-900">{sc.name}</span>
                      <span className="text-xs text-gray-400 ml-2 capitalize">{sc.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{sc.sharesOutstanding.toLocaleString()} shares</span>
                    {sc.liquidationPreference > 0 && (
                      <span className="text-sm text-blue-600">${sc.liquidationPreference.toLocaleString()} LP</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteShareClass(sc.id); }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {expandedClass === sc.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {expandedClass === sc.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <ShareClassForm
                      value={sc}
                      onChange={(data) => handleUpdateShareClass(sc.id, data)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCalculate}
          disabled={calculating || v.shareClasses.length === 0 || v.totalEquityValue <= 0}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calculator className="h-5 w-5" />
          {calculating ? 'Calculating...' : 'Run OPM Calculation'}
        </button>
        <button
          onClick={() => setShowBacksolve(!showBacksolve)}
          disabled={v.shareClasses.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Target className="h-5 w-5" />
          Backsolve
        </button>
        <Link
          to={`/valuations/${id}/results`}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          View Results
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Backsolve Panel */}
      {showBacksolve && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">Backsolve for Implied Equity Value</h3>
          <p className="text-sm text-purple-700 mb-4">
            Given a known per-share value for one class, the backsolve finds the total equity value that produces that price.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-800 mb-1">Target Share Class</label>
              <select
                value={bsTargetClass}
                onChange={(e) => setBsTargetClass(e.target.value)}
                className="w-full px-3 py-2.5 border border-purple-300 rounded-lg bg-white"
              >
                <option value="">Select class...</option>
                {v.shareClasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-800 mb-1">Target Per-Share Value</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={bsTargetPPS}
                  onChange={(e) => setBsTargetPPS(parseFloat(e.target.value) || 0)}
                  min={0}
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2.5 border border-purple-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBacksolve}
                disabled={backsolving}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {backsolving ? 'Solving...' : 'Run Backsolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Share Class Modal */}
      {showAddClass && editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Share Class</h2>
            <form onSubmit={handleAddShareClass}>
              <ShareClassForm
                value={editingClass as ShareClass}
                onChange={(data) => setEditingClass({ ...editingClass, ...data })}
                isNew
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAddClass(false); setEditingClass(null); }}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
                >
                  Add Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareClassForm({ value, onChange, isNew }: {
  value: ShareClass | Partial<ShareClass>;
  onChange: (data: Partial<ShareClass>) => void;
  isNew?: boolean;
}) {
  const sc = value;
  const update = (field: string, val: any) => onChange({ [field]: val });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
        <input
          type="text"
          value={sc.name || ''}
          onChange={(e) => update('name', e.target.value)}
          required={isNew}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g., Series A Preferred"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={sc.type || 'common'}
          onChange={(e) => update('type', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="common">Common</option>
          <option value="preferred">Preferred</option>
          <option value="option">Option</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shares Outstanding</label>
        <input
          type="number"
          value={sc.sharesOutstanding || 0}
          onChange={(e) => update('sharesOutstanding', parseFloat(e.target.value) || 0)}
          min={0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Issue Price ($)</label>
        <input
          type="number"
          value={sc.issuePrice || 0}
          onChange={(e) => update('issuePrice', parseFloat(e.target.value) || 0)}
          min={0}
          step="0.01"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {(sc.type === 'preferred') && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liquidation Preference ($)</label>
            <input
              type="number"
              value={sc.liquidationPreference || 0}
              onChange={(e) => update('liquidationPreference', parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seniority Level</label>
            <input
              type="number"
              value={sc.seniorityLevel || 1}
              onChange={(e) => update('seniorityLevel', parseInt(e.target.value) || 1)}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-0.5">1 = most senior</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Ratio</label>
            <input
              type="number"
              value={sc.conversionRatio || 1}
              onChange={(e) => update('conversionRatio', parseFloat(e.target.value) || 1)}
              min={0}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sc.isParticipating || false}
                onChange={(e) => update('isParticipating', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Participating
            </label>
          </div>
          {sc.isParticipating && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Participation Cap (x)</label>
              <input
                type="number"
                value={sc.participationCap || 0}
                onChange={(e) => update('participationCap', parseFloat(e.target.value) || 0)}
                min={0}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-0.5">0 = uncapped</p>
            </div>
          )}
        </>
      )}

      {sc.type === 'option' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Strike Price ($)</label>
            <input
              type="number"
              value={sc.strikePrice || 0}
              onChange={(e) => update('strikePrice', parseFloat(e.target.value) || 0)}
              min={0}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vesting %</label>
            <input
              type="number"
              value={sc.vestingPercent || 100}
              onChange={(e) => update('vestingPercent', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
