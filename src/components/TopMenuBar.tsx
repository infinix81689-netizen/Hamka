import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Database,
  FileSpreadsheet,
  FolderOpen,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  FileText,
  Edit3,
  LayoutDashboard,
  LogOut,
  UserCheck,
} from 'lucide-react';
import type { AppSettings, NavTab, UserAccount } from '../types/tbs';
import { PWAInstallButton } from './PWAInstallButton';
import { CompanyLogo } from './CompanyLogo';

interface TopMenuBarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  currentUser: UserAccount;
  onLogout: () => void;
  isOnline: boolean;
  forceOffline: boolean;
  onToggleForceOffline: () => void;
  syncQueueCount: number;
  isSyncing: boolean;
  onManualSync: () => void;
  onOpenSqlModal: () => void;
  onOpenImportModal: () => void;
  onExportSql: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onRefresh: () => void;
  onNewData: () => void;
  onBulkValidateAll: (validated: boolean) => void;
  onSearchShortcut: () => void;
  onRekapPeriodeShortcut: (start: string, end: string) => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  activeTab,
  onChangeTab,
  currentUser,
  onLogout,
  isOnline,
  forceOffline,
  onToggleForceOffline,
  syncQueueCount,
  isSyncing,
  onManualSync,
  onOpenSqlModal,
  onOpenImportModal,
  onExportSql,
  onExportExcel,
  onPrint,
  onRefresh,
  onNewData,
  onBulkValidateAll,
  onSearchShortcut,
  onRekapPeriodeShortcut,
  settings,
  onUpdateSettings,
}) => {
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'setting' | null>(null);
  const [rekapSupStart, setRekapSupStart] = useState(settings.periode_mulai);
  const [rekapSupEnd, setRekapSupEnd] = useState(settings.periode_selesai);
  const [rekapEstDate, setRekapEstDate] = useState(settings.periode_selesai);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRekapSupStart(settings.periode_mulai);
    setRekapSupEnd(settings.periode_selesai);
    setRekapEstDate(settings.periode_selesai);
  }, [settings.periode_mulai, settings.periode_selesai]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const canWrite = currentUser.role !== 'VIEWER';
  const companyTitle =
    settings.company_subtitle && !settings.company_name.includes(settings.company_subtitle)
      ? `${settings.company_name} · ${settings.company_subtitle}`
      : settings.company_name;

  return (
    <header className="no-print border-b border-slate-800/80 bg-brand-primary text-white">
      {/* Main Institutional Header with Elegant Animated Aura & Shimmer */}
      <div className="relative overflow-hidden header-animated-bg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent header-shimmer-sweep"
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo
              logoUrl={settings.company_logo}
              companyName={settings.company_name}
              size="sm"
            />
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-bold tracking-tight text-white leading-tight truncate">
                PERHITUNGAN PEMBAYARAN PEMBELIAN
              </h1>
              <p className="text-xs text-brand-highlight font-medium truncate">
                {companyTitle}
              </p>
            </div>
          </div>

          {/* Connectivity, User & Database SQL Actions */}
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleForceOffline}
            title={forceOffline ? 'Klik untuk kembali ke Mode Online' : 'Klik untuk simulasi Mode Offline'}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isOnline
                ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/70'
                : 'border-amber-400/60 bg-amber-950/70 text-amber-200 hover:bg-amber-900/70'
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{isOnline ? 'Online (SQLite)' : forceOffline ? 'Offline (Simulasi)' : 'Offline (Lokal)'}</span>
          </button>

          {syncQueueCount > 0 && (
            <button
              type="button"
              onClick={onManualSync}
              disabled={!isOnline || isSyncing}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <UploadCloud className={`h-3.5 w-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>Sync ({syncQueueCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSqlModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/20 whitespace-nowrap shrink-0"
          >
            <Database className="h-3.5 w-3.5 text-sky-300" />
            <span>database.sql</span>
          </button>

          <PWAInstallButton />

          <div className="flex items-center gap-1.5 rounded-md border border-white/20 bg-black/20 pl-2.5 pr-1 py-1 text-xs whitespace-nowrap shrink-0">
            <UserCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span className="font-semibold text-white">{currentUser.full_name}</span>
            <span className="text-[10px] font-mono-num uppercase text-amber-300">
              [{currentUser.role}]
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="Keluar / Ganti Pengguna"
              aria-label="Keluar dari aplikasi"
              className="ml-1 inline-flex items-center gap-1 rounded bg-rose-600/90 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-500 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3 w-3" />
              Keluar
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Ribbon Action Bar */}
      <div
        ref={menuRef}
        className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-brand-secondary px-4 py-1.5 lg:px-6"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onChangeTab('home');
              setOpenMenu(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'home'
                ? 'bg-white text-slate-900'
                : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </button>

          {/* File Data Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'file'}
              onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'file' ? 'bg-white text-slate-900' : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              File Data
              <ChevronDown className="h-3 w-3 opacity-80" />
            </button>

            {openMenu === 'file' && (
              <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 shadow-xl">
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onNewData();
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-sky-600" />
                    New Data (Reset Form Input)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExportExcel();
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Database Excel (Export XLSX)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExportSql();
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Database className="h-3.5 w-3.5 text-indigo-600" />
                    Export database.sql
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRefresh();
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    Refresh & Sinkronisasi
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => {
                        onManualSync();
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Save className="h-3.5 w-3.5 text-amber-600" />
                      Save / Commit ke Database
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onPrint();
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                    Export PDF / Print Laporan
                  </button>
                </div>

                {/* Rekap Suppliers Per Tgl */}
                <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                  <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">Laporan Suppliers Per Tgl</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={rekapSupStart}
                      onChange={(e) => setRekapSupStart(e.target.value)}
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-1 text-[11px] font-mono-num"
                    />
                    <input
                      type="date"
                      value={rekapSupEnd}
                      onChange={(e) => setRekapSupEnd(e.target.value)}
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-1 text-[11px] font-mono-num"
                    />
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onRekapPeriodeShortcut(rekapSupStart, rekapSupEnd);
                        setOpenMenu(null);
                      }}
                      className="flex-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Buka Laporan (OK)
                    </button>
                  </div>
                </div>

                {/* Rekap Estate Per Tgl */}
                <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Laporan Estate Per Tgl</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      type="date"
                      value={rekapEstDate}
                      onChange={(e) => setRekapEstDate(e.target.value)}
                      className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-1 text-[11px] font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onRekapPeriodeShortcut(rekapEstDate, rekapEstDate);
                        setOpenMenu(null);
                      }}
                      className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Edit Data Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'edit'}
              onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'edit' ? 'bg-white text-slate-900' : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Data
              <ChevronDown className="h-3 w-3 opacity-80" />
            </button>

            {openMenu === 'edit' && (
              <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 shadow-xl space-y-0.5">
                {canWrite && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onBulkValidateAll(false);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Square className="h-3.5 w-3.5 text-slate-500" />
                      Hapus Cek Validasi All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onBulkValidateAll(true);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                      New Cek Validasi All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onManualSync();
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Save className="h-3.5 w-3.5 text-sky-600" />
                      Save Data Cek Validasi
                    </button>
                    <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={() => {
                        onNewData();
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Bersihkan Form Input
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSearchShortcut();
                    setOpenMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Search className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  Search / Cari Transaksi
                </button>
              </div>
            )}
          </div>

          {/* Setting Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'setting'}
              onClick={() => setOpenMenu(openMenu === 'setting' ? null : 'setting')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'setting' ? 'bg-white text-slate-900' : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Setting
              <ChevronDown className="h-3 w-3 opacity-80" />
            </button>

            {openMenu === 'setting' && (
              <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 shadow-xl space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onChangeTab('pengaturan');
                    setOpenMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                >
                  <span>Pengaturan Logo, Tema, Hak Akses & TTD</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeTab('master');
                    setOpenMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs font-semibold text-sky-900 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60"
                >
                  <span>Master Blok & Harga Disbun</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSqlModal();
                    setOpenMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>Kelola database.sql & SQLite</span>
                  <span>→</span>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-slate-700 pt-1">
                  <label className="flex cursor-pointer items-center justify-between rounded px-2.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span>Tampilkan Gridlines Tabel</span>
                    <input
                      type="checkbox"
                      checked={settings.show_gridlines}
                      onChange={(e) => onUpdateSettings({ show_gridlines: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded px-2.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span>Tampilkan Ringkasan Formula</span>
                    <input
                      type="checkbox"
                      checked={settings.show_formulabar}
                      onChange={(e) => onUpdateSettings({ show_formulabar: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: File Import Data Timbangan */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] font-medium text-slate-300 whitespace-nowrap">
            File Import Data Timbangan (Excel):
          </span>
          <button
            type="button"
            disabled={!canWrite}
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Import Timbangan
          </button>
        </div>
      </div>
    </header>
  );
};
