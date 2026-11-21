import React, { useMemo, useState } from 'react';
import { Database, Download, Play, RotateCcw, Upload, X } from 'lucide-react';
import type { AppDatabaseState, SyncQueueItem } from '../types/tbs';
import { generateSqlDumpFromState } from '../utils/tbsCalculations';

interface DatabaseSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppDatabaseState;
  isOnline: boolean;
  authToken: string;
  userRole: string;
  syncQueue: SyncQueueItem[];
  onExportSql: () => void;
  onImportSql: (sqlContent: string) => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onManualSync: () => Promise<void>;
}

export const DatabaseSqlModal: React.FC<DatabaseSqlModalProps> = ({
  isOpen,
  onClose,
  state,
  isOnline,
  authToken,
  userRole,
  syncQueue,
  onExportSql,
  onImportSql,
  onResetDatabase,
  onManualSync,
}) => {
  const [sqlQuery, setSqlQuery] = useState(
    'SELECT s.name, COUNT(t.id) AS total_trip, SUM(t.netto_kg) AS total_netto FROM suppliers s LEFT JOIN supplier_transactions t ON t.supplier_id = s.id GROUP BY s.id ORDER BY total_netto DESC LIMIT 15;'
  );
  const [queryResult, setQueryResult] = useState<Array<Record<string, unknown>> | null>(null);
  const [queryError, setQueryError] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const sqlDumpPreview = useMemo(() => generateSqlDumpFromState(state), [state]);

  if (!isOpen) return null;

  const isAdmin = userRole === 'ADMIN';

  const handleRunSelect = async () => {
    setQueryError('');
    setQueryResult(null);
    if (!isOnline) {
      setQueryError('SQL Query Inspector membutuhkan mode Online agar terhubung ke SQLite server.');
      return;
    }
    if (!isAdmin) {
      setQueryError('SQL Query Inspector hanya dapat dijalankan oleh akun ADMIN.');
      return;
    }
    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ sql: sqlQuery }),
      });
      const json = await res.json();
      if (!res.ok) {
        setQueryError(json.error || 'Gagal menjalankan query.');
        return;
      }
      setQueryResult(json.rows || []);
    } catch (err) {
      setQueryError((err as Error).message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await onImportSql(text);
      setImportStatus(`Berhasil mengimpor ${file.name} ke database.`);
    } catch (err) {
      setImportStatus(`Gagal impor: ${(err as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-brand-primary px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-bold">Manajemen database.sql (Offline IndexedDB & Online SQLite)</h2>
          </div>
          <button
            type="button"
            aria-label="Tutup modal database"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="text-xs text-slate-700 dark:text-slate-200">
              <p className="font-semibold">
                Status Penyimpanan: {isOnline ? 'Online (SQLite + IndexedDB Cache)' : 'Offline (IndexedDB Lokal)'}
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-mono-num">
                Suppliers: {state.suppliers.length} · Tiket Supplier: {state.supplier_transactions.length} · Tiket Estate:{' '}
                {state.estate_transactions.length} · Antrean Sync: {syncQueue.length}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {syncQueue.length > 0 && isOnline && (
                <button
                  type="button"
                  onClick={onManualSync}
                  className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Sync Antrean ({syncQueue.length})
                </button>
              )}
              <button
                type="button"
                onClick={onExportSql}
                className="inline-flex items-center gap-1.5 rounded bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                Download database.sql
              </button>
              {isAdmin && (
                <>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Upload className="h-3.5 w-3.5" />
                    Import .sql
                    <input type="file" accept=".sql" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={onResetDatabase}
                    className="inline-flex items-center gap-1.5 rounded border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Seed SQL
                  </button>
                </>
              )}
            </div>
          </div>

          {importStatus && (
            <p className="rounded border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 px-3 py-2 text-xs font-medium text-sky-900 dark:text-sky-200">
              {importStatus}
            </p>
          )}

          {/* SQLite SELECT Query Runner */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="sql-query-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                SQLite Query Inspector (SELECT · Khusus Admin)
              </label>
              <button
                type="button"
                onClick={handleRunSelect}
                disabled={!isAdmin}
                className="inline-flex items-center gap-1 rounded bg-brand-primary px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                Jalankan Query
              </button>
            </div>
            <textarea
              id="sql-query-input"
              rows={2}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-2 font-mono-num text-xs focus:border-sky-600 focus:outline-none"
            />
            {queryError && <p className="text-xs text-rose-600 dark:text-rose-400">{queryError}</p>}
            {queryResult && (
              <div className="max-h-48 overflow-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-[11px] font-mono-num">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {queryResult[0] &&
                        Object.keys(queryResult[0]).map((col) => (
                          <th key={col} className="px-2 py-1.5 font-semibold">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {queryResult.map((r, i) => (
                      <tr key={i}>
                        {Object.values(r).map((v, j) => (
                          <td key={j} className="px-2 py-1">
                            {String(v ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live database.sql Preview */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Preview Isi database.sql Terkini</p>
            <pre className="max-h-56 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-slate-900 p-3 font-mono-num text-[11px] text-emerald-200">
              {sqlDumpPreview.slice(0, 6000)}
              {sqlDumpPreview.length > 6000 ? '\n-- ... (unduh database.sql untuk file lengkap) ...' : ''}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
