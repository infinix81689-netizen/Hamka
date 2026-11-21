import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  FileSignature,
  Image as ImageIcon,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AppDatabaseState,
  AppSettings,
  PphType,
  Supplier,
  ThemePreset,
  UserAccount,
  UserRole,
} from '../types/tbs';
import { CompanyLogo } from './CompanyLogo';
import {
  DEFAULT_FOOTER_RUNNING_TEXT,
  DEFAULT_SIDEBAR_BG_IMAGE,
  isValidLogoUrl,
} from '../utils/tbsCalculations';

interface PengaturanViewProps {
  state: AppDatabaseState;
  currentUser: UserAccount;
  authToken: string;
  isOnline: boolean;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onUpdateSupplierMeta: (supplier: Supplier) => Promise<void>;
}

const THEME_PRESETS: Array<{
  id: ThemePreset;
  name: string;
  desc: string;
  primary: string;
  accent: string;
}> = [
  {
    id: 'navy-emerald',
    name: 'Navy Mill & Emerald',
    desc: 'Klasik korporat FSK dengan aksen hijau sawit',
    primary: '#0F2942',
    accent: '#047857',
  },
  {
    id: 'forest-gold',
    name: 'Forest Plantation & Gold',
    desc: 'Hijau perkebunan dalam dengan aksen emas hangat',
    primary: '#143326',
    accent: '#B45309',
  },
  {
    id: 'slate-indigo',
    name: 'Slate & Indigo Executive',
    desc: 'Nuansa modern tegas untuk departemen finansial',
    primary: '#1E1B4B',
    accent: '#4338CA',
  },
  {
    id: 'crimson-charcoal',
    name: 'Charcoal & Crimson',
    desc: 'Kontras tinggi industrial dengan aksen merah marun',
    primary: '#1C1917',
    accent: '#B91C1C',
  },
];

