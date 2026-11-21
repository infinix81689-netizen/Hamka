import React from 'react';
import {
  ArrowRight,
  Database,
  FileBarChart2,
  FileSpreadsheet,
  Layers,
  Scale,
  Sliders,
  Truck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AppDatabaseState, NavTab, UserAccount } from '../types/tbs';
import { formatNumberID, formatRupiah } from '../utils/tbsCalculations';

interface HomeDashboardProps {
  state: AppDatabaseState;
  currentUser: UserAccount;
  isOnline: boolean;
  syncQueueCount: number;
  onNavigate: (tab: NavTab) => void;
  onOpenSqlModal: () => void;
  onExportSql: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  state,
  currentUser,
  isOnline,
  syncQueueCount,
  onNavigate,
  onOpenSqlModal,
  onExportSql,
}) => {
  const supNetto = state.supplier_transactions.reduce((s, r) => s + r.netto_kg, 0);
  const supTotalRp = state.supplier_transactions.reduce((s, r) => s + r.total_rp, 0);
  const supValidated = state.supplier_transactions.filter((r) => r.validated === 1).length;

  const estNetto = state.estate_transactions.reduce((s, r) => s + r.netto_kg, 0);
  const estTotalRp = state.estate_transactions.reduce((s, r) => s + r.total_rp, 0);
  const estValidated = state.estate_transactions.filter((r) => r.validated === 1).length;

  const totalNetto = supNetto + estNetto;
  const totalPembayaran = supTotalRp + estTotalRp;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Ringkasan Operasional Pembelian TBS
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {state.settings.company_name} ({state.settings.company_subtitle}) · Login:{' '}
            <strong className="text-slate-900 dark:text-white">{currentUser.full_name}</strong> [{currentUser.role}] ·
            Periode aktif {state.settings.periode_mulai} s/d {state.settings.periode_selesai}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <FileBarChart2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Menu Laporan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pengaturan')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Pengaturan & TTD
          </button>
          <button
            type="button"
            onClick={onOpenSqlModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Database className="h-4 w-4 text-sky-700 dark:text-sky-400" />
            Inspeksi database.sql
          </button>
          <button
            type="button"
            onClick={onExportSql}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Unduh database.sql
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Netto TBS Masuk</span>
            <Scale className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
            {formatNumberID(totalNetto)} kg
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            Suppliers: {formatNumberID(supNetto)} kg · Estate: {formatNumberID(estNetto)} kg
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Estimasi Total Pembayaran</span>
            <FileSpreadsheet className="h-4 w-4 text-sky-700 dark:text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
            {formatRupiah(totalPembayaran)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {state.supplier_transactions.length + state.estate_transactions.length} tiket timbangan tercatat
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Suppliers & Estate Aktif</span>
            <Users className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
            {state.suppliers.length} / {state.estates.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {state.blok_master.length} master blok kebun terdaftar
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Status Mode & Sinkronisasi</span>
            {isOnline ? (
              <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {isOnline ? 'Online · SQLite Aktif' : 'Offline · IndexedDB Aktif'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {syncQueueCount === 0
              ? 'Semua perubahan tersinkronisasi'
              : `${syncQueueCount} perubahan menunggu sync`}
          </p>
        </div>
      </div>

      {/* Quick Module Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Truck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>Input Data TBS Suppliers</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Kelola {state.suppliers.length} supplier, input tiket Bruto/Denda/Grade/DxP, validasi batch, dan pengaturan
              harga HQ/MQ/A/B.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              <span>{state.supplier_transactions.length} Data</span>
              <span>·</span>
              <span>{supValidated} Valid</span>
              <span>·</span>
              <span>{formatRupiah(supTotalRp)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('suppliers')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 self-start"
          >
            Buka Modul Suppliers
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Layers className="h-4 w-4 text-sky-700 dark:text-sky-400" />
              <span>Input Data TBS Estate</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Pilih kebun Plasma/Inti, hitung BJR otomatis menurut umur blok tanam, lalu simpan ke tabel penerimaan
              estate.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              <span>{state.estate_transactions.length} Data</span>
              <span>·</span>
              <span>{estValidated} Valid</span>
              <span>·</span>
              <span>{formatRupiah(estTotalRp)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('estate')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 self-start"
          >
            Buka Modul Estate
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileBarChart2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Menu Laporan & Cetak PDF</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Rekap Pembayaran Relasi (PPh 22 & 4(2), Subsidi), Detail Supplier (Tenera), Draft Inti/Plasma, hingga
              Rekap Gabungan Harian.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Format PDF Resmi</span>
              <span>·</span>
              <span>Terbilang & TTD Otomatis</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 self-start"
          >
            Buka Menu Laporan
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Recent Transactions Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tiket Timbangan Suppliers Terbaru</h3>
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
          >
            Buka Laporan Rekapitulasi →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 font-semibold">Tanggal</th>
                <th className="px-3 py-2 font-semibold">Supplier</th>
                <th className="px-3 py-2 font-semibold">No. Kendaraan</th>
                <th className="px-3 py-2 text-right font-semibold">Bruto (Kg)</th>
                <th className="px-3 py-2 text-right font-semibold">Denda (Kg)</th>
                <th className="px-3 py-2 text-right font-semibold">Netto (Kg)</th>
                <th className="px-3 py-2 text-right font-semibold">Harga (Rp)</th>
                <th className="px-3 py-2 text-right font-semibold">Total (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.supplier_transactions.slice(0, 6).map((tx) => {
                const supName =
                  state.suppliers.find((s) => s.id === tx.supplier_id)?.name || `Supplier #${tx.supplier_id}`;
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2 font-mono-num whitespace-nowrap">{tx.tanggal}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {supName}
                    </td>
                    <td className="px-3 py-2 font-mono-num whitespace-nowrap">{tx.no_kendaraan}</td>
                    <td className="px-3 py-2 text-right font-mono-num">{formatNumberID(tx.bruto_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono-num">{formatNumberID(tx.denda_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono-num font-semibold">{formatNumberID(tx.netto_kg)}</td>
                    <td className="px-3 py-2 text-right font-mono-num">{formatNumberID(tx.harga_rp)}</td>
                    <td className="px-3 py-2 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatRupiah(tx.total_rp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
