import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Archive,
  Search,
} from 'lucide-react';

interface Valuation {
  id: string;
  name: string;
  companyName: string;
  valuationDate: string;
  status: string;
  totalEquityValue: number;
  updatedAt: string;
  createdBy?: { name: string };
  _count?: { valuationResults: number };
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  draft: { icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  in_review: { icon: AlertCircle, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  approved: { icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  archived: { icon: Archive, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadValuations();
  }, [statusFilter]);

  async function loadValuations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('pageSize', '100');
      const res = await api.get<{ data: Valuation[] }>(`/valuations?${params}`);
      setValuations(res.data);
    } catch (err) {
      console.error('Failed to load valuations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const v = await api.post<Valuation>('/valuations', {
        name: newName,
        companyName: newCompany,
        valuationDate: newDate,
      });
      navigate(`/valuations/${v.id}`);
    } catch (err) {
      console.error('Failed to create valuation:', err);
    } finally {
      setCreating(false);
    }
  }

  const filtered = valuations.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.companyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Valuations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.name}. {filtered.length} valuation{filtered.length !== 1 ? 's' : ''} found.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Valuation
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search valuations..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Valuation Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No valuations found</h3>
          <p className="text-gray-500 mt-1">Create your first valuation to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const sc = statusConfig[v.status] || statusConfig.draft;
            const StatusIcon = sc.icon;
            return (
              <Link
                key={v.id}
                to={`/valuations/${v.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 truncate pr-2">{v.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {v.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{v.companyName}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-gray-500">
                    <DollarSign className="h-3.5 w-3.5" />
                    {v.totalEquityValue > 0 ? formatCurrency(v.totalEquityValue) : 'Not set'}
                  </span>
                  <span className="text-gray-400">{v.valuationDate}</span>
                </div>
                {v.createdBy && (
                  <p className="text-xs text-gray-400 mt-2">By {v.createdBy.name}</p>
                )}
                {v._count && v._count.valuationResults > 0 && (
                  <p className="text-xs text-green-600 mt-1">Results available</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Valuation</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Series B 409A Valuation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Acme Technologies Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
