import React, { useCallback, useEffect, useState } from 'react';
import {
  Database,
  FileBarChart2,
  Home,
  Layers,
  Settings2,
  Sliders,
  Truck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  AppDatabaseState,
  AppSettings,
  AuthSession,
  BlokMaster,
  EstateTransaction,
  EstateType,
  HargaDisbunInti,
  HargaDisbunPlasma,
  HargaMarketHarian,
  NavTab,
  Supplier,
  SupplierTransaction,
  SyncQueueItem,
} from './types/tbs';
import {
  clearSyncQueue,
  downloadTextFile,
  enqueueSyncMutation,
  exportOfflineSqlFile,
  getSeedFallbackState,
  hasOfflineAuthRecords,
  loadOfflineState,
  loadSyncQueue,
  saveOfflineState,
} from './utils/offlineDb';
import {
  DEFAULT_FOOTER_RUNNING_TEXT,
  buildEstateTransactionsExcelRows,
  buildSupplierTransactionsExcelRows,
  type NormalizedExcelEstateImportRow,
  type NormalizedExcelSupplierImportRow,
} from './utils/tbsCalculations';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PageLoading } from './components/PageLoading';
import { LoginView } from './components/LoginView';
import { TopMenuBar } from './components/TopMenuBar';
import { HomeDashboard } from './components/HomeDashboard';
import { SuppliersView } from './components/SuppliersView';
import { EstateView } from './components/EstateView';
import { MasterHargaView } from './components/MasterHargaView';
import { LaporanView } from './components/LaporanView';
import { PengaturanView } from './components/PengaturanView';
import { DatabaseSqlModal } from './components/DatabaseSqlModal';
import { ImportTimbanganModal } from './components/ImportTimbanganModal';