type SettingsSection = 'company' | 'theme' | 'ttd' | 'access';

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  state,
  currentUser,
  authToken,
  isOnline,
  onUpdateSettings,
  onUpdateSupplierMeta,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [section, setSection] = useState<SettingsSection>('company');
  const [draft, setDraft] = useState<AppSettings>(state.settings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // User Management state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    role: 'OPERATOR' as UserRole,
    password: '',
  });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: '',
    role: 'OPERATOR' as UserRole,
    active: true,
    password: '',
  });

  // Supplier SPK/Subsidi quick edit state
  const [editingSup, setEditingSup] = useState<Supplier | null>(null);

  useEffect(() => {
    setDraft(state.settings);
  }, [state.settings]);

  const loadUsers = async () => {
    if (!isAdmin || !isOnline) return;
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (section === 'access' && isAdmin && isOnline) {
      loadUsers();
    }
  }, [section, isAdmin, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveSettings = async (partial: Partial<AppSettings>, successLabel: string) => {
    setSaving(true);
    setStatusMsg(null);
    try {
      if (typeof partial.company_logo === 'string' && !isValidLogoUrl(partial.company_logo)) {
        setStatusMsg({ type: 'err', text: 'Format logo tidak valid. Gunakan PNG/JPG/WebP (maks 1.5MB).' });
        return;
      }
      if (typeof partial.sidebar_bg_image === 'string' && !isValidLogoUrl(partial.sidebar_bg_image)) {
        setStatusMsg({ type: 'err', text: 'Format gambar sidebar tidak valid. Gunakan PNG/JPG/WebP (maks 1.5MB).' });
        return;
      }
      await onUpdateSettings(partial);
      setStatusMsg({ type: 'ok', text: successLabel });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message || 'Gagal menyimpan pengaturan.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setStatusMsg({ type: 'err', text: 'Gunakan file gambar PNG, JPG, WebP, atau GIF.' });
      return;
    }
    if (file.size > 1_000_000) {
      setStatusMsg({ type: 'err', text: 'Ukuran file logo maksimal 1 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (isValidLogoUrl(dataUrl)) {
        setDraft((d) => ({ ...d, company_logo: dataUrl }));
        setStatusMsg({ type: 'ok', text: 'Preview logo dimuat. Klik Simpan Profil untuk menerapkan.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSidebarBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setStatusMsg({ type: 'err', text: 'Gunakan file gambar PNG, JPG, WebP, atau GIF untuk background sidebar.' });
      return;
    }
    if (file.size > 1_000_000) {
      setStatusMsg({ type: 'err', text: 'Ukuran file gambar background sidebar maksimal 1 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (isValidLogoUrl(dataUrl)) {
        setDraft((d) => ({ ...d, sidebar_bg_image: dataUrl }));
        setStatusMsg({ type: 'ok', text: 'Preview background sidebar dimuat. Klik Simpan Background Sidebar untuk menerapkan.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!isOnline) {
      setStatusMsg({ type: 'err', text: 'Manajemen user membutuhkan koneksi Online ke server SQLite.' });
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newUser),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: json.error || 'Gagal menambah user.' });
        return;
      }
      setUsers(json.users || []);
      setNewUser({ username: '', full_name: '', role: 'OPERATOR', password: '' });
      setStatusMsg({ type: 'ok', text: 'Akun pengguna baru berhasil ditambahkan.' });
    } catch {
      setStatusMsg({ type: 'err', text: 'Koneksi gagal saat menambah user.' });
    }
  };

  const handleUpdateUser = async (id: number) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(editUserForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: json.error || 'Gagal memperbarui user.' });
        return;
      }
      setUsers(json.users || []);
      setEditingUserId(null);
      setStatusMsg({ type: 'ok', text: 'Data hak akses pengguna diperbarui.' });
    } catch {
      setStatusMsg({ type: 'err', text: 'Koneksi gagal saat memperbarui user.' });
    }
  };

  const handleDeleteUser = async (id: number) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: json.error || 'Gagal menghapus user.' });
        return;
      }
      setUsers(json.users || []);
      setStatusMsg({ type: 'ok', text: 'Akun pengguna berhasil dihapus.' });
    } catch {
      setStatusMsg({ type: 'err', text: 'Gagal menghapus user.' });
    }
  };

  const sectionTabs: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'company', label: 'Logo & Perusahaan', icon: <Building2 className="h-4 w-4" /> },
    { id: 'theme', label: 'Tema & Tampilan', icon: <Palette className="h-4 w-4" /> },
    { id: 'ttd', label: 'TTD, Pajak & SPK', icon: <FileSignature className="h-4 w-4" /> },
    { id: 'access', label: 'Hak Akses Login', icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Pengaturan Sistem, Branding & Hak Akses
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Konfigurasi logo perusahaan, nama mill, tema antarmuka, tanda tangan laporan (TTD), dan akun pengguna.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-slate-700 dark:text-slate-200">
            Login sebagai <strong>{currentUser.full_name}</strong> ({currentUser.role})
          </span>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setSection(tab.id);
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              section === tab.id
                ? 'bg-brand-primary text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* SECTION 1: COMPANY & LOGO */}
      {section === 'company' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Logo Perusahaan</h3>
            <div className="flex items-center gap-4">
              <CompanyLogo
                logoUrl={draft.company_logo}
                companyName={draft.company_name}
                size="xl"
              />
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Logo (PNG/JPG)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleLogoUpload}
                    disabled={!isAdmin}
                    className="hidden"
                  />
                </label>
                {draft.company_logo && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, company_logo: '' }))}
                    className="block text-xs font-medium text-rose-600 hover:underline"
                  >
                    <span className="inline-flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" /> Reset ke Logo Bawaan
                    </span>
                  </button>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ditampilkan di Header, Halaman Login, dan Kop Laporan PDF.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Identitas & Periode Default</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Perusahaan
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={draft.company_name}
                  onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unit / Pabrik (Subjudul)
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={draft.company_subtitle}
                  onChange={(e) => setDraft({ ...draft, company_subtitle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kota Penandatanganan Laporan
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={draft.report_city}
                  onChange={(e) => setDraft({ ...draft, report_city: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Grad (%) Suppliers
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isAdmin}
                  value={draft.max_grad_pct}
                  onChange={(e) => setDraft({ ...draft, max_grad_pct: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono-num text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Periode Aktif Mulai
                </label>
                <input
                  type="date"
                  disabled={!isAdmin}
                  value={draft.periode_mulai}
                  onChange={(e) => setDraft({ ...draft, periode_mulai: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono-num text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Periode Aktif Selesai
                </label>
                <input
                  type="date"
                  disabled={!isAdmin}
                  value={draft.periode_selesai}
                  onChange={(e) => setDraft({ ...draft, periode_selesai: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono-num text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="pengaturan-footer-text"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Tulisan Berjalan Footer (Running Text)
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, footer_running_text: DEFAULT_FOOTER_RUNNING_TEXT })}
                      className="text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      Reset Teks Default
                    </button>
                  )}
                </div>
                <input
                  id="pengaturan-footer-text"
                  type="text"
                  disabled={!isAdmin}
                  value={draft.footer_running_text}
                  onChange={(e) => setDraft({ ...draft, footer_running_text: e.target.value })}
                  placeholder={DEFAULT_FOOTER_RUNNING_TEXT}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
            </div>

            {isAdmin ? (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSaveSettings(
                      {
                        company_name: draft.company_name,
                        company_subtitle: draft.company_subtitle,
                        company_logo: draft.company_logo,
                        report_city: draft.report_city,
                        max_grad_pct: draft.max_grad_pct,
                        periode_mulai: draft.periode_mulai,
                        periode_selesai: draft.periode_selesai,
                        footer_running_text: draft.footer_running_text,
                      },
                      'Identitas, Logo & Tulisan Footer berhasil disimpan.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Profil Perusahaan
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Hanya peran ADMIN yang dapat mengubah profil dan logo perusahaan.
              </p>
            )}
          </div>

          {/* Sidebar Background Image & Zoom In/Out Animation Card */}
          <div className="lg:col-span-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-emerald-600" />
                  Background Gambar Sidebar (Animasi Zoom In & Out)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ubah gambar latar belakang panel sidebar kiri serta aktifkan efek gerak zoom in &amp; zoom out secara halus.
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSaveSettings(
                      {
                        sidebar_bg_image: draft.sidebar_bg_image,
                        sidebar_bg_zoom: draft.sidebar_bg_zoom,
                      },
                      'Background gambar & animasi sidebar berhasil disimpan.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Background Sidebar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-xs">
              <div className="md:col-span-4">
                <div className="relative h-36 w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-brand-primary">
                  {draft.sidebar_bg_image ? (
                    <img
                      src={draft.sidebar_bg_image}
                      alt="Preview background sidebar"
                      className={`h-full w-full object-cover ${draft.sidebar_bg_zoom ? 'sidebar-bg-zoom-anim' : ''}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300 text-xs">
                      Latar Solid Tema Aktif
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/80 flex items-end p-3">
                    <span className="text-[11px] font-semibold text-white">
                      Preview Sidebar ({draft.sidebar_bg_zoom ? 'Zoom In/Out Aktif' : 'Statis'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 font-semibold text-white hover:opacity-90">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Gambar Sidebar (PNG/JPG)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleSidebarBgUpload}
                      disabled={!isAdmin}
                      className="hidden"
                    />
                  </label>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({ ...d, sidebar_bg_image: DEFAULT_SIDEBAR_BG_IMAGE, sidebar_bg_zoom: true }))
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Pakai Gambar Sawit &amp; Mill Bawaan
                      </button>
                      {draft.sidebar_bg_image && (
                        <button
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, sidebar_bg_image: '' }))}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus Gambar
                        </button>
                      )}
                    </>
                  )}
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 p-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Aktifkan Animasi Zoom In &amp; Zoom Out Sidebar
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Gambar latar sidebar bergerak zoom-in dan zoom-out perlahan secara elegan.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={draft.sidebar_bg_zoom}
                    onChange={(e) => setDraft((d) => ({ ...d, sidebar_bg_zoom: e.target.checked }))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: THEME & APPEARANCE */}
      {section === 'theme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Palet Tema Aplikasi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEME_PRESETS.map((preset) => {
                const selected = draft.theme_preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({ ...d, theme_preset: preset.id }));
                      handleSaveSettings({ theme_preset: preset.id }, `Tema "${preset.name}" diterapkan.`);
                    }}
                    className={`flex items-start justify-between rounded-xl border p-3.5 text-left transition-all ${
                      selected
                        ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-white/40 shadow-xs"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-white/40 shadow-xs"
                          style={{ backgroundColor: preset.accent }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {preset.desc}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mode Tampilan & Tabel</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2.5">
                  {draft.dark_mode ? (
                    <Moon className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Mode Gelap (Dark Mode)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Nyaman di ruang operator timbangan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.dark_mode}
                  onClick={() => {
                    const next = !draft.dark_mode;
                    setDraft((d) => ({ ...d, dark_mode: next }));
                    handleSaveSettings({ dark_mode: next }, `Mode ${next ? 'Gelap' : 'Terang'} diaktifkan.`);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    draft.dark_mode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      draft.dark_mode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <span className="font-medium text-slate-800 dark:text-slate-200">Tampilkan Gridlines Tabel</span>
                <input
                  type="checkbox"
                  checked={draft.show_gridlines}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setDraft((d) => ({ ...d, show_gridlines: v }));
                    handleSaveSettings({ show_gridlines: v }, 'Pengaturan gridlines disimpan.');
                  }}
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <span className="font-medium text-slate-800 dark:text-slate-200">Tampilkan Ringkasan Formula</span>
                <input
                  type="checkbox"
                  checked={draft.show_formulabar}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setDraft((d) => ({ ...d, show_formulabar: v }));
                    handleSaveSettings({ show_formulabar: v }, 'Pengaturan ringkasan formula disimpan.');
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SIGNATURES (TTD), TAXES & SUPPLIER SPK/SUBSIDI */}
      {section === 'ttd' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Penandatangan Resmi Laporan (TTD) & Tarif Pajak
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nama dan jabatan di bawah ini muncul otomatis pada seluruh cetakan Laporan & Draft Perhitungan TBS.
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSaveSettings(
                      {
                        ttd_disetujui_name: draft.ttd_disetujui_name,
                        ttd_disetujui_title: draft.ttd_disetujui_title,
                        ttd_diperiksa_name: draft.ttd_diperiksa_name,
                        ttd_diperiksa_title: draft.ttd_diperiksa_title,
                        ttd_disiapkan_name: draft.ttd_disiapkan_name,
                        ttd_disiapkan_title: draft.ttd_disiapkan_title,
                        pph22_rate: draft.pph22_rate,
                        pph4_rate: draft.pph4_rate,
                      },
                      'Penandatangan (TTD) & tarif PPh berhasil disimpan.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan TTD & Pajak
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                {
                  label: 'Disetujui,',
                  nameKey: 'ttd_disetujui_name' as const,
                  titleKey: 'ttd_disetujui_title' as const,
                },
                {
                  label: 'Diperiksa,',
                  nameKey: 'ttd_diperiksa_name' as const,
                  titleKey: 'ttd_diperiksa_title' as const,
                },
                {
                  label: 'Disiapkan / Dibuat,',
                  nameKey: 'ttd_disiapkan_name' as const,
                  titleKey: 'ttd_disiapkan_title' as const,
                },
              ].map((block) => (
                <div
                  key={block.label}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3 space-y-2"
                >
                  <p className="font-bold text-slate-800 dark:text-slate-100">{block.label}</p>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Nama Lengkap</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={draft[block.nameKey]}
                      onChange={(e) => setDraft({ ...draft, [block.nameKey]: e.target.value })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Jabatan</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={draft[block.titleKey]}
                      onChange={(e) => setDraft({ ...draft, [block.titleKey]: e.target.value })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tarif PPh Pasal 22 (Desimal, misal 0.0025 = 0.25%)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  disabled={!isAdmin}
                  value={draft.pph22_rate}
                  onChange={(e) => setDraft({ ...draft, pph22_rate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tarif PPh Pasal 4(2) (Desimal, misal 0.005 = 0.50%)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  disabled={!isAdmin}
                  value={draft.pph4_rate}
                  onChange={(e) => setDraft({ ...draft, pph4_rate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono-num"
                />
              </div>
            </div>
          </div>

          {/* Supplier SPK, Subsidi & PPh Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Parameter SPK, Subsidi Transport & PPh Per Supplier
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Digunakan pada Laporan Rekapitulasi Pembelian TBS Dari Relasi.
                </p>
              </div>
            </div>

            {editingSup && (
              <div className="border-b border-slate-200 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <span className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    Edit: {editingSup.name}
                  </span>
                  <input
                    type="text"
                    value={editingSup.masa_berlaku_spk || 's/d 31/12/26'}
                    onChange={(e) => setEditingSup({ ...editingSup, masa_berlaku_spk: e.target.value })}
                    placeholder="Masa Berlaku SPK"
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subsidi Netto (Rp/Kg)
                  </label>
                  <input
                    type="number"
                    value={editingSup.subsidi_netto_rp ?? 0}
                    onChange={(e) => setEditingSup({ ...editingSup, subsidi_netto_rp: Number(e.target.value) })}
                    className="w-28 rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono-num text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subsidi Tenera (Rp/Kg)
                  </label>
                  <input
                    type="number"
                    value={editingSup.subsidi_tenera_rp ?? 100}
                    onChange={(e) => setEditingSup({ ...editingSup, subsidi_tenera_rp: Number(e.target.value) })}
                    className="w-28 rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono-num text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jenis PPh
                  </label>
                  <select
                    value={editingSup.pph_type || 'PPH22'}
                    onChange={(e) => setEditingSup({ ...editingSup, pph_type: e.target.value as PphType })}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900"
                  >
                    <option value="PPH22">PPh Pasal 22 (0.25%)</option>
                    <option value="PPH4_2">PPh Pasal 4(2) (0.50%)</option>
                    <option value="NONE">Bebas PPh</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateSupplierMeta(editingSup);
                    setEditingSup(null);
                    setStatusMsg({ type: 'ok', text: `Parameter SPK & Subsidi ${editingSup.name} diperbarui.` });
                  }}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSup(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700"
                >
                  Batal
                </button>
              </div>
            )}

            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Nama Supplier / Relasi</th>
                    <th className="px-3 py-2 font-semibold">Masa Berlaku SPK</th>
                    <th className="px-3 py-2 text-right font-semibold">Subsidi Netto</th>
                    <th className="px-3 py-2 text-right font-semibold">Subsidi Tenera</th>
                    <th className="px-3 py-2 font-semibold">PPh</th>
                    <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                      <td className="px-3 py-2 font-mono-num">{s.masa_berlaku_spk || 's/d 31/12/26'}</td>
                      <td className="px-3 py-2 text-right font-mono-num">Rp {s.subsidi_netto_rp ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono-num">Rp {s.subsidi_tenera_rp ?? 100}</td>
                      <td className="px-3 py-2 font-mono-num">{s.pph_type || 'PPH22'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingSup({ ...s })}
                          className="rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Ubah
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LOGIN ACCESS & USER MANAGEMENT */}
      {section === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daftar Pengguna & Hak Akses Login
                </h3>
              </div>
              {isAdmin && isOnline && (
                <button
                  type="button"
                  onClick={loadUsers}
                  className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                >
                  Muat Ulang
                </button>
              )}
            </div>

            {!isAdmin ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-200">
                Halaman manajemen user hanya tersedia untuk akun dengan peran <strong>ADMIN</strong>.
              </div>
            ) : !isOnline ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-200">
                Mode Offline aktif. Hubungkan ke server SQLite (Online) untuk menambah atau mengubah akun pengguna.
              </div>
            ) : (
              <>
                <form
                  onSubmit={handleCreateUser}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs"
                >
                  <input
                    type="text"
                    placeholder="Username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Nama Lengkap"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="FINANCE">FINANCE</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <div className="flex gap-1.5">
                    <input
                      type="password"
                      placeholder="Password (min 6)"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="min-w-0 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded bg-brand-accent px-3 py-1.5 font-semibold text-white shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Username</th>
                        <th className="px-3 py-2 font-semibold">Nama Lengkap</th>
                        <th className="px-3 py-2 font-semibold">Hak Akses</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                            Memuat daftar pengguna...
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id}>
                            <td className="px-3 py-2 font-mono-num font-semibold text-slate-900 dark:text-white">
                              {u.username}
                            </td>
                            <td className="px-3 py-2">
                              {editingUserId === u.id ? (
                                <input
                                  type="text"
                                  value={editUserForm.full_name}
                                  onChange={(e) =>
                                    setEditUserForm({ ...editUserForm, full_name: e.target.value })
                                  }
                                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                />
                              ) : (
                                u.full_name
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {editingUserId === u.id ? (
                                <select
                                  value={editUserForm.role}
                                  onChange={(e) =>
                                    setEditUserForm({ ...editUserForm, role: e.target.value as UserRole })
                                  }
                                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                >
                                  <option value="ADMIN">ADMIN</option>
                                  <option value="OPERATOR">OPERATOR</option>
                                  <option value="FINANCE">FINANCE</option>
                                  <option value="VIEWER">VIEWER</option>
                                </select>
                              ) : (
                                <span className="font-mono-num font-semibold text-sky-700 dark:text-sky-300">
                                  {u.role}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {editingUserId === u.id ? (
                                <label className="inline-flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={editUserForm.active}
                                    onChange={(e) =>
                                      setEditUserForm({ ...editUserForm, active: e.target.checked })
                                    }
                                  />
                                  <span>Aktif</span>
                                </label>
                              ) : (
                                <span className={u.active ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                                  {u.active ? 'Aktif' : 'Nonaktif'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                              {editingUserId === u.id ? (
                                <>
                                  <input
                                    type="password"
                                    placeholder="Password baru (opsional)"
                                    value={editUserForm.password}
                                    onChange={(e) =>
                                      setEditUserForm({ ...editUserForm, password: e.target.value })
                                    }
                                    className="w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateUser(u.id)}
                                    className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white"
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUserId(null)}
                                    className="rounded border border-slate-300 px-2 py-1 text-[11px]"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUserId(u.id);
                                      setEditUserForm({
                                        full_name: u.full_name,
                                        role: u.role,
                                        active: Boolean(u.active),
                                        password: '',
                                      });
                                    }}
                                    className="rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                                  >
                                    Edit
                                  </button>
                                  {u.id !== currentUser.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                      aria-label={`Hapus ${u.username}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Matriks Hak Akses Peran</h3>
            <div className="space-y-2.5 text-xs">
              {[
                {
                  role: 'ADMIN',
                  desc: 'Akses penuh: Input & Validasi TBS, Master Blok/Harga, Cetak Laporan, Pengaturan Logo/TTD, Database SQLite & Manajemen User.',
                },
                {
                  role: 'FINANCE',
                  desc: 'Validasi transaksi, ubah Harga Disbun & Market, SPK/Subsidi supplier, cetak Laporan & Export Excel/PDF.',
                },
                {
                  role: 'OPERATOR',
                  desc: 'Input/Edit data timbangan Suppliers & Estate, Kalkulasi BJR Blok, Import Excel Timbangan, lihat Laporan.',
                },
                {
                  role: 'VIEWER',
                  desc: 'Akses baca (Read-Only): Melihat Dashboard, daftar transaksi, serta mengunduh/mencetak Laporan.',
                },
              ].map((item) => (
                <div
                  key={item.role}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3"
                >
                  <p className="font-mono-num font-bold text-slate-900 dark:text-white">{item.role}</p>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
