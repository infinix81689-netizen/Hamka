import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { AppDatabaseState } from '../types/tbs';
import {
  buildEstateTemplateRows,
  buildSupplierTemplateRows,
  formatNumberID,
  normalizeImportedExcelRows,
  type NormalizedExcelEstateImportRow,
  type NormalizedExcelSupplierImportRow,
} from '../utils/tbsCalculations';

interface ImportTimbanganModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppDatabaseState;
  defaultSupplierId: number;
  defaultEstateId: number;
  initialTargetMode?: 'AUTO' | 'SUPPLIER' | 'ESTATE';
  onImportExcelAll: (payload: {
    supplierRows: NormalizedExcelSupplierImportRow[];
    estateRows: NormalizedExcelEstateImportRow[];
  }) => Promise<void>;
}

export const ImportTimbanganModal: React.FC<ImportTimbanganModalProps> = ({
  isOpen,
  onClose,
  state,
  defaultSupplierId,
  defaultEstateId,
  initialTargetMode = 'AUTO',
  onImportExcelAll,
}) => {
  const [targetMode, setTargetMode] = useState<'AUTO' | 'SUPPLIER' | 'ESTATE'>(initialTargetMode);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>(() => [
    ...buildSupplierTemplateRows('CV.BAYA MARAGIT'),
    ...buildEstateTemplateRows('PT.MJL PLASMA'),
  ]);
  const [fileName, setFileName] = useState('Contoh_Multi_Suppliers_Estate.xlsx');
  const [statusMsg, setStatusMsg] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetMode(initialTargetMode);
      setStatusMsg('');
    }
  }, [isOpen, initialTargetMode]);

  const defaultSupplierName =
    state.suppliers.find((s) => s.id === defaultSupplierId)?.name ||
    state.suppliers[0]?.name ||
    'CV.BAYA MARAGIT';
  const defaultEstateName =
    state.estates.find((e) => e.id === defaultEstateId)?.name ||
    state.estates[0]?.name ||
    'PT.MJL PLASMA';

  const normalized = useMemo(() => {
    return normalizeImportedExcelRows({
      rawRows,
      targetMode,
      defaultSupplierName,
      defaultEstateName,
      existingSuppliers: state.suppliers,
      existingEstates: state.estates,
      marketPrices: state.harga_market_harian,
      intiRates: state.harga_disbun_inti,
      plasmaRates: state.harga_disbun_plasma,
      fallbackHarga: state.settings.harga_hq,
      maxGradPct: state.settings.max_grad_pct,
    });
  }, [
    rawRows,
    targetMode,
    defaultSupplierName,
    defaultEstateName,
    state.suppliers,
    state.estates,
    state.harga_market_harian,
    state.harga_disbun_inti,
    state.harga_disbun_plasma,
    state.settings.harga_hq,
    state.settings.max_grad_pct,
  ]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg('');
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const combined: Array<Record<string, unknown>> = [];

      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const upperSheet = sheetName.toUpperCase();
        for (const r of json) {
          // Inject inferred Tipe from sheet name if sheet is explicitly Suppliers or Estate
          const hasTipe = Object.keys(r).some((k) =>
            ['tipe', 'kategori', 'jenis', 'type'].includes(k.trim().toLowerCase())
          );
          if (!hasTipe && (upperSheet.includes('SUPPLIER') || upperSheet.includes('RELASI'))) {
            combined.push({ Tipe: 'SUPPLIER', ...r });
          } else if (!hasTipe && (upperSheet.includes('ESTATE') || upperSheet.includes('KEBUN'))) {
            combined.push({ Tipe: 'ESTATE', ...r });
          } else {
            combined.push(r);
          }
        }
      }

      setRawRows(combined);
      if (combined.length === 0) {
        setStatusMsg('File Excel terbaca, namun tidak ditemukan baris data timbangan.');
      }
    } catch {
      setStatusMsg('Gagal membaca file Excel. Pastikan format .xlsx atau .xls valid.');
    }
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const supSheet = XLSX.utils.json_to_sheet(buildSupplierTemplateRows(defaultSupplierName));
    const estSheet = XLSX.utils.json_to_sheet(buildEstateTemplateRows(defaultEstateName));
    XLSX.utils.book_append_sheet(wb, supSheet, 'Suppliers');
    XLSX.utils.book_append_sheet(wb, estSheet, 'Estate');
    XLSX.writeFile(wb, 'Template_Import_Timbangan_Suppliers_Estate.xlsx');
  };

  const handleImport = async () => {
    const total = normalized.supplierRows.length + normalized.estateRows.length;
    if (total === 0) {
      setStatusMsg('Tidak ada baris data timbangan yang valid untuk diimpor.');
      return;
    }
    setImporting(true);
    setStatusMsg('');
    try {
      await onImportExcelAll(normalized);
      onClose();
    } catch (err) {
      setStatusMsg((err as Error).message || 'Gagal mengimpor data ke database.');
    } finally {
      setImporting(false);
    }
  };

  const uniqueSuppliersCount = new Set(normalized.supplierRows.map((r) => r.entityName.toUpperCase())).size;
  const uniqueEstatesCount = new Set(normalized.estateRows.map((r) => r.entityName.toUpperCase())).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-brand-primary px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold">
                Import Data Timbangan Excel (Keseluruhan Suppliers & Estate)
              </h2>
              <p className="text-[11px] text-slate-200">
                Mendukung file Excel (.xlsx, .xls) multi-sheet atau gabungan kolom Suppliers + Estate
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup modal import"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-accent px-3.5 py-2 font-semibold text-white hover:opacity-95">
                <Upload className="h-3.5 w-3.5" />
                Pilih File Excel (.xlsx / .xls)
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                Unduh Template Excel (.xlsx)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Mode Baca:</span>
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value as 'AUTO' | 'SUPPLIER' | 'ESTATE')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-medium text-slate-900 dark:text-white"
              >
                <option value="AUTO">Auto (Suppliers + Estate)</option>
                <option value="SUPPLIER">Semua Baris ke Suppliers</option>
                <option value="ESTATE">Semua Baris ke Estate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-num">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">File Aktif</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate">{fileName}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Data Suppliers Siap Impor</p>
              <p className="mt-0.5 text-base font-bold text-emerald-900 dark:text-emerald-100">
                {normalized.supplierRows.length} baris ({uniqueSuppliersCount} relasi)
              </p>
            </div>
            <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 p-3">
              <p className="text-[11px] text-sky-700 dark:text-sky-300">Data Estate Siap Impor</p>
              <p className="mt-0.5 text-base font-bold text-sky-900 dark:text-sky-100">
                {normalized.estateRows.length} baris ({uniqueEstatesCount} kebun)
              </p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                Preview Baris Data (Maks 15 baris pertama ditampilkan)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Supplier / Kebun yang belum ada di database akan dibuat otomatis
              </span>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-1.5 font-semibold">Kategori</th>
                    <th className="px-3 py-1.5 font-semibold">Nama Supplier / Kebun</th>
                    <th className="px-3 py-1.5 font-semibold">Tanggal</th>
                    <th className="px-3 py-1.5 font-semibold">No. Kendaraan</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Bruto</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Denda</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Netto</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-num">
                  {[
                    ...normalized.supplierRows.map((r) => ({
                      kind: 'SUPPLIER',
                      name: r.entityName,
                      tanggal: r.tanggal,
                      plat: r.no_kendaraan,
                      bruto: r.bruto_kg,
                      denda: r.denda_kg,
                      netto: r.netto_kg,
                      harga: r.harga_rp,
                    })),
                    ...normalized.estateRows.map((r) => ({
                      kind: `ESTATE (${r.estateType})`,
                      name: r.entityName,
                      tanggal: r.tanggal,
                      plat: r.no_polisi,
                      bruto: r.bruto_kg,
                      denda: r.denda_kg,
                      netto: r.netto_kg,
                      harga: r.harga_rp,
                    })),
                  ]
                    .slice(0, 15)
                    .map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1.5 font-sans font-semibold text-slate-700 dark:text-slate-300">
                          {row.kind}
                        </td>
                        <td className="px-3 py-1.5 font-sans font-semibold text-slate-900 dark:text-white">
                          {row.name}
                        </td>
                        <td className="px-3 py-1.5">{row.tanggal}</td>
                        <td className="px-3 py-1.5">{row.plat}</td>
                        <td className="px-3 py-1.5 text-right">{formatNumberID(row.bruto)}</td>
                        <td className="px-3 py-1.5 text-right">{formatNumberID(row.denda)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{formatNumberID(row.netto)}</td>
                        <td className="px-3 py-1.5 text-right">{formatNumberID(row.harga, 2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {statusMsg && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 font-medium">
              {statusMsg}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-5 py-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={importing || normalized.supplierRows.length + normalized.estateRows.length === 0}
            onClick={handleImport}
            className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {importing
              ? 'Mengimpor...'
              : `Import ${normalized.supplierRows.length + normalized.estateRows.length} Data Timbangan`}
          </button>
        </div>
      </div>
    </div>
  );
};
