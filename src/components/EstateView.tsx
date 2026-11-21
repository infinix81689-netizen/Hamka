import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  Download,
  Edit,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  AppDatabaseState,
  EstateTransaction,
  EstateType,
  KalkulasiGroupRow,
} from '../types/tbs';
import {
  buildEstateTemplateRows,
  buildEstateTransactionsExcelRows,
  calculateEstateBlokBreakdown,
  enrichBlokRows,
  formatDateDisplay,
  formatNumberID,
  formatRupiah,
  lookupHargaDisbun,
} from '../utils/tbsCalculations';

interface EstateViewProps {
  state: AppDatabaseState;
  canWrite?: boolean;
  selectedEstateId: number;
  onSelectEstate: (id: number) => void;
  onAddEstate: (name: string, type: EstateType) => Promise<void>;
  onAddEstateTransactions: (rows: Array<Omit<EstateTransaction, 'id'>>) => Promise<void>;
  onUpdateEstateTransaction: (row: EstateTransaction) => Promise<void>;
  onDeleteEstateTransaction: (id: number) => Promise<void>;
  onDeleteAllEstateTransactions: (estateId?: number) => Promise<void>;
  onBulkValidateEstate: (ids: number[], validated: boolean) => Promise<void>;
  onOpenImportExcel: () => void;
}

interface EditableBlokLine {
  blok: string;
  jjg: string;
  brd_kg: string;
}

const DEFAULT_BLOK_LINES: EditableBlokLine[] = [
  { blok: 'G6', jjg: '87', brd_kg: '' },
  { blok: 'G5', jjg: '50', brd_kg: '' },
  { blok: 'H5', jjg: '58', brd_kg: '64' },
  { blok: 'H6', jjg: '45', brd_kg: '160' },
  { blok: 'I5', jjg: '84', brd_kg: '64' },
  { blok: 'I6', jjg: '30', brd_kg: '64' },
  { blok: 'G10', jjg: '78', brd_kg: '' },
  { blok: '', jjg: '', brd_kg: '' },
  { blok: '', jjg: '', brd_kg: '' },
  { blok: '', jjg: '', brd_kg: '' },
];