export default function App() {
  const { isOnline, forceOffline, setForceOffline } = useOnlineStatus();
  const [state, setState] = useState<AppDatabaseState>(() => getSeedFallbackState());
  const [bootDataReady, setBootDataReady] = useState(false);
  const [skipBootRequested, setSkipBootRequested] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
  );
  const [weighbridgeDone, setWeighbridgeDone] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
  );
  const isBooting = !bootDataReady || (!weighbridgeDone && !skipBootRequested);
  const [bootStatus, setBootStatus] = useState('Menyiapkan konfigurasi perusahaan & modul TBS...');

  // Security: Auth session & token stored strictly in React state memory (never localStorage/sessionStorage)
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authMeta, setAuthMeta] = useState<{
    hasUsers: boolean;
    envPasscodeConfigured: boolean;
    hasOfflineUsers: boolean;
  }>({
    hasUsers: false,
    envPasscodeConfigured: false,
    hasOfflineUsers: false,
  });

  const [publicBranding, setPublicBranding] = useState<{
    company_name: string;
    company_subtitle: string;
    company_logo: string;
    theme_preset: string;
    dark_mode: boolean;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(5); // CV.BAYA MARAGIT
  const [selectedEstateId, setSelectedEstateId] = useState<number>(1); // PT.MJL PLASMA
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalMode, setImportModalMode] = useState<'AUTO' | 'SUPPLIER' | 'ESTATE'>('AUTO');
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [resetFormTrigger, setResetFormTrigger] = useState(0);
  const [rekapRange, setRekapRange] = useState<{ start: string; end: string }>({
    start: '2026-11-16',
    end: '2026-11-22',
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Apply theme preset & light/dark class on <html>
  const effectiveThemePreset =
    authSession || !publicBranding
      ? state.settings.theme_preset
      : publicBranding.theme_preset || state.settings.theme_preset;
  const effectiveDarkMode =
    authSession || !publicBranding ? state.settings.dark_mode : publicBranding.dark_mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effectiveThemePreset || 'navy-emerald';
    root.classList.toggle('dark', Boolean(effectiveDarkMode));
  }, [effectiveThemePreset, effectiveDarkMode]);

  const applyNewState = useCallback(async (next: AppDatabaseState) => {
    setState(next);
    setPublicBranding({
      company_name: next.settings.company_name,
      company_subtitle: next.settings.company_subtitle,
      company_logo: next.settings.company_logo,
      theme_preset: next.settings.theme_preset,
      dark_mode: next.settings.dark_mode,
    });
    await saveOfflineState(next);
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    const offlineExists = await hasOfflineAuthRecords();
    if (!isOnline) {
      setAuthMeta((prev) => ({ ...prev, hasOfflineUsers: offlineExists }));
      return;
    }
    try {
      const [statusRes, brandingRes] = await Promise.all([
        fetch('/api/auth/status'),
        fetch('/api/public-branding'),
      ]);
      if (statusRes.ok) {
        const sJson = await statusRes.json();
        setAuthMeta({
          hasUsers: Boolean(sJson.hasUsers),
          envPasscodeConfigured: Boolean(sJson.envPasscodeConfigured),
          hasOfflineUsers: offlineExists,
        });
      } else {
        setAuthMeta((prev) => ({ ...prev, hasOfflineUsers: offlineExists }));
      }
      if (brandingRes.ok) {
        const bJson = await brandingRes.json();
        setPublicBranding({
          company_name: String(bJson.company_name || 'PT. Fajar Saudara Kusuma'),
          company_subtitle: String(bJson.company_subtitle || 'Sebawi Mill'),
          company_logo: String(bJson.company_logo || ''),
          theme_preset: String(bJson.theme_preset || 'navy-emerald'),
          dark_mode: Boolean(bJson.dark_mode),
        });
      }
    } catch {
      setAuthMeta((prev) => ({ ...prev, hasOfflineUsers: offlineExists }));
    }
  }, [isOnline]);

  // Initial boot sequence with PageLoading weighbridge animation
  useEffect(() => {
    let mounted = true;
    const safetyTimer = window.setTimeout(() => {
      if (mounted) setWeighbridgeDone(true);
    }, 6500);

    (async () => {
      try {
        setBootStatus('Memuat data operasional & preferensi lokal...');
        const [cached, queue, offlineUsersExist] = await Promise.all([
          loadOfflineState(),
          loadSyncQueue(),
          hasOfflineAuthRecords(),
        ]);
        if (!mounted) return;
        if (cached) {
          const seedSettings = getSeedFallbackState().settings;
          const normalizedCached: AppDatabaseState = {
            ...cached,
            settings: {
              ...seedSettings,
              ...cached.settings,
            },
          };
          setState(normalizedCached);
          setRekapRange({
            start: normalizedCached.settings.periode_mulai || '2026-11-16',
            end: normalizedCached.settings.periode_selesai || '2026-11-22',
          });
        }
        setSyncQueue(queue);
        setAuthMeta((prev) => ({ ...prev, hasOfflineUsers: offlineUsersExist }));

        if (isOnline) {
          setBootStatus('Menyinkronkan profil perusahaan & status akses...');
          await refreshAuthStatus();
        }
      } finally {
        if (mounted) setBootDataReady(true);
      }
    })();
    return () => {
      mounted = false;
      window.clearTimeout(safetyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check auth status if connectivity changes while on LoginView
  useEffect(() => {
    if (!isBooting && !authSession) {
      refreshAuthStatus();
    }
  }, [isBooting, authSession, isOnline, refreshAuthStatus]);

  const buildAuthHeaders = useCallback(
    (extra: Record<string, string> = {}): Record<string, string> => {
      if (authSession?.token && authSession.mode === 'online') {
        return { ...extra, Authorization: `Bearer ${authSession.token}` };
      }
      return extra;
    },
    [authSession]
  );

  const fetchServerState = useCallback(async () => {
    if (!authSession || authSession.mode !== 'online') return false;
    try {
      const res = await fetch('/api/state', {
        headers: buildAuthHeaders(),
      });
      if (res.status === 401) {
        setAuthSession(null);
        return false;
      }
      if (!res.ok) throw new Error('Server state fetch failed');
      const data = (await res.json()) as AppDatabaseState;
      await applyNewState(data);
      return true;
    } catch {
      return false;
    }
  }, [authSession, buildAuthHeaders, applyNewState]);

  const handleLoginSuccess = useCallback(
    async (session: AuthSession, serverState?: unknown) => {
      setAuthSession(session);
      setActiveTab('home');
      if (serverState && typeof serverState === 'object') {
        const typedState = serverState as AppDatabaseState;
        await applyNewState(typedState);
        setRekapRange({
          start: typedState.settings.periode_mulai || '2026-11-16',
          end: typedState.settings.periode_selesai || '2026-11-22',
        });
      } else if (session.mode === 'online') {
        const res = await fetch('/api/state', {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as AppDatabaseState;
          await applyNewState(data);
        }
      }
    },
    [applyNewState]
  );

  const handleLogout = useCallback(async () => {
    if (authSession?.mode === 'online' && authSession.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authSession.token}` },
        });
      } catch {
        /* ignore network errors on logout */
      }
    }
    setAuthSession(null);
    await refreshAuthStatus();
  }, [authSession, refreshAuthStatus]);

  const handleManualSync = useCallback(async () => {
    if (!isOnline || isSyncing || !authSession || authSession.mode !== 'online') return;
    setIsSyncing(true);
    try {
      const queue = await loadSyncQueue();
      if (queue.length > 0) {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ queue }),
        });
        if (res.status === 401) {
          setAuthSession(null);
          return;
        }
        if (res.ok) {
          const json = await res.json();
          await clearSyncQueue();
          setSyncQueue([]);
          if (json.state) await applyNewState(json.state);
        }
      } else {
        await fetchServerState();
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, authSession, buildAuthHeaders, applyNewState, fetchServerState]);

  // Auto-sync queued offline changes when coming back online while logged in
  useEffect(() => {
    if (isOnline && authSession?.mode === 'online' && syncQueue.length > 0) {
      handleManualSync();
    }
  }, [isOnline, authSession, syncQueue.length, handleManualSync]);

  // Helper to run mutation online-first, falling back cleanly to IndexedDB + queue when offline
  const mutateWithOfflineFallback = useCallback(
    async (
      method: 'POST' | 'PUT' | 'DELETE',
      endpoint: string,
      payload: unknown,
      description: string,
      optimisticUpdate: (prev: AppDatabaseState) => AppDatabaseState
    ) => {
      if (authSession?.user.role === 'VIEWER') {
        throw new Error('Akun Viewer hanya memiliki akses lihat (read-only).');
      }
      const optimisticState = optimisticUpdate(state);
      await applyNewState(optimisticState);

      if (isOnline && authSession?.mode === 'online') {
        try {
          const res = await fetch(endpoint, {
            method,
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: method === 'DELETE' ? undefined : JSON.stringify(payload),
          });
          if (res.status === 401) {
            setAuthSession(null);
            return;
          }
          if (res.ok) {
            const json = await res.json();
            if (json.state) {
              await applyNewState(json.state);
            }
            return;
          } else {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Gagal menyimpan ke server (${res.status})`);
          }
        } catch (err) {
          // If network error, queue offline; if server validation/403 error, rethrow
          if (err instanceof TypeError) {
            // fetch network error -> fall through to queue
          } else {
            throw err;
          }
        }
      }

      const nextQueue = await enqueueSyncMutation({
        method,
        endpoint,
        payload,
        description,
      });
      setSyncQueue(nextQueue);
    },
    [state, isOnline, authSession, buildAuthHeaders, applyNewState]
  );

  // Handlers for Suppliers
  const handleAddSupplier = async (name: string) => {
    const code = `SUP-${String(state.suppliers.length + 1).padStart(2, '0')}`;
    await mutateWithOfflineFallback(
      'POST',
      '/api/suppliers',
      { name, code },
      `Tambah supplier ${name}`,
      (prev) => {
        const maxId = prev.suppliers.reduce((m, s) => Math.max(m, s.id), 0);
        const nextId = maxId + 1;
        return {
          ...prev,
          suppliers: [
            ...prev.suppliers,
            {
              id: nextId,
              name,
              code,
              masa_berlaku_spk: 's/d 31/12/26',
              subsidi_netto_rp: 0,
              subsidi_tenera_rp: 100,
              pph_type: 'PPH22',
              insentif_rp: 0,
              active: 1,
            },
          ],
        };
      }
    );
  };

  const handleUpdateSupplierMeta = async (supplier: Supplier) => {
    await mutateWithOfflineFallback(
      'PUT',
      `/api/suppliers/${supplier.id}`,
      supplier,
      `Update SPK/Subsidi/PPh supplier ${supplier.name}`,
      (prev) => ({
        ...prev,
        suppliers: prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s)),
      })
    );
  };

  const handleDeleteSupplier = async (id: number) => {
    await mutateWithOfflineFallback(
      'DELETE',
      `/api/suppliers/${id}`,
      null,
      `Hapus supplier #${id}`,
      (prev) => ({
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== id),
        supplier_transactions: prev.supplier_transactions.filter((t) => t.supplier_id !== id),
      })
    );
  };

  const handleAddSupplierTx = async (tx: Omit<SupplierTransaction, 'id'>) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/supplier-transactions',
      tx,
      `Input tiket supplier ${tx.no_kendaraan}`,
      (prev) => {
        const maxId = prev.supplier_transactions.reduce((m, t) => Math.max(m, t.id), 0);
        return {
          ...prev,
          supplier_transactions: [{ ...tx, id: maxId + 1 }, ...prev.supplier_transactions],
        };
      }
    );
  };

  const handleUpdateSupplierTx = async (tx: SupplierTransaction) => {
    await mutateWithOfflineFallback(
      'PUT',
      `/api/supplier-transactions/${tx.id}`,
      tx,
      `Update tiket supplier #${tx.id}`,
      (prev) => ({
        ...prev,
        supplier_transactions: prev.supplier_transactions.map((t) => (t.id === tx.id ? tx : t)),
      })
    );
  };

  const handleDeleteSupplierTx = async (id: number) => {
    await mutateWithOfflineFallback(
      'DELETE',
      `/api/supplier-transactions/${id}`,
      null,
      `Hapus tiket supplier #${id}`,
      (prev) => ({
        ...prev,
        supplier_transactions: prev.supplier_transactions.filter((t) => t.id !== id),
      })
    );
  };

  const handleBulkValidateSupplier = async (ids: number[], validated: boolean) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/supplier-transactions/bulk-validate',
      { ids, validated },
      `Validasi ${ids.length} tiket supplier`,
      (prev) => ({
        ...prev,
        supplier_transactions: prev.supplier_transactions.map((t) =>
          ids.includes(t.id) ? { ...t, validated: validated ? 1 : 0 } : t
        ),
      })
    );
  };

  const handleDeleteAllSupplierTx = async (supplierId?: number) => {
    const endpoint = supplierId
      ? `/api/supplier-transactions?supplier_id=${supplierId}`
      : '/api/supplier-transactions';
    await mutateWithOfflineFallback(
      'DELETE',
      endpoint,
      null,
      supplierId
        ? `Hapus semua transaksi supplier #${supplierId}`
        : 'Hapus semua transaksi seluruh suppliers',
      (prev) => ({
        ...prev,
        supplier_transactions: supplierId
          ? prev.supplier_transactions.filter((t) => t.supplier_id !== supplierId)
          : [],
      })
    );
  };

  // Unified Excel Import for ALL Suppliers & Estates
  const handleImportExcelAll = async (payload: {
    supplierRows: NormalizedExcelSupplierImportRow[];
    estateRows: NormalizedExcelEstateImportRow[];
  }) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/import/excel-all',
      payload,
      `Import Excel (${payload.supplierRows.length} Suppliers, ${payload.estateRows.length} Estate)`,
      (prev) => {
        let nextSuppliers = [...prev.suppliers];
        let nextEstates = [...prev.estates];
        let maxSupId = nextSuppliers.reduce((m, s) => Math.max(m, s.id), 0);
        let maxEstId = nextEstates.reduce((m, e) => Math.max(m, e.id), 0);
        let maxSupTxId = prev.supplier_transactions.reduce((m, t) => Math.max(m, t.id), 0);
        let maxEstTxId = prev.estate_transactions.reduce((m, t) => Math.max(m, t.id), 0);

        const supMap = new Map(nextSuppliers.map((s) => [s.name.trim().toUpperCase(), s.id]));
        const estMap = new Map(nextEstates.map((e) => [e.name.trim().toUpperCase(), e.id]));

        const insertedSupTxs: SupplierTransaction[] = [];
        for (const r of payload.supplierRows) {
          const key = r.entityName.trim().toUpperCase();
          let supId = supMap.get(key);
          if (!supId) {
            supId = ++maxSupId;
            supMap.set(key, supId);
            nextSuppliers.push({
              id: supId,
              name: r.entityName.trim(),
              code: `SUP-${String(nextSuppliers.length + 1).padStart(2, '0')}`,
              masa_berlaku_spk: 's/d 31/12/26',
              subsidi_netto_rp: 0,
              subsidi_tenera_rp: 100,
              pph_type: 'PPH22',
              insentif_rp: 0,
              active: 1,
            });
          }
          insertedSupTxs.push({
            id: ++maxSupTxId,
            supplier_id: supId,
            tanggal: r.tanggal,
            no_kendaraan: r.no_kendaraan,
            bruto_kg: r.bruto_kg,
            denda_kg: r.denda_kg,
            persen_denda: r.persen_denda,
            netto_kg: r.netto_kg,
            grade: r.grade,
            harga_rp: r.harga_rp,
            total_rp: r.total_rp,
            varietas_dxp: r.varietas_dxp,
            quality_tier: r.quality_tier,
            validated: r.validated,
          });
        }

        const insertedEstTxs: EstateTransaction[] = [];
        for (const r of payload.estateRows) {
          const key = r.entityName.trim().toUpperCase();
          let estId = estMap.get(key);
          if (!estId) {
            estId = ++maxEstId;
            estMap.set(key, estId);
            nextEstates.push({
              id: estId,
              name: r.entityName.trim(),
              type: r.estateType,
            });
          }
          insertedEstTxs.push({
            id: ++maxEstTxId,
            estate_id: estId,
            tanggal: r.tanggal,
            no_polisi: r.no_polisi,
            bulan_th_tanam: r.bulan_th_tanam,
            bruto_kg: r.bruto_kg,
            denda_kg: r.denda_kg,
            netto_kg: r.netto_kg,
            persen_denda: r.persen_denda,
            umur: r.umur,
            harga_rp: r.harga_rp,
            total_rp: r.total_rp,
            blok_details_json: '[]',
            validated: r.validated,
          });
        }

        return {
          ...prev,
          suppliers: nextSuppliers,
          estates: nextEstates,
          supplier_transactions: [...insertedSupTxs, ...prev.supplier_transactions],
          estate_transactions: [...insertedEstTxs, ...prev.estate_transactions],
        };
      }
    );
  };

  // Handlers for Estate
  const handleAddEstate = async (name: string, type: EstateType) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await mutateWithOfflineFallback(
      'POST',
      '/api/estates',
      { name: trimmed, type },
      `Tambah kebun ${trimmed} (${type})`,
      (prev) => {
        const maxId = prev.estates.reduce((m, e) => Math.max(m, e.id), 0);
        const nextId = maxId + 1;
        return {
          ...prev,
          estates: [...prev.estates, { id: nextId, name: trimmed, type }],
        };
      }
    );
  };

  const handleAddEstateTxs = async (rows: Array<Omit<EstateTransaction, 'id'>>) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/estate-transactions',
      { rows },
      `Input ${rows.length} baris estate`,
      (prev) => {
        let maxId = prev.estate_transactions.reduce((m, t) => Math.max(m, t.id), 0);
        const inserted = rows.map((r) => ({ ...r, id: ++maxId }));
        return {
          ...prev,
          estate_transactions: [...inserted, ...prev.estate_transactions],
        };
      }
    );
  };

  const handleUpdateEstateTx = async (row: EstateTransaction) => {
    await mutateWithOfflineFallback(
      'PUT',
      `/api/estate-transactions/${row.id}`,
      row,
      `Update tiket estate #${row.id}`,
      (prev) => ({
        ...prev,
        estate_transactions: prev.estate_transactions.map((t) => (t.id === row.id ? row : t)),
      })
    );
  };

  const handleDeleteEstateTx = async (id: number) => {
    await mutateWithOfflineFallback(
      'DELETE',
      `/api/estate-transactions/${id}`,
      null,
      `Hapus tiket estate #${id}`,
      (prev) => ({
        ...prev,
        estate_transactions: prev.estate_transactions.filter((t) => t.id !== id),
      })
    );
  };

  const handleDeleteAllEstateTx = async (estateId?: number) => {
    const endpoint = estateId
      ? `/api/estate-transactions?estate_id=${estateId}`
      : '/api/estate-transactions';
    await mutateWithOfflineFallback(
      'DELETE',
      endpoint,
      null,
      estateId
        ? `Hapus semua transaksi kebun #${estateId}`
        : 'Hapus semua transaksi seluruh kebun estate',
      (prev) => ({
        ...prev,
        estate_transactions: estateId
          ? prev.estate_transactions.filter((t) => t.estate_id !== estateId)
          : [],
      })
    );
  };

  const handleBulkValidateEstate = async (ids: number[], validated: boolean) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/estate-transactions/bulk-validate',
      { ids, validated },
      `Validasi ${ids.length} tiket estate`,
      (prev) => ({
        ...prev,
        estate_transactions: prev.estate_transactions.map((t) =>
          ids.includes(t.id) ? { ...t, validated: validated ? 1 : 0 } : t
        ),
      })
    );
  };

  // Handlers for Master Blok & Harga
  const handleSaveBlok = async (blok: Omit<BlokMaster, 'id'>) => {
    await mutateWithOfflineFallback(
      'POST',
      '/api/blok-master',
      blok,
      `Simpan blok ${blok.kode_blok}`,
      (prev) => {
        const existing = prev.blok_master.find(
          (b) => b.kode_blok === blok.kode_blok && b.nama_kebun === blok.nama_kebun
        );
        if (existing) {
          return {
            ...prev,
            blok_master: prev.blok_master.map((b) =>
              b.id === existing.id ? { ...blok, id: existing.id } : b
            ),
          };
        }
        const maxId = prev.blok_master.reduce((m, b) => Math.max(m, b.id), 0);
        return {
          ...prev,
          blok_master: [...prev.blok_master, { ...blok, id: maxId + 1 }],
        };
      }
    );
  };

  const handleDeleteBlok = async (id: number) => {
    await mutateWithOfflineFallback(
      'DELETE',
      `/api/blok-master/${id}`,
      null,
      `Hapus blok #${id}`,
      (prev) => ({
        ...prev,
        blok_master: prev.blok_master.filter((b) => b.id !== id),
      })
    );
  };

  const handleSaveDisbunInti = async (rows: HargaDisbunInti[]) => {
    await mutateWithOfflineFallback(
      'PUT',
      '/api/harga/disbun-inti',
      { rows },
      'Update Harga Disbun Inti',
      (prev) => ({ ...prev, harga_disbun_inti: rows })
    );
  };

  const handleSaveDisbunPlasma = async (row: HargaDisbunPlasma) => {
    await mutateWithOfflineFallback(
      'PUT',
      '/api/harga/disbun-plasma',
      row,
      'Update Harga Disbun Plasma',
      (prev) => ({ ...prev, harga_disbun_plasma: [row] })
    );
  };

  const handleSaveMarketPrices = async (bulanTahun: string, rows: HargaMarketHarian[]) => {
    await mutateWithOfflineFallback(
      'PUT',
      '/api/harga/market',
      { bulan_tahun: bulanTahun, rows },
      'Update Harga Market Harian',
      (prev) => ({ ...prev, harga_market_harian: rows })
    );
  };

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    await mutateWithOfflineFallback(
      'PUT',
      '/api/settings',
      partial,
      'Update Pengaturan',
      (prev) => ({
        ...prev,
        settings: { ...prev.settings, ...partial },
      })
    );
  };

  // Database SQL actions (authenticated via Bearer token)
  const handleExportSql = async () => {
    if (isOnline && authSession?.mode === 'online') {
      try {
        const res = await fetch('/api/database/export-sql', {
          headers: buildAuthHeaders(),
        });
        if (res.ok) {
          const sqlText = await res.text();
          downloadTextFile('database.sql', sqlText, 'application/sql;charset=utf-8');
          return;
        }
      } catch {
        /* fallback to offline export below */
      }
    }
    exportOfflineSqlFile(state);
  };

  const handleImportSql = async (sqlContent: string) => {
    if (!isOnline || authSession?.mode !== 'online') {
      throw new Error('Import file .sql ke SQLite membutuhkan koneksi Online ke server.');
    }
    const res = await fetch('/api/database/import-sql', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sql: sqlContent }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal impor SQL');
    if (json.state) await applyNewState(json.state);
  };

  const handleResetDatabase = async () => {
    if (isOnline && authSession?.mode === 'online') {
      const res = await fetch('/api/database/reset', {
        method: 'POST',
        headers: buildAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.state) {
        await clearSyncQueue();
        setSyncQueue([]);
        await applyNewState(json.state);
      }
    } else {
      const seed = getSeedFallbackState();
      await clearSyncQueue();
      setSyncQueue([]);
      await applyNewState(seed);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const supRows = buildSupplierTransactionsExcelRows(
      state.supplier_transactions,
      state.suppliers
    );
    const estRows = buildEstateTransactionsExcelRows(
      state.estate_transactions,
      state.estates
    );
    const wsSup = XLSX.utils.json_to_sheet(
      supRows.length > 0 ? supRows : [{ Info: 'Belum ada transaksi suppliers' }]
    );
    const wsEst = XLSX.utils.json_to_sheet(
      estRows.length > 0 ? estRows : [{ Info: 'Belum ada transaksi estate' }]
    );
    XLSX.utils.book_append_sheet(wb, wsSup, 'Suppliers');
    XLSX.utils.book_append_sheet(wb, wsEst, 'Estate');
    XLSX.writeFile(wb, 'Database_TBS_FSK_Sebawi.xlsx');
  };

  const handleCompleteWeighbridge = useCallback(() => {
    setWeighbridgeDone(true);
  }, []);

  // 1. PageLoading Screen
  if (isBooting) {
    return (
      <PageLoading
        companyName={publicBranding?.company_name || state.settings.company_name}
        companySubtitle={publicBranding?.company_subtitle || state.settings.company_subtitle}
        companyLogo={publicBranding?.company_logo || state.settings.company_logo}
        statusText={bootStatus}
        onSkip={() => setSkipBootRequested(true)}
        onComplete={handleCompleteWeighbridge}
      />
    );
  }

  // 2. Login Gate before Main Menu
  if (!authSession) {
    return (
      <LoginView
        companyName={publicBranding?.company_name || state.settings.company_name}
        companySubtitle={publicBranding?.company_subtitle || state.settings.company_subtitle}
        companyLogo={publicBranding?.company_logo || state.settings.company_logo}
        isOnline={isOnline}
        hasUsers={authMeta.hasUsers}
        envPasscodeConfigured={authMeta.envPasscodeConfigured}
        hasOfflineUsers={authMeta.hasOfflineUsers}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // 3. Authenticated Main Application Shell
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home className="h-4 w-4 shrink-0" /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Truck className="h-4 w-4 shrink-0" /> },
    { id: 'estate', label: 'Estate', icon: <Layers className="h-4 w-4 shrink-0" /> },
    { id: 'laporan', label: 'Laporan', icon: <FileBarChart2 className="h-4 w-4 shrink-0" /> },
    { id: 'master', label: 'Blok & Harga', icon: <Settings2 className="h-4 w-4 shrink-0" /> },
    { id: 'pengaturan', label: 'Pengaturan', icon: <Sliders className="h-4 w-4 shrink-0" /> },
  ];

  const dateFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const canWrite = authSession.user.role !== 'VIEWER';
  const hasSidebarBg = Boolean(state.settings.sidebar_bg_image && state.settings.sidebar_bg_image.trim());
  const footerMarqueeText =
    state.settings.footer_running_text?.trim() || DEFAULT_FOOTER_RUNNING_TEXT;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopMenuBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentUser={authSession.user}
        onLogout={handleLogout}
        isOnline={isOnline}
        forceOffline={forceOffline}
        onToggleForceOffline={() => setForceOffline((v) => !v)}
        syncQueueCount={syncQueue.length}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        onOpenSqlModal={() => setShowSqlModal(true)}
        onOpenImportModal={() => {
          setImportModalMode('AUTO');
          setShowImportModal(true);
        }}
        onExportSql={handleExportSql}
        onExportExcel={handleExportExcel}
        onPrint={() => window.print()}
        onRefresh={fetchServerState}
        onNewData={() => setResetFormTrigger((n) => n + 1)}
        onBulkValidateAll={(validated) => {
          if (activeTab === 'estate') {
            handleBulkValidateEstate(
              state.estate_transactions.map((t) => t.id),
              validated
            );
          } else {
            handleBulkValidateSupplier(
              state.supplier_transactions.map((t) => t.id),
              validated
            );
          }
        }}
        onSearchShortcut={() => {
          setActiveTab('suppliers');
          setSearchFocusTrigger((n) => n + 1);
        }}
        onRekapPeriodeShortcut={(start, end) => {
          setRekapRange({ start, end });
          setActiveTab('laporan');
        }}
        settings={state.settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Main Workspace: Left Sidebar (with configurable Zoom In/Out Backdrop) + Active Screen */}
      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          className={`no-print relative overflow-hidden border-b border-slate-200 dark:border-slate-800 md:w-44 md:border-b-0 md:border-r shrink-0 ${
            hasSidebarBg ? 'bg-slate-950 text-white' : 'bg-white dark:bg-slate-900'
          }`}
        >
          {hasSidebarBg && (
            <>
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-cover bg-center ${
                  state.settings.sidebar_bg_zoom ? 'sidebar-bg-zoom-anim' : ''
                }`}
                style={{ backgroundImage: `url("${state.settings.sidebar_bg_image}")` }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/65 to-slate-950/85"
              />
            </>
          )}

          <nav
            aria-label="Navigasi Modul"
            className="relative z-10 flex md:flex-col gap-1 p-2 overflow-x-auto"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-brand-accent text-white shadow-md ring-1 ring-white/25'
                      : hasSidebarBg
                        ? 'text-slate-100 hover:bg-white/15 backdrop-blur-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div
              className={`hidden md:block my-2 border-t ${
                hasSidebarBg ? 'border-white/20' : 'border-slate-200 dark:border-slate-800'
              }`}
            />

            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                hasSidebarBg
                  ? 'text-sky-200 hover:bg-white/15'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Database
                className={`h-4 w-4 shrink-0 ${
                  hasSidebarBg ? 'text-sky-300' : 'text-sky-700 dark:text-sky-400'
                }`}
              />
              <span>SQLite DB</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {activeTab === 'home' ? (
            <HomeDashboard
              state={state}
              currentUser={authSession.user}
              isOnline={isOnline}
              syncQueueCount={syncQueue.length}
              onNavigate={setActiveTab}
              onOpenSqlModal={() => setShowSqlModal(true)}
              onExportSql={handleExportSql}
            />
          ) : activeTab === 'suppliers' ? (
            <SuppliersView
              state={state}
              canWrite={canWrite}
              selectedSupplierId={selectedSupplierId}
              onSelectSupplier={setSelectedSupplierId}
              onAddSupplier={handleAddSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onAddTransaction={handleAddSupplierTx}
              onUpdateTransaction={handleUpdateSupplierTx}
              onDeleteTransaction={handleDeleteSupplierTx}
              onDeleteAllTransactions={handleDeleteAllSupplierTx}
              onBulkValidate={handleBulkValidateSupplier}
              onUpdateSettings={handleUpdateSettings}
              onOpenImportExcel={() => {
                setImportModalMode('SUPPLIER');
                setShowImportModal(true);
              }}
              searchFocusTrigger={searchFocusTrigger}
              resetFormTrigger={resetFormTrigger}
            />
          ) : activeTab === 'estate' ? (
            <EstateView
              state={state}
              canWrite={canWrite}
              selectedEstateId={selectedEstateId}
              onSelectEstate={setSelectedEstateId}
              onAddEstate={handleAddEstate}
              onAddEstateTransactions={handleAddEstateTxs}
              onUpdateEstateTransaction={handleUpdateEstateTx}
              onDeleteEstateTransaction={handleDeleteEstateTx}
              onDeleteAllEstateTransactions={handleDeleteAllEstateTx}
              onBulkValidateEstate={handleBulkValidateEstate}
              onOpenImportExcel={() => {
                setImportModalMode('ESTATE');
                setShowImportModal(true);
              }}
            />
          ) : activeTab === 'master' ? (
            <MasterHargaView
              state={state}
              onSaveBlok={handleSaveBlok}
              onDeleteBlok={handleDeleteBlok}
              onSaveDisbunInti={handleSaveDisbunInti}
              onSaveDisbunPlasma={handleSaveDisbunPlasma}
              onSaveMarketPrices={handleSaveMarketPrices}
              onUpdateSettings={handleUpdateSettings}
            />
          ) : activeTab === 'pengaturan' ? (
            <PengaturanView
              state={state}
              currentUser={authSession.user}
              authToken={authSession.token}
              isOnline={isOnline}
              onUpdateSettings={handleUpdateSettings}
              onUpdateSupplierMeta={handleUpdateSupplierMeta}
            />
          ) : (
            <LaporanView
              state={state}
              initialStart={rekapRange.start}
              initialEnd={rekapRange.end}
              onPrint={() => window.print()}
            />
          )}
        </main>
      </div>

      {/* Institutional Bottom Footer with Running Text Marquee */}
      <footer className="no-print border-t border-slate-300 dark:border-slate-800 bg-brand-primary px-4 py-1.5 text-xs text-slate-200 flex items-center justify-between gap-4">
        <div
          className="marquee-container flex-1 min-w-0 overflow-hidden"
          aria-label="Informasi berjalan footer"
        >
          <div className="marquee-track text-brand-highlight font-medium whitespace-nowrap">
            <span className="pr-16">{footerMarqueeText}</span>
            <span aria-hidden="true" className="pr-16">
              {footerMarqueeText}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono-num text-white font-semibold shrink-0">
          <span>{dateFormatted}</span>
          <span>{timeFormatted}</span>
        </div>
      </footer>

      <DatabaseSqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        state={state}
        isOnline={isOnline}
        authToken={authSession.token}
        userRole={authSession.user.role}
        syncQueue={syncQueue}
        onExportSql={handleExportSql}
        onImportSql={handleImportSql}
        onResetDatabase={handleResetDatabase}
        onManualSync={handleManualSync}
      />

      <ImportTimbanganModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        state={state}
        defaultSupplierId={selectedSupplierId}
        defaultEstateId={selectedEstateId}
        initialTargetMode={importModalMode}
        onImportExcelAll={handleImportExcelAll}
      />
    </div>
  );
}
