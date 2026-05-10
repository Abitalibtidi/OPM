import { useState } from 'react';
import { AlertCircle, CheckCircle, Upload, X, Info } from 'lucide-react';
import type { ParseResult, ParsedRow } from '../utils/capTableImport';

interface Props {
  result: ParseResult;
  existingNames: Set<string>;
  onConfirm: (rows: ParsedRow[]) => Promise<void>;
  onClose: () => void;
}

const TYPE_STYLES: Record<string, string> = {
  preferred: 'bg-blue-100 text-blue-700',
  common: 'bg-green-100 text-green-700',
  option: 'bg-purple-100 text-purple-700',
  warrant: 'bg-orange-100 text-orange-700',
};

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtMoney(n: number): string {
  return n > 0 ? `$${n.toLocaleString()}` : '—';
}

export default function CapTableUploadModal({ result, existingNames, onConfirm, onClose }: Props) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const validRows = result.rows.filter((r) => !r.hasErrors);
  const errorRows = result.rows.filter((r) => r.hasErrors);
  const conflictRows = validRows.filter((r) =>
    existingNames.has(r.data.name.toLowerCase())
  );

  // FD % warning: only show if we have valid rows and the user seems to intend a full upload
  const totalFd = result.totalFdUnits;
  const hasLowFd = totalFd === 0 && validRows.length > 0;

  async function handleConfirm() {
    setImporting(true);
    setImportError('');
    try {
      await onConfirm(validRows);
    } catch (err: any) {
      setImportError(err.message ?? 'Import failed');
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cap Table Preview</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Review before importing — rows with errors will be skipped
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary banner */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-6 py-3 bg-gray-50 border-b text-sm flex-shrink-0">
          <span className="flex items-center gap-1.5 text-green-700 font-medium">
            <CheckCircle className="h-4 w-4" />
            {validRows.length} row{validRows.length !== 1 ? 's' : ''} ready to import
          </span>
          {errorRows.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} with errors (will be skipped)
            </span>
          )}
          {conflictRows.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Info className="h-4 w-4" />
              {conflictRows.length} name conflict{conflictRows.length !== 1 ? 's' : ''} — existing class{conflictRows.length !== 1 ? 'es' : ''} will be updated
            </span>
          )}
          {hasLowFd && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Outstanding units are all zero — check your data
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 p-6">
          {result.globalErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
              {result.globalErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {e}
                </div>
              ))}
            </div>
          )}

          {result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-max">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {[
                      ['Row', 'left'],
                      ['Share Class Name', 'left'],
                      ['Type', 'left'],
                      ['Issue Price', 'right'],
                      ['Units', 'right'],
                      ['Liq. Pref', 'right'],
                      ['Participating', 'center'],
                      ['Strike', 'right'],
                      ['FD Units', 'right'],
                      ['FD %', 'right'],
                      ['Status', 'left'],
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
                  {result.rows.map((row) => {
                    const isConflict = !row.hasErrors && existingNames.has(row.data.name.toLowerCase());
                    const fdPct = totalFd > 0 ? (row.fdEquivUnits / totalFd) * 100 : null;

                    const rowBg = row.hasErrors
                      ? 'bg-red-50'
                      : isConflict
                      ? 'bg-amber-50'
                      : 'hover:bg-gray-50';

                    return (
                      <tr
                        key={row.rowNumber}
                        className={`border-b border-gray-100 transition-colors ${rowBg}`}
                      >
                        {/* Row # */}
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">
                          {row.rowNumber}
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          {row.data.name || (
                            <span className="italic text-gray-400">empty</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              TYPE_STYLES[row.data.type] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.data.type || '—'}
                          </span>
                        </td>

                        {/* Issue Price */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmtMoney(row.data.issuePrice)}
                        </td>

                        {/* Units */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmt(row.data.sharesOutstanding)}
                        </td>

                        {/* Liq Pref */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmtMoney(row.data.liquidationPreference)}
                        </td>

                        {/* Participating */}
                        <td className="px-3 py-2.5 text-center text-gray-500">
                          {row.data.isParticipating ? (
                            <span className="text-blue-600 font-medium">Y</span>
                          ) : (
                            <span className="text-gray-300">N</span>
                          )}
                        </td>

                        {/* Strike */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmtMoney(row.data.strikePrice)}
                        </td>

                        {/* FD Units */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fmt(row.fdEquivUnits)}
                        </td>

                        {/* FD % */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {fdPct !== null ? `${fdPct.toFixed(1)}%` : '—'}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 min-w-[200px]">
                          {row.hasErrors ? (
                            <div className="space-y-0.5">
                              {row.errors.map((e, i) => (
                                <div key={i} className="text-xs text-red-600 flex items-start gap-1 leading-tight">
                                  <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
                                  {e}
                                </div>
                              ))}
                            </div>
                          ) : isConflict ? (
                            <span className="text-xs text-amber-700 font-medium">
                              Will update existing class
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0">
          <div className="text-sm text-gray-500">
            {importError ? (
              <span className="text-red-600 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {importError}
              </span>
            ) : validRows.length > 0 ? (
              <>
                {validRows.length} class{validRows.length !== 1 ? 'es' : ''} will be imported
                {conflictRows.length > 0 && ` (${conflictRows.length} updated)`}
              </>
            ) : (
              'Fix the errors in your file and re-upload'
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={validRows.length === 0 || importing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {importing
                ? 'Importing…'
                : `Import ${validRows.length} Class${validRows.length !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