export const EstateView: React.FC<EstateViewProps> = ({
  state,
  canWrite = true,
  selectedEstateId,
  onSelectEstate,
  onAddEstate,
  onAddEstateTransactions,
  onUpdateEstateTransaction,
  onDeleteEstateTransaction,
  onDeleteAllEstateTransactions,
  onBulkValidateEstate,
  onOpenImportExcel,
}) => {
  const activeEstate = useMemo(
    () => state.estates.find((e) => e.id === selectedEstateId) || state.estates[0],
    [state.estates, selectedEstateId]
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [tglTerima, setTglTerima] = useState('2026-11-20');
  const [noKendaraan, setNoKendaraan] = useState('KB8773AT');
  const [brutoKg, setBrutoKg] = useState('6780');
  const [dendaKg, setDendaKg] = useState('190');
  const [bulanTanamManual, setBulanTanamManual] = useState('');
  const [umurManual, setUmurManual] = useState('10');
  const [blokLines, setBlokLines] = useState<EditableBlokLine[]>(DEFAULT_BLOK_LINES);
  const [calculatedGroups, setCalculatedGroups] = useState<KalkulasiGroupRow[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const [newKebunName, setNewKebunName] = useState('');
  const [newKebunType, setNewKebunType] = useState<EstateType>('PLASMA');
  const [addingKebun, setAddingKebun] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [deletingAll, setDeletingAll] = useState(false);

  const brutoNum = Math.max(0, Number(brutoKg) || 0);
  const dendaNum = Math.max(0, Math.min(brutoNum, Number(dendaKg) || 0));
  const nettoNum = Math.max(0, brutoNum - dendaNum);
  const persenNum = brutoNum > 0 ? Number(((dendaNum / brutoNum) * 100).toFixed(2)) : 0;

  const enrichedBloks = useMemo(
    () =>
      enrichBlokRows(
        blokLines.map((l) => ({
          blok: l.blok,
          jjg: Number(l.jjg) || 0,
          brd_kg: Number(l.brd_kg) || 0,
        })),
        state.blok_master,
        activeEstate?.name
      ),
    [blokLines, state.blok_master, activeEstate]
  );

  const liveBreakdown = useMemo(() => {
    return calculateEstateBlokBreakdown({
      totalBruto: brutoNum,
      totalDenda: dendaNum,
      blokRows: enrichedBloks,
      kebunType: activeEstate?.type || 'PLASMA',
      tanggalIso: tglTerima,
      intiRates: state.harga_disbun_inti,
      plasmaRates: state.harga_disbun_plasma,
    });
  }, [
    brutoNum,
    dendaNum,
    enrichedBloks,
    activeEstate,
    tglTerima,
    state.harga_disbun_inti,
    state.harga_disbun_plasma,
  ]);

  const activeGroups = calculatedGroups ?? liveBreakdown.groups;

  const autoHarga = useMemo(
    () =>
      lookupHargaDisbun({
        umur: Number(umurManual) || 10,
        tanggalIso: tglTerima,
        kebunType: activeEstate?.type || 'PLASMA',
        intiRates: state.harga_disbun_inti,
        plasmaRates: state.harga_disbun_plasma,
      }),
    [umurManual, tglTerima, activeEstate, state.harga_disbun_inti, state.harga_disbun_plasma]
  );

  const estateTransactions = useMemo(() => {
    return state.estate_transactions
      .filter((t) => t.estate_id === (activeEstate?.id ?? selectedEstateId))
      .filter((t) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          t.no_polisi.toLowerCase().includes(q) ||
          t.bulan_th_tanam.toLowerCase().includes(q) ||
          t.tanggal.includes(q)
        );
      })
      .sort((a, b) => (b.tanggal === a.tanggal ? b.id - a.id : b.tanggal.localeCompare(a.tanggal)));
  }, [state.estate_transactions, activeEstate, selectedEstateId, searchTerm]);

  const handleReset = () => {
    setEditingId(null);
    setNoKendaraan('');
    setBrutoKg('');
    setDendaKg('');
    setBulanTanamManual('');
    setUmurManual('10');
    setBlokLines(Array.from({ length: 10 }, () => ({ blok: '', jjg: '', brd_kg: '' })));
    setCalculatedGroups(null);
    setFormError('');
  };

  const handleKalkulasi = () => {
    setFormError('');
    if (brutoNum <= 0) {
      setFormError('Isi Bruto (Kg) terlebih dahulu sebelum melakukan Kalkulasi.');
      return;
    }
    if (enrichedBloks.length === 0) {
      setFormError('Masukkan minimal 1 baris Blok dengan jumlah Janjang (Jjg) atau Brondolan.');
      return;
    }
    setCalculatedGroups(liveBreakdown.groups);
    if (liveBreakdown.groups.length > 0) {
      setBulanTanamManual(
        Array.from(new Set(liveBreakdown.groups.map((g) => g.bulan_th_tanam)))
          .filter(Boolean)
          .join(', ')
      );
      setUmurManual(String(liveBreakdown.groups[0].umur));
    }
  };

  const handleCommitOk = async () => {
    setFormError('');
    if (!activeEstate) return;
    if (!noKendaraan.trim()) {
      setFormError('No. Kendaraan / No. Polisi wajib diisi.');
      return;
    }
    if (brutoNum <= 0) {
      setFormError('Bruto (Kg) harus lebih besar dari 0.');
      return;
    }

    if (editingId) {
      const existing = state.estate_transactions.find((t) => t.id === editingId);
      const umur = Number(umurManual) || 10;
      const harga = lookupHargaDisbun({
        umur,
        tanggalIso: tglTerima,
        kebunType: activeEstate.type,
        intiRates: state.harga_disbun_inti,
        plasmaRates: state.harga_disbun_plasma,
      });
      await onUpdateEstateTransaction({
        id: editingId,
        estate_id: activeEstate.id,
        tanggal: tglTerima,
        no_polisi: noKendaraan.trim().toUpperCase(),
        bulan_th_tanam: bulanTanamManual || 'Sep-10',
        bruto_kg: brutoNum,
        denda_kg: dendaNum,
        netto_kg: nettoNum,
        persen_denda: persenNum,
        umur,
        harga_rp: harga,
        total_rp: Math.round(nettoNum * harga),
        blok_details_json: JSON.stringify(enrichedBloks),
        validated: existing?.validated ?? 0,
      });
      handleReset();
      return;
    }

    if (activeGroups.length > 0) {
      const rowsToInsert: Array<Omit<EstateTransaction, 'id'>> = activeGroups.map((g) => ({
        estate_id: activeEstate.id,
        tanggal: tglTerima,
        no_polisi: noKendaraan.trim().toUpperCase(),
        bulan_th_tanam: g.bulan_th_tanam || bulanTanamManual || 'Sep-10',
        bruto_kg: g.bruto,
        denda_kg: g.denda,
        netto_kg: g.netto,
        persen_denda: g.persen,
        umur: g.umur,
        harga_rp: g.harga_rp,
        total_rp: g.total_rp,
        blok_details_json: JSON.stringify(g.bloks),
        validated: 0,
      }));
      await onAddEstateTransactions(rowsToInsert);
    } else {
      const umur = Number(umurManual) || 10;
      await onAddEstateTransactions([
        {
          estate_id: activeEstate.id,
          tanggal: tglTerima,
          no_polisi: noKendaraan.trim().toUpperCase(),
          bulan_th_tanam: bulanTanamManual || 'Sep-10',
          bruto_kg: brutoNum,
          denda_kg: dendaNum,
          netto_kg: nettoNum,
          persen_denda: persenNum,
          umur,
          harga_rp: autoHarga,
          total_rp: Math.round(nettoNum * autoHarga),
          blok_details_json: '[]',
          validated: 0,
        },
      ]);
    }
    handleReset();
  };

  const handleSelectRow = (row: EstateTransaction) => {
    setEditingId(row.id);
    setTglTerima(row.tanggal);
    setNoKendaraan(row.no_polisi);
    setBrutoKg(String(row.bruto_kg));
    setDendaKg(String(row.denda_kg));
    setBulanTanamManual(row.bulan_th_tanam);
    setUmurManual(String(row.umur));
    setCalculatedGroups(null);
    try {
      const parsed = JSON.parse(row.blok_details_json || '[]') as Array<{
        blok: string;
        jjg: number;
        brd_kg: number;
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const padded = [...parsed.map((p) => ({
          blok: p.blok,
          jjg: String(p.jjg || ''),
          brd_kg: String(p.brd_kg || ''),
        }))];
        while (padded.length < 10) padded.push({ blok: '', jjg: '', brd_kg: '' });
        setBlokLines(padded);
      }
    } catch {
      /* ignore parse error */
    }
  };

  const handleAddNewKebun = async () => {
    const trimmed = newKebunName.trim();
    if (!trimmed) {
      setFormError('Nama kebun wajib diisi.');
      return;
    }
    setAddingKebun(true);
    setFormError('');
    try {
      await onAddEstate(trimmed.toUpperCase(), newKebunType);
      setNewKebunName('');
    } catch (err) {
      setFormError((err as Error).message || 'Gagal menambah kebun baru.');
    } finally {
      setAddingKebun(false);
    }
  };

  const handleDownloadEstateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      buildEstateTemplateRows(activeEstate?.name || 'PT.MJL PLASMA')
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Estate');
    XLSX.writeFile(wb, 'Template_Import_TBS_Estate.xlsx');
  };

  const handleExportEstateExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = buildEstateTransactionsExcelRows(estateTransactions, state.estates);
    const ws = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              No: 1,
              Kebun: activeEstate?.name || '',
              Tipe: activeEstate?.type || 'PLASMA',
              Tanggal: '',
              No_Polisi: '',
              Bulan_Th_Tanam: '',
              Bruto: 0,
              Denda: 0,
              Netto: 0,
              Persen_Denda: 0,
              Umur: 10,
              Harga: 0,
              Total_Rp: 0,
              Validated: 'Draft',
            },
          ]
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Estate');
    const safeName = (activeEstate?.name || 'All').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Data_TBS_Estate_${safeName}.xlsx`);
  };

  const handleConfirmDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await onDeleteAllEstateTransactions(deleteScope === 'ACTIVE' ? activeEstate?.id : undefined);
      handleReset();
      setShowDeleteAllModal(false);
    } catch (err) {
      setFormError((err as Error).message || 'Gagal menghapus data transaksi kebun.');
      setShowDeleteAllModal(false);
    } finally {
      setDeletingAll(false);
    }
  };

  const jumlahBruto = activeGroups.reduce((s, g) => s + g.bruto, 0);
  const jumlahDenda = activeGroups.reduce((s, g) => s + g.denda, 0);
  const selisihBruto = brutoNum - jumlahBruto;
  const selisihDenda = dendaNum - jumlahDenda;

  return (
    <div className="flex flex-col gap-3 p-3 xl:flex-row xl:items-start lg:p-4">
      {/* LEFT PANEL: Pilih Kebun + Add Kebun */}
      <section className="xl:w-52 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 space-y-2">
          <h2 className="text-xs font-bold text-blue-800 dark:text-sky-300 italic">Pilih Kebun :</h2>
          {canWrite && (
            <div className="space-y-1.5">
              <input
                type="text"
                aria-label="Nama kebun baru"
                placeholder="Nama kebun baru..."
                value={newKebunName}
                onChange={(e) => setNewKebunName(e.target.value)}
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1 text-xs focus:border-sky-600 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  aria-label="Tipe kebun baru"
                  value={newKebunType}
                  onChange={(e) => setNewKebunType(e.target.value as EstateType)}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 py-1 text-[11px] font-semibold"
                >
                  <option value="PLASMA">PLASMA</option>
                  <option value="INTI">INTI</option>
                </select>
                <button
                  type="button"
                  disabled={addingKebun}
                  onClick={handleAddNewKebun}
                  className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="h-3 w-3" />
                  Add Kebun
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="p-1.5 flex flex-row xl:flex-col gap-1 overflow-x-auto max-h-[480px]">
          {state.estates.map((est) => {
            const isSelected = activeEstate?.id === est.id;
            return (
              <button
                key={est.id}
                type="button"
                onClick={() => {
                  onSelectEstate(est.id);
                  setEditingId(null);
                }}
                className={`flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{est.name}</span>
                <span
                  className={`text-[10px] font-mono-num ${
                    isSelected ? 'text-sky-100' : 'text-slate-400'
                  }`}
                >
                  {est.type}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CENTER PANEL: Input Form + Perhitungan Bulan Tanam + Kalkulasi Data */}
      <section className="xl:w-[520px] shrink-0 flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <div>
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">INPUT DATA TBS ESTATE :</h2>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {activeEstate?.name} ({activeEstate?.type})
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCommitOk}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              {editingId ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {editingId ? 'Replace' : 'Simpan'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={async () => {
                  await onDeleteEstateTransaction(editingId);
                  handleReset();
                }}
                className="inline-flex items-center gap-1 rounded bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800"
              >
                <Trash2 className="h-3 w-3" />
                Hapus
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Header Inputs */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Tgl. Terima :</label>
            <input
              type="date"
              value={tglTerima}
              onChange={(e) => setTglTerima(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono-num"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700">No. Kendaraan :</label>
            <input
              type="text"
              value={noKendaraan}
              onChange={(e) => setNoKendaraan(e.target.value.toUpperCase())}
              placeholder="KB8773AT"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono-num uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700">Bruto (Kg) :</label>
            <input
              type="number"
              value={brutoKg}
              onChange={(e) => {
                setBrutoKg(e.target.value);
                setCalculatedGroups(null);
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono-num"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700">Denda (Kg) :</label>
            <input
              type="number"
              value={dendaKg}
              onChange={(e) => {
                setDendaKg(e.target.value);
                setCalculatedGroups(null);
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono-num"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono-num">
          <span>
            Netto (Kg): <strong>{formatNumberID(nettoNum)}</strong>
          </span>
          <span>
            Denda %: <strong>{persenNum.toFixed(2).replace('.', ',')}%</strong>
          </span>
          <span>
            Harga Disbun: <strong className="text-emerald-800">{formatNumberID(autoHarga, 2)}</strong>
          </span>
        </div>

        {/* Two Sub-Tables: Perhitungan Bulan Tanam & Data Breakdown */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Sub-table 1: Perhitungan Bulan Tanam */}
          <div className="sm:col-span-7 rounded border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-blue-900 border-b border-slate-200">
              Perhitungan Bulan Tanam
            </div>
            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="px-1.5 py-1 text-left">Blok</th>
                    <th className="px-1 py-1 text-right">Jjg</th>
                    <th className="px-1 py-1 text-right">Brd</th>
                    <th className="px-1 py-1 text-center">Umur</th>
                    <th className="px-1.5 py-1 text-left">Th Tnm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blokLines.map((line, idx) => {
                    const code = line.blok.trim().toUpperCase();
                    const master = state.blok_master.find((b) => b.kode_blok.toUpperCase() === code);
                    return (
                      <tr key={idx}>
                        <td className="p-0.5 pl-1">
                          <input
                            type="text"
                            aria-label={`Blok baris ${idx + 1}`}
                            value={line.blok}
                            onChange={(e) => {
                              const next = [...blokLines];
                              next[idx] = { ...next[idx], blok: e.target.value.toUpperCase() };
                              setBlokLines(next);
                              setCalculatedGroups(null);
                            }}
                            className="w-11 rounded border border-slate-200 px-1 py-0.5 font-mono-num uppercase"
                          />
                        </td>
                        <td className="p-0.5">
                          <input
                            type="number"
                            aria-label={`Janjang baris ${idx + 1}`}
                            value={line.jjg}
                            onChange={(e) => {
                              const next = [...blokLines];
                              next[idx] = { ...next[idx], jjg: e.target.value };
                              setBlokLines(next);
                              setCalculatedGroups(null);
                            }}
                            className="w-11 rounded border border-slate-200 px-1 py-0.5 text-right font-mono-num"
                          />
                        </td>
                        <td className="p-0.5">
                          <input
                            type="number"
                            aria-label={`Brondolan baris ${idx + 1}`}
                            value={line.brd_kg}
                            onChange={(e) => {
                              const next = [...blokLines];
                              next[idx] = { ...next[idx], brd_kg: e.target.value };
                              setBlokLines(next);
                              setCalculatedGroups(null);
                            }}
                            className="w-11 rounded border border-slate-200 px-1 py-0.5 text-right font-mono-num"
                          />
                        </td>
                        <td className="px-1 py-0.5 text-center font-mono-num text-slate-600 bg-slate-50">
                          {code ? (master ? master.umur_tahun : 10) : ''}
                        </td>
                        <td className="px-1.5 py-0.5 font-mono-num text-slate-600 bg-slate-50 whitespace-nowrap">
                          {code ? (master ? master.bulan_tanam : 'Sep-10') : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-[11px] font-mono-num">
                  <tr>
                    <td className="px-1.5 py-1">Total</td>
                    <td className="px-1 py-1 text-right">{liveBreakdown.totalJjg}</td>
                    <td className="px-1 py-1 text-right text-rose-700">{liveBreakdown.totalBrd}</td>
                    <td colSpan={2} className="px-1.5 py-1 text-right">
                      <button
                        type="button"
                        onClick={handleKalkulasi}
                        className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-300"
                      >
                        <Calculator className="h-3 w-3" />
                        KALKULASI
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Sub-table 2: Data Breakdown per Umur */}
          <div className="sm:col-span-5 flex flex-col justify-between rounded border border-slate-200 overflow-hidden">
            <div>
              <div className="bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-blue-900 border-b border-slate-200">
                Data Breakdown per Umur
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="px-1 py-1 text-center">Umr</th>
                    <th className="px-1 py-1 text-left">Th Tnm</th>
                    <th className="px-1 py-1 text-right">Bruto</th>
                    <th className="px-1 py-1 text-right">Denda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-num">
                  {activeGroups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-slate-400">
                        Klik KALKULASI untuk membagi Bruto & Denda per Umur.
                      </td>
                    </tr>
                  ) : (
                    activeGroups.map((g) => (
                      <tr key={g.umur} className="bg-white">
                        <td className="px-1 py-1 text-center font-bold text-slate-900">{g.umur}</td>
                        <td className="px-1 py-1 text-slate-700 text-[10px]">{g.bulan_th_tanam}</td>
                        <td className="px-1 py-1 text-right font-semibold">{g.bruto}</td>
                        <td className="px-1 py-1 text-right">{g.denda}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 text-[11px] font-mono-num">
                  <tr>
                    <td colSpan={2} className="px-1.5 py-1 text-right italic text-slate-600">
                      Jumlah
                    </td>
                    <td className="px-1 py-1 text-right font-semibold">{jumlahBruto}</td>
                    <td className="px-1 py-1 text-right font-semibold">{jumlahDenda}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-1.5 py-1 text-right italic text-slate-600">
                      Selisih
                    </td>
                    <td
                      className={`px-1 py-1 text-right font-semibold ${
                        selisihBruto !== 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {selisihBruto}
                    </td>
                    <td
                      className={`px-1 py-1 text-right font-semibold ${
                        selisihDenda !== 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {selisihDenda}
                    </td>
                  </tr>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td colSpan={2} className="px-1.5 py-1 text-right">
                      TOTAL
                    </td>
                    <td className="px-1 py-1 text-right">{brutoNum}</td>
                    <td className="px-1 py-1 text-right">{dendaNum}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-2 flex justify-end">
              <button
                type="button"
                onClick={handleCommitOk}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
              >
                <Check className="h-3.5 w-3.5" />
                OK (Simpan Data)
              </button>
            </div>
          </div>
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {formError}
          </p>
        )}
      </section>

      {/* RIGHT PANEL: Estate Data Grid */}
      <section className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
          <div>
            <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400">{activeEstate?.name}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
              {estateTransactions.length} Data
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadEstateTemplate}
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
              onClick={handleExportEstateExcel}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Export Excel
            </button>
            <button
              type="button"
              disabled={!canWrite || state.estate_transactions.length === 0}
              onClick={() => {
                setDeleteScope(estateTransactions.length > 0 ? 'ACTIVE' : 'ALL');
                setShowDeleteAllModal(true);
              }}
              className="inline-flex items-center gap-1 rounded bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Trash2 className="h-3 w-3" />
              Hapus Semua Data
            </button>
            <input
              type="search"
              aria-label="Cari transaksi estate"
              placeholder="Cari No. Polisi / Bln Tanam..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-40 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto max-h-[540px]">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-rose-50 text-rose-800 border-b border-rose-300">
              <tr>
                <th className="px-1.5 py-1.5 font-bold">NO.</th>
                <th className="px-1.5 py-1.5 font-bold">TGL</th>
                <th className="px-1.5 py-1.5 font-bold">NO POLISI</th>
                <th className="px-1.5 py-1.5 font-bold">BLN TANAM</th>
                <th className="px-1.5 py-1.5 text-right font-bold">BRUTO</th>
                <th className="px-1.5 py-1.5 text-right font-bold">DENDA</th>
                <th className="px-1.5 py-1.5 text-right font-bold">NETTO</th>
                <th className="px-1.5 py-1.5 text-right font-bold">%</th>
                <th className="px-1.5 py-1.5 text-center font-bold">UMR</th>
                <th className="px-1.5 py-1.5 text-right font-bold">HARGA</th>
                <th className="px-1.5 py-1.5 text-center font-bold">OK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {estateTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Belum ada data penerimaan untuk kebun ini.
                  </td>
                </tr>
              ) : (
                estateTransactions.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleSelectRow(row)}
                    className={`cursor-pointer transition-colors ${
                      editingId === row.id ? 'bg-sky-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-1.5 py-1.5 font-mono-num">{row.id}</td>
                    <td className="px-1.5 py-1.5 font-mono-num whitespace-nowrap">
                      {formatDateDisplay(row.tanggal)}
                    </td>
                    <td className="px-1.5 py-1.5 font-mono-num font-semibold whitespace-nowrap">
                      {row.no_polisi}
                    </td>
                    <td className="px-1.5 py-1.5 max-w-[110px] truncate" title={row.bulan_th_tanam}>
                      {row.bulan_th_tanam}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono-num">
                      {formatNumberID(row.bruto_kg)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono-num">
                      {formatNumberID(row.denda_kg)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono-num font-semibold">
                      {formatNumberID(row.netto_kg)}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono-num">
                      {row.persen_denda.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-1.5 py-1.5 text-center font-mono-num">{row.umur}</td>
                    <td className="px-1.5 py-1.5 text-right font-mono-num">
                      {formatNumberID(row.harga_rp, 0)}
                    </td>
                    <td
                      className="px-1.5 py-1.5 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBulkValidateEstate([row.id], row.validated !== 1);
                      }}
                    >
                      {row.validated === 1 ? (
                        <span className="text-emerald-700 font-bold">OK</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between text-xs font-mono-num">
          <span>
            Total Netto:{' '}
            <strong>
              {formatNumberID(estateTransactions.reduce((s, r) => s + r.netto_kg, 0))} kg
            </strong>
          </span>
          <span className="font-bold text-emerald-800">
            {formatRupiah(estateTransactions.reduce((s, r) => s + r.total_rp, 0))}
          </span>
        </div>
      </section>

      {/* In-UI Confirmation Modal for Hapus Semua Data Estate */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="est-delete-all-title"
            className="w-full max-w-md rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900 bg-rose-700 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <h3 id="est-delete-all-title" className="text-xs font-bold">
                  Konfirmasi Hapus Semua Data Estate
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
              <p>Pilih cakupan data timbangan Estate yang ingin dihapus dari database:</p>
              <div className="space-y-2">
                {activeEstate && (
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="estDeleteScope"
                      checked={deleteScope === 'ACTIVE'}
                      onChange={() => setDeleteScope('ACTIVE')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Hanya Kebun Aktif: {activeEstate.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Menghapus seluruh transaksi milik {activeEstate.name} saja.
                      </p>
                    </div>
                  </label>
                )}
                <label className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="estDeleteScope"
                    checked={deleteScope === 'ALL'}
                    onChange={() => setDeleteScope('ALL')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      Seluruh Data Transaksi Semua Kebun ({state.estate_transactions.length} baris)
                    </p>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Menghapus semua baris transaksi timbangan dari seluruh kebun estate.
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
