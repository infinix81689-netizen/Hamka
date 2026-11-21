import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  AppDatabaseState,
  AppSettings,
  SupplierTransaction,
} from '../types/tbs';
import {
  buildSupplierTemplateRows,
  buildSupplierTransactionsExcelRows,
  calculateSupplierMetrics,
  formatDateDisplay,
  formatNumberID,
  formatRupiah,
  lookupMarketPriceForDate,
  mapVarietasToDxPCode,
} from '../utils/tbsCalculations';

interface SuppliersViewProps {
  state: AppDatabaseState;
  canWrite?: boolean;
  selectedSupplierId: number;
  onSelectSupplier: (id: number) => void;
  onAddSupplier: (name: string) => Promise<void>;
  onDeleteSupplier: (id: number) => Promise<void>;
  onAddTransaction: (tx: Omit<SupplierTransaction, 'id'>) => Promise<void>;
  onUpdateTransaction: (tx: SupplierTransaction) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onDeleteAllTransactions: (supplierId?: number) => Promise<void>;
  onBulkValidate: (ids: number[], validated: boolean) => Promise<void>;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onOpenImportExcel: () => void;
  searchFocusTrigger: number;
  resetFormTrigger: number;
}

const PAGE_SIZE = 20;

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  state,
  canWrite = true,
  selectedSupplierId,
  onSelectSupplier,
  onAddSupplier,
  onDeleteSupplier,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onDeleteAllTransactions,
  onBulkValidate,
  onUpdateSettings,
  onOpenImportExcel,
  searchFocusTrigger,
  resetFormTrigger,
}) => {
  const [newSupplierName, setNewSupplierName] = useState('');
  const [periodeStart, setPeriodeStart] = useState(state.settings.periode_mulai);
  const [periodeEnd, setPeriodeEnd] = useState(state.settings.periode_selesai);
  const [filterApplied, setFilterApplied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [varietasFilter, setVarietasFilter] = useState<'ALL' | 'DURA' | 'PSIFERA' | 'TENERA'>('ALL');
  const [page, setPage] = useState(1);

  // Input form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tglTerima, setTglTerima] = useState('2026-11-20');
  const [noKendaraan, setNoKendaraan] = useState('');
  const [brutoKg, setBrutoKg] = useState('');
  const [dendaKg, setDendaKg] = useState('');
  const [grade, setGrade] = useState('12.50');
  const [dxpCode, setDxpCode] = useState('');
  const [hargaOverride, setHargaOverride] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [deletingAll, setDeletingAll] = useState(false);

  // Right panel settings local inputs
  const [maxGradPct, setMaxGradPct] = useState(String(state.settings.max_grad_pct));
  const [hargaMain, setHargaMain] = useState(String(state.settings.harga_hq));
  const [hargaHQ, setHargaHQ] = useState(String(state.settings.harga_hq));
  const [hargaMQ, setHargaMQ] = useState(String(state.settings.harga_mq));
  const [hargaA, setHargaA] = useState(String(state.settings.harga_a));
  const [hargaB, setHargaB] = useState(String(state.settings.harga_b));

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMaxGradPct(String(state.settings.max_grad_pct));
    setHargaMain(String(state.settings.harga_hq));
    setHargaHQ(String(state.settings.harga_hq));
    setHargaMQ(String(state.settings.harga_mq));
    setHargaA(String(state.settings.harga_a));
    setHargaB(String(state.settings.harga_b));
  }, [state.settings]);

  useEffect(() => {
    if (searchFocusTrigger > 0) {
      searchInputRef.current?.focus();
    }
  }, [searchFocusTrigger]);

  useEffect(() => {
    if (resetFormTrigger > 0) {
      handleResetForm();
    }
  }, [resetFormTrigger]);

  const activeSupplier = useMemo(
    () => state.suppliers.find((s) => s.id === selectedSupplierId) || state.suppliers[0],
    [state.suppliers, selectedSupplierId]
  );

  const marketDefaultHarga = useMemo(
    () =>
      lookupMarketPriceForDate(
        tglTerima,
        state.harga_market_harian,
        Number(hargaMain) || state.settings.harga_hq
      ),
    [tglTerima, state.harga_market_harian, hargaMain, state.settings.harga_hq]
  );

  const previewMetrics = useMemo(() => {
    const activeHarga =
      hargaOverride !== ''
        ? Number(hargaOverride)
        : state.settings.cek_harga_saat_edit
          ? marketDefaultHarga
          : Number(hargaMain) || state.settings.harga_hq;

    return calculateSupplierMetrics({
      brutoKg: Number(brutoKg) || 0,
      dendaKg: Number(dendaKg) || 0,
      grade: Number(grade) || 0,
      dxpCode,
      hargaRp: activeHarga,
      maxGradPct: Number(maxGradPct) || 5,
    });
  }, [brutoKg, dendaKg, grade, dxpCode, hargaOverride, marketDefaultHarga, hargaMain, maxGradPct, state.settings]);

  const supplierTransactions = useMemo(() => {
    return state.supplier_transactions
      .filter((t) => t.supplier_id === (activeSupplier?.id ?? selectedSupplierId))
      .filter((t) => {
        if (filterApplied && periodeStart && periodeEnd) {
          if (t.tanggal < periodeStart || t.tanggal > periodeEnd) return false;
        }
        if (varietasFilter !== 'ALL' && t.varietas_dxp !== varietasFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          return (
            t.no_kendaraan.toLowerCase().includes(q) ||
            t.tanggal.includes(q) ||
            String(t.id).includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (b.tanggal === a.tanggal ? b.id - a.id : b.tanggal.localeCompare(a.tanggal)));
  }, [
    state.supplier_transactions,
    activeSupplier,
    selectedSupplierId,
    filterApplied,
    periodeStart,
    periodeEnd,
    varietasFilter,
    searchTerm,
  ]);

  const totalPages = Math.max(1, Math.ceil(supplierTransactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = supplierTransactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleResetForm = () => {
    setEditingId(null);
    setNoKendaraan('');
    setBrutoKg('');
    setDendaKg('');
    setGrade('12.50');
    setDxpCode('');
    setHargaOverride('');
    setFormError('');
  };

  const handleSelectRowForEdit = (tx: SupplierTransaction) => {
    setEditingId(tx.id);
    setTglTerima(tx.tanggal);
    setNoKendaraan(tx.no_kendaraan);
    setBrutoKg(String(tx.bruto_kg));
    setDendaKg(String(tx.denda_kg));
    setGrade(String(tx.grade));
    setDxpCode(mapVarietasToDxPCode(tx.varietas_dxp));
    setHargaOverride(String(tx.harga_rp));
    setFormError('');
  };

  const buildPayload = (): Omit<SupplierTransaction, 'id'> | null => {
    if (!activeSupplier) {
      setFormError('Pilih supplier terlebih dahulu.');
      return null;
    }
    if (!noKendaraan.trim()) {
      setFormError('No. Kendaraan wajib diisi.');
      return null;
    }
    const bruto = Number(brutoKg);
    if (!Number.isFinite(bruto) || bruto <= 0) {
      setFormError('Bruto (Kg) harus lebih besar dari 0.');
      return null;
    }
    const denda = Number(dendaKg || 0);
    if (denda < 0 || denda > bruto) {
      setFormError('Denda (Kg) harus antara 0 dan Bruto.');
      return null;
    }

    return {
      supplier_id: activeSupplier.id,
      tanggal: tglTerima,
      no_kendaraan: noKendaraan.trim().toUpperCase(),
      bruto_kg: previewMetrics.brutoKg,
      denda_kg: previewMetrics.dendaKg,
      persen_denda: previewMetrics.persenDenda,
      netto_kg: previewMetrics.nettoKg,
      grade: Number(grade) || 0,
      harga_rp: previewMetrics.hargaRp,
      total_rp: previewMetrics.totalRp,
      varietas_dxp: previewMetrics.varietas,
      quality_tier: previewMetrics.qualityTier,
      validated: 0,
    };
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    await onAddTransaction(payload);
    handleResetForm();
    setPage(1);
  };

  const handleReplaceSubmit = async () => {
    if (!editingId) {
      setFormError('Pilih baris data pada tabel atau dropdown Pilih untuk di-Replace.');
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    const existing = state.supplier_transactions.find((t) => t.id === editingId);
    await onUpdateTransaction({
      ...payload,
      id: editingId,
      validated: existing ? existing.validated : 0,
    });
    handleResetForm();
  };

  const handleDeleteSelected = async () => {
    if (editingId) {
      await onDeleteTransaction(editingId);
      handleResetForm();
      return;
    }
    if (selectedRowIds.length > 0) {
      for (const id of selectedRowIds) {
        await onDeleteTransaction(id);
      }
      setSelectedRowIds([]);
      return;
    }
    setFormError('Pilih baris data untuk dihapus.');
  };

  const handleAddNewSupplier = async () => {
    const trimmed = newSupplierName.trim();
    if (!trimmed) return;
    await onAddSupplier(trimmed);
    setNewSupplierName('');
  };

  const handleSaveRightPanelPricing = async () => {
    await onUpdateSettings({
      max_grad_pct: Number(maxGradPct) || 5,
      harga_hq: Number(hargaHQ) || 2750,
      harga_mq: Number(hargaMQ) || 2650,
      harga_a: Number(hargaA) || 2550,
      harga_b: Number(hargaB) || 2450,
    });
  };

  const toggleRowCheck = (id: number) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDownloadSupplierTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      buildSupplierTemplateRows(activeSupplier?.name || 'CV.BAYA MARAGIT')
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, 'Template_Import_TBS_Suppliers.xlsx');
  };

  const handleExportSupplierExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = buildSupplierTransactionsExcelRows(supplierTransactions, state.suppliers);
    const ws = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              No: 1,
              Supplier: activeSupplier?.name || '',
              Tanggal: '',
              No_Kendaraan: '',
              Bruto: 0,
              Denda: 0,
              Persen_Denda: 0,
              Netto: 0,
              Grade: 0,
              Harga: 0,
              Total_Rp: 0,
              DxP: '',
              Varietas: 'DURA',
              Quality: 'HQ',
              Validated: 'Draft',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    const safeName = (activeSupplier?.name || 'All').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Data_TBS_Suppliers_${safeName}.xlsx`);
  };

  const handleConfirmDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await onDeleteAllTransactions(deleteScope === 'ACTIVE' ? activeSupplier?.id : undefined);
      setSelectedRowIds([]);
      handleResetForm();
      setShowDeleteAllModal(false);
    } catch (err) {
      setFormError((err as Error).message || 'Gagal menghapus data transaksi.');
      setShowDeleteAllModal(false);
    } finally {
      setDeletingAll(false);
    }
  };

  const totalBrutoView = supplierTransactions.reduce((s, r) => s + r.bruto_kg, 0);
  const totalNettoView = supplierTransactions.reduce((s, r) => s + r.netto_kg, 0);
  const totalRpView = supplierTransactions.reduce((s, r) => s + r.total_rp, 0);

  return (
    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:p-4">
      {/* LEFT PANEL: Nama Supplier + Add / Delete (matching Screenshot 1) */}
      <section className="lg:col-span-2 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Nama Supplier</h2>
          <div className="mt-2 space-y-1.5">
            <input
              type="text"
              aria-label="Nama supplier baru"
              placeholder="Tambah supplier..."
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1 text-xs focus:border-sky-600 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleAddNewSupplier}
                className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
              <button
                type="button"
                onClick={() => activeSupplier && onDeleteSupplier(activeSupplier.id)}
                disabled={!activeSupplier}
                className="inline-flex items-center justify-center gap-1 rounded border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[540px] overflow-y-auto bg-[#E8F4FA]/50 dark:bg-slate-950/40 p-1">
          {state.suppliers.map((sup) => {
            const isSelected = activeSupplier?.id === sup.id;
            return (
              <button
                key={sup.id}
                type="button"
                onClick={() => {
                  onSelectSupplier(sup.id);
                  setPage(1);
                  setSelectedRowIds([]);
                }}
                className={`block w-full rounded px-2.5 py-1 text-left text-xs font-medium transition-colors truncate ${
                  isSelected
                    ? 'bg-brand-primary text-white font-semibold'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-sky-100 dark:hover:bg-slate-800'
                }`}
              >
                {sup.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* CENTER PANEL: Input Form + Toolbar + Data Grid */}
      <section className="lg:col-span-8 flex flex-col gap-3">
        {/* Supplier Header + Periode Filter */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
            <div>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
                {activeSupplier?.name || 'Pilih Supplier'}
              </p>
              <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                INPUT DATA PEMBAYARAN TBS SUPPLIERS
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-700">Periode:</span>
              <input
                type="date"
                aria-label="Periode mulai"
                value={periodeStart}
                onChange={(e) => setPeriodeStart(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-mono-num"
              />
              <span className="text-slate-500">s/d</span>
              <input
                type="date"
                aria-label="Periode selesai"
                value={periodeEnd}
                onChange={(e) => setPeriodeEnd(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-mono-num"
              />
              <button
                type="button"
                onClick={() => {
                  setFilterApplied((prev) => !prev);
                  setPage(1);
                }}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filterApplied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {filterApplied ? 'Aktif (Reset)' : 'OK'}
              </button>
            </div>
          </div>

          {/* Input Form & Action Buttons (Input / Edit / Replace / Hapus / Reset) */}
          <form onSubmit={handleInputSubmit} className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  Tgl. Terima:
                  <input
                    type="date"
                    value={tglTerima}
                    onChange={(e) => setTglTerima(e.target.value)}
                    className="ml-1.5 rounded border border-slate-300 px-2 py-1 text-xs font-mono-num"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Pilih:
                  <select
                    aria-label="Pilih tiket untuk edit"
                    value={editingId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const found = supplierTransactions.find((t) => t.id === id);
                      if (found) handleSelectRowForEdit(found);
                      else handleResetForm();
                    }}
                    className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">-- Baru / Pilih --</option>
                    {supplierTransactions.slice(0, 30).map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} · {t.no_kendaraan} ({formatDateDisplay(t.tanggal)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Input
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editingId && selectedRowIds.length === 1) {
                      const found = supplierTransactions.find((t) => t.id === selectedRowIds[0]);
                      if (found) handleSelectRowForEdit(found);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 whitespace-nowrap"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleReplaceSubmit}
                  className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1 rounded bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-nopol">
                  No. Kendaraan
                </label>
                <input
                  id="sup-nopol"
                  type="text"
                  placeholder="KB8548CH"
                  value={noKendaraan}
                  onChange={(e) => setNoKendaraan(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded border border-slate-300 bg-sky-50/60 px-2 py-1.5 text-xs font-mono-num uppercase focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-bruto">
                  Bruto (Kg)
                </label>
                <input
                  id="sup-bruto"
                  type="number"
                  min="0"
                  placeholder="2350"
                  value={brutoKg}
                  onChange={(e) => setBrutoKg(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-sky-50/60 px-2 py-1.5 text-xs font-mono-num focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-denda">
                  Denda (Kg)
                </label>
                <input
                  id="sup-denda"
                  type="number"
                  min="0"
                  placeholder="60"
                  value={dendaKg}
                  onChange={(e) => setDendaKg(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-sky-50/60 px-2 py-1.5 text-xs font-mono-num focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-grade">
                  Grade
                </label>
                <input
                  id="sup-grade"
                  type="number"
                  step="0.01"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-sky-50/60 px-2 py-1.5 text-xs font-mono-num focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-dxp">
                  DxP (0=Psi, 1=Ten)
                </label>
                <input
                  id="sup-dxp"
                  type="text"
                  placeholder="Kosong=DURA"
                  value={dxpCode}
                  onChange={(e) => setDxpCode(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-sky-50/60 px-2 py-1.5 text-xs font-mono-num focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="sup-harga">
                  Harga (Rp/Kg)
                </label>
                <input
                  id="sup-harga"
                  type="number"
                  placeholder={String(marketDefaultHarga)}
                  value={hargaOverride}
                  onChange={(e) => setHargaOverride(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-amber-50/70 px-2 py-1.5 text-xs font-mono-num focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            {state.settings.show_formulabar && (
              <div className="flex flex-wrap items-center gap-4 rounded bg-slate-50 px-3 py-1.5 text-xs text-slate-700 border border-slate-200 font-mono-num">
                <span>
                  Net (Kg): <strong className="text-slate-900">{formatNumberID(previewMetrics.nettoKg)}</strong>
                </span>
                <span>
                  Denda %:{' '}
                  <strong
                    className={
                      previewMetrics.persenDenda > (Number(maxGradPct) || 5)
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }
                  >
                    {previewMetrics.persenDenda.toFixed(2)}%
                  </strong>
                </span>
                <span>
                  Varietas: <strong>{previewMetrics.varietas}</strong>
                </span>
                <span>
                  Quality: <strong>{previewMetrics.qualityTier}</strong>
                </span>
                <span>
                  Total: <strong className="text-emerald-800">{formatRupiah(previewMetrics.totalRp)}</strong>
                </span>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {formError}
              </p>
            )}
          </form>
        </div>

        {/* Table Toolbar: Search, Excel Actions, Bulk Delete, Pagination */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Cari no kendaraan atau tanggal"
                placeholder="Cari No. Kendaraan / Tanggal..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-44 sm:w-52 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs focus:border-sky-600 focus:outline-none"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono-num">
                {supplierTransactions.length} Data
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleDownloadSupplierTemplate}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="h-3 w-3 text-emerald-600" />
                Template Excel
              </button>
              <button
                type="button"
                disabled={!canWrite}
                onClick={onOpenImportExcel}
                className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="h-3 w-3" />
                Import Excel
              </button>
              <button
                type="button"
                onClick={handleExportSupplierExcel}
                className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3 w-3" />
                Export Excel
              </button>
              <button
                type="button"
                disabled={!canWrite || state.supplier_transactions.length === 0}
                onClick={() => {
                  setDeleteScope(supplierTransactions.length > 0 ? 'ACTIVE' : 'ALL');
                  setShowDeleteAllModal(true);
                }}
                className="inline-flex items-center gap-1 rounded bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="h-3 w-3" />
                Hapus Semua Data
              </button>

              <div className="hidden sm:block h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <span className="text-slate-500 font-mono-num">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table
              className={`w-full text-left text-xs ${
                state.settings.show_gridlines ? 'border-collapse' : ''
              }`}
            >
              <thead className="bg-rose-50/70 text-rose-800 border-b border-rose-300">
                <tr>
                  <th className="w-8 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua baris halaman ini"
                      checked={
                        paginatedRows.length > 0 &&
                        paginatedRows.every((r) => selectedRowIds.includes(r.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(paginatedRows.map((r) => r.id));
                        } else {
                          setSelectedRowIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-2 py-2 font-bold">NO.</th>
                  <th className="px-2 py-2 font-bold">TANGGAL</th>
                  <th className="px-2 py-2 font-bold">NO KENDARAAN</th>
                  <th className="px-2 py-2 text-right font-bold">BRUTO (KG)</th>
                  <th className="px-2 py-2 text-right font-bold">DENDA (KG)</th>
                  <th className="px-2 py-2 text-right font-bold">%</th>
                  <th className="px-2 py-2 text-right font-bold">NETTO (KG)</th>
                  <th className="px-2 py-2 text-right font-bold">GRADE</th>
                  <th className="px-2 py-2 text-right font-bold">HARGA (Rp)</th>
                  <th className="px-2 py-2 font-bold">Varietas</th>
                  <th className="px-2 py-2 text-center font-bold">Valid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      Belum ada data transaksi untuk supplier ini. Gunakan form di atas untuk Input data baru.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const isChecked = selectedRowIds.includes(row.id);
                    const isEditing = editingId === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleSelectRowForEdit(row)}
                        className={`cursor-pointer transition-colors ${
                          isEditing
                            ? 'bg-sky-50'
                            : row.validated
                              ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <td
                          className="px-2 py-1.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Pilih baris ${row.id}`}
                            checked={isChecked}
                            onChange={() => toggleRowCheck(row.id)}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono-num text-slate-700">{row.id}</td>
                        <td className="px-2 py-1.5 font-mono-num whitespace-nowrap">
                          {formatDateDisplay(row.tanggal)}
                        </td>
                        <td className="px-2 py-1.5 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {row.no_kendaraan}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono-num">
                          {formatNumberID(row.bruto_kg)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono-num">
                          {formatNumberID(row.denda_kg)}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right font-mono-num ${
                            row.persen_denda > state.settings.max_grad_pct
                              ? 'font-semibold text-rose-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {row.persen_denda.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono-num font-semibold text-slate-900">
                          {formatNumberID(row.netto_kg)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono-num">
                          {row.grade.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono-num">
                          {formatNumberID(row.harga_rp)}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">
                          {row.varietas_dxp}
                        </td>
                        <td
                          className="px-2 py-1.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkValidate([row.id], row.validated !== 1);
                          }}
                        >
                          {row.validated === 1 ? (
                            <span className="text-emerald-700 font-semibold">OK</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-100 border-t border-slate-300 font-semibold text-xs text-slate-900 font-mono-num">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Total ({supplierTransactions.length} Tiket):
                  </td>
                  <td className="px-2 py-2 text-right">{formatNumberID(totalBrutoView)}</td>
                  <td className="px-2 py-2 text-right">-</td>
                  <td className="px-2 py-2 text-right">-</td>
                  <td className="px-2 py-2 text-right">{formatNumberID(totalNettoView)}</td>
                  <td colSpan={4} className="px-3 py-2 text-right text-emerald-800">
                    {formatRupiah(totalRpView)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: Harga (Rp), Max Grad %, Quality, Cek/UnCek, Varietas DxP */}
      <aside className="lg:col-span-2 flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
            <h3 className="text-xs font-bold text-blue-800 dark:text-sky-300">Harga (Rp)</h3>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Max Grad %</span>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center">
            <input
              type="number"
              aria-label="Harga utama Rp"
              value={hargaMain}
              onChange={(e) => {
                setHargaMain(e.target.value);
                setHargaHQ(e.target.value);
              }}
              className="col-span-2 rounded border border-slate-300 bg-amber-100/70 px-2 py-1 text-xs font-mono-num font-bold"
            />
            <input
              type="number"
              aria-label="Max Grad Persen"
              value={maxGradPct}
              onChange={(e) => setMaxGradPct(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs font-mono-num font-bold text-rose-700"
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="font-semibold text-slate-600">HQ :</label>
              <input
                type="number"
                value={hargaHQ}
                onChange={(e) => setHargaHQ(e.target.value)}
                className="col-span-2 rounded border border-slate-300 px-2 py-1 font-mono-num"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="font-semibold text-slate-600">MQ :</label>
              <input
                type="number"
                value={hargaMQ}
                onChange={(e) => setHargaMQ(e.target.value)}
                className="col-span-2 rounded border border-slate-300 px-2 py-1 font-mono-num"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="font-semibold text-slate-600">A :</label>
              <input
                type="number"
                value={hargaA}
                onChange={(e) => setHargaA(e.target.value)}
                className="col-span-2 rounded border border-slate-300 px-2 py-1 font-mono-num"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="font-semibold text-slate-600">B :</label>
              <input
                type="number"
                value={hargaB}
                onChange={(e) => setHargaB(e.target.value)}
                className="col-span-2 rounded border border-slate-300 px-2 py-1 font-mono-num"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveRightPanelPricing}
            className="w-full rounded bg-slate-800 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Simpan Harga
          </button>

          <div className="border-t border-slate-200 pt-2">
            <p className="text-[11px] font-semibold text-rose-700">Quality (Grade)</p>
            <div className="mt-1 rounded border border-slate-200 bg-slate-50 py-2 text-center text-sm font-bold text-slate-900">
              {previewMetrics.qualityTier}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-sky-900">
            <input
              type="checkbox"
              checked={state.settings.cek_harga_saat_edit}
              onChange={(e) =>
                onUpdateSettings({ cek_harga_saat_edit: e.target.checked })
              }
            />
            Cek List Harga Saat Edit
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const targetIds =
                  selectedRowIds.length > 0
                    ? selectedRowIds
                    : paginatedRows.map((r) => r.id);
                if (targetIds.length > 0) onBulkValidate(targetIds, true);
              }}
              className="inline-flex items-center justify-center gap-1 rounded border border-emerald-600 bg-emerald-50 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <CheckSquare className="h-3 w-3" />
              Cek
            </button>
            <button
              type="button"
              onClick={() => {
                const targetIds =
                  selectedRowIds.length > 0
                    ? selectedRowIds
                    : paginatedRows.map((r) => r.id);
                if (targetIds.length > 0) onBulkValidate(targetIds, false);
              }}
              className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-slate-50 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Square className="h-3 w-3" />
              UnCek
            </button>
          </div>
        </div>

        {/* Varietas DxP Legend & Filter */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Varietas DxP :</h3>
          <div className="space-y-1 text-xs">
            {(
              [
                { key: 'ALL', code: 'All', label: 'Semua Varietas' },
                { key: 'DURA', code: ' ', label: 'DURA' },
                { key: 'PSIFERA', code: '0', label: 'PSIFERA' },
                { key: 'TENERA', code: '1', label: 'TENERA' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setVarietasFilter(item.key);
                  setPage(1);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors ${
                  varietasFilter === item.key
                    ? 'bg-sky-100 dark:bg-sky-900/50 font-semibold text-sky-900 dark:text-sky-200'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono-num text-[11px]">
                  {item.code}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* In-UI Confirmation Modal for Hapus Semua Data */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sup-delete-all-title"
            className="w-full max-w-md rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900 bg-rose-700 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <h3 id="sup-delete-all-title" className="text-xs font-bold">
                  Konfirmasi Hapus Semua Data Suppliers
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup konfirmasi"
                onClick={() => setShowDeleteAllModal(false)}
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700 dark:text-slate-200">
              <p>Pilih cakupan data timbangan Suppliers yang ingin dihapus dari database:</p>
              <div className="space-y-2">
                {activeSupplier && (
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="supDeleteScope"
                      checked={deleteScope === 'ACTIVE'}
                      onChange={() => setDeleteScope('ACTIVE')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Hanya Supplier Aktif: {activeSupplier.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Menghapus seluruh transaksi milik {activeSupplier.name} saja.
                      </p>
                    </div>
                  </label>
                )}
                <label className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="supDeleteScope"
                    checked={deleteScope === 'ALL'}
                    onChange={() => setDeleteScope('ALL')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      Seluruh Data Transaksi Semua Suppliers ({state.supplier_transactions.length} baris)
                    </p>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Menghapus semua baris transaksi timbangan dari seluruh relasi suppliers.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingAll}
                onClick={handleConfirmDeleteAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingAll ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
