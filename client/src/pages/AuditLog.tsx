import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user?: { name: string; email: string };
  valuation?: { name: string; companyName: string };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  valuation_created: { label: 'Created', color: 'bg-green-100 text-green-700' },
  valuation_updated: { label: 'Updated', color: 'bg-blue-100 text-blue-700' },
  valuation_calculated: { label: 'Calculated', color: 'bg-purple-100 text-purple-700' },
  valuation_backsolve: { label: 'Backsolve', color: 'bg-indigo-100 text-indigo-700' },
  valuation_status_changed: { label: 'Status Changed', color: 'bg-yellow-100 text-yellow-700' },
  valuation_exported: { label: 'Exported', color: 'bg-cyan-100 text-cyan-700' },
  share_class_added: { label: 'Class Added', color: 'bg-emerald-100 text-emerald-700' },
  share_class_updated: { label: 'Class Updated', color: 'bg-teal-100 text-teal-700' },
  share_class_deleted: { label: 'Class Deleted', color: 'bg-red-100 text-red-700' },
  user_login: { label: 'Login', color: 'bg-gray-100 text-gray-700' },
  user_created: { label: 'User Created', color: 'bg-green-100 text-green-700' },
};

export default function AuditLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<{ data: LogEntry[]; total: number }>(
          `/audit-log?page=${page}&pageSize=${pageSize}`
        );
        setEntries(res.data);
        setTotal(res.total);
      } catch (err) {
        console.error('Failed to load audit log:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Complete history of all actions and changes. {total} entries total.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No audit entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valuation</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => {
                  const actionConfig = ACTION_LABELS[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {entry.user?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${actionConfig.color}`}>
                          {actionConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {entry.valuation?.name || '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {entry.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
