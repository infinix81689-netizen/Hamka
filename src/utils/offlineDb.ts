import type { AppDatabaseState, SyncQueueItem, UserAccount, UserRole } from '../types/tbs';
import {
  DEFAULT_FOOTER_RUNNING_TEXT,
  DEFAULT_SIDEBAR_BG_IMAGE,
  generateSqlDumpFromState,
} from './tbsCalculations';

const DB_NAME = 'fsk_sebawi_tbs_offline_db';
const DB_VERSION = 2;
const STORE_STATE = 'app_state';
const STORE_QUEUE = 'sync_queue';
const STORE_AUTH = 'offline_auth';
const STATE_KEY = 'current_database_state';

export interface OfflineAuthRecord {
  username: string;
  full_name: string;
  role: UserRole;
  salt: string;
  verifier_hash: string;
  updated_at: string;
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUTH)) {
        db.createObjectStore(STORE_AUTH, { keyPath: 'username' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function cacheOfflineAuthCredential(user: UserAccount, password: string): Promise<void> {
  try {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const verifier_hash = await sha256Hex(`${salt}:${user.username.toLowerCase()}:${password}`);
    const record: OfflineAuthRecord = {
      username: user.username.toLowerCase(),
      full_name: user.full_name,
      role: user.role,
      salt,
      verifier_hash,
      updated_at: new Date().toISOString(),
    };
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_AUTH, 'readwrite');
      tx.objectStore(STORE_AUTH).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore if subtle crypto or IndexedDB unavailable
  }
}

export async function verifyOfflineAuthCredential(
  username: string,
  password: string
): Promise<UserAccount | null> {
  try {
    const db = await openIndexedDb();
    const record = await new Promise<OfflineAuthRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_AUTH, 'readonly');
      const req = tx.objectStore(STORE_AUTH).get(username.trim().toLowerCase());
      req.onsuccess = () => resolve((req.result as OfflineAuthRecord) || null);
      req.onerror = () => reject(req.error);
    });
    if (!record) return null;
    const candidate = await sha256Hex(`${record.salt}:${record.username}:${password}`);
    if (candidate !== record.verifier_hash) return null;
    return {
      id: 0,
      username: record.username,
      full_name: record.full_name,
      role: record.role,
      active: 1,
    };
  } catch {
    return null;
  }
}

export async function hasOfflineAuthRecords(): Promise<boolean> {
  try {
    const db = await openIndexedDb();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_AUTH, 'readonly');
      const req = tx.objectStore(STORE_AUTH).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return count > 0;
  } catch {
    return false;
  }
}

export async function loadOfflineState(): Promise<AppDatabaseState | null> {
  try {
    const db = await openIndexedDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const store = tx.objectStore(STORE_STATE);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve((req.result as AppDatabaseState) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as AppDatabaseState) : null;
  }
}

export async function saveOfflineState(state: AppDatabaseState): Promise<void> {
  try {
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      tx.objectStore(STORE_STATE).put(state, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
}

export async function loadSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openIndexedDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result as SyncQueueItem[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem(STORE_QUEUE);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  }
}

export async function enqueueSyncMutation(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<SyncQueueItem[]> {
  const newItem: SyncQueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(newItem);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return await loadSyncQueue();
  } catch {
    const existing = await loadSyncQueue();
    const updated = [...existing, newItem];
    localStorage.setItem(STORE_QUEUE, JSON.stringify(updated));
    return updated;
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(STORE_QUEUE);
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportOfflineSqlFile(state: AppDatabaseState) {
  const dump = generateSqlDumpFromState(state);
  downloadTextFile('database.sql', dump, 'application/sql;charset=utf-8');
}

export function getSeedFallbackState(): AppDatabaseState {
  const days = Array.from({ length: 31 }, (_, idx) => {
    const d = idx + 1;
    let harga = 2750;
    if (d <= 2) harga = 2850;
    else if (d <= 5) harga = 2900;
    else if (d <= 10) harga = 2850;
    return { bulan_tahun: '2026-11', tanggal: d, harga };
  });

  return {
    suppliers: [
      { id: 1, name: 'PT. CHAKRA', code: 'SUP-01', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 0, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 10, active: 1 },
      { id: 2, name: 'PT.MEGAMBAS', code: 'SUP-02', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 20, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 3, name: 'CV.GUNUNG MAS', code: 'SUP-03', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 20, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 4, name: 'CV. ANEKA MAJU JAYA', code: 'SUP-04', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 0, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 5, name: 'CV.BAYA MARAGIT', code: 'SUP-05', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 100, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 6, name: 'CV SJA', code: 'SUP-06', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 20, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 7, name: 'CV.CLARA S', code: 'SUP-07', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 10, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 8, name: 'AGIMAN', code: 'SUP-08', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 100, subsidi_tenera_rp: 100, pph_type: 'PPH4_2', insentif_rp: 0, active: 1 },
      { id: 9, name: 'TJONG LIE KO', code: 'SUP-09', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 50, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 10, name: 'Hiu Thiam Djie', code: 'SUP-10', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 10, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 11, name: 'Lie Cen Jung', code: 'SUP-11', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 0, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 12, name: 'Kop SBT', code: 'SUP-12', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 10, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 13, name: 'Tan Darsono', code: 'SUP-13', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 20, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 14, name: 'Ng Sian Jung', code: 'SUP-14', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 15, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 4, active: 1 },
      { id: 15, name: 'Thong Fu Tjiung', code: 'SUP-15', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 25, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 16, name: 'Tjhai Elvira L', code: 'SUP-16', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 0, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 17, name: 'Eric H', code: 'SUP-17', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 0, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 18, name: 'Hendra Gunawan', code: 'SUP-18', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 15, subsidi_tenera_rp: 100, pph_type: 'PPH4_2', insentif_rp: 0, active: 1 },
      { id: 19, name: 'HO Gunawan', code: 'SUP-19', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 15, subsidi_tenera_rp: 100, pph_type: 'PPH4_2', insentif_rp: 0, active: 1 },
      { id: 20, name: 'PDN', code: 'SUP-20', masa_berlaku_spk: 's/d 31/12/26', subsidi_netto_rp: 10, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
      { id: 23, name: 'PT.RSL', code: 'SUP-23', masa_berlaku_spk: 's/d 15/04/27', subsidi_netto_rp: 50, subsidi_tenera_rp: 100, pph_type: 'PPH22', insentif_rp: 0, active: 1 },
    ],
    estates: [
      { id: 1, name: 'PT.MJL PLASMA', type: 'PLASMA' },
      { id: 2, name: 'PT.MJL INTI', type: 'INTI' },
      { id: 3, name: 'PT.FSK KBN', type: 'INTI' },
      { id: 4, name: 'PT.DSU', type: 'PLASMA' },
      { id: 5, name: 'NI SONG', type: 'PLASMA' },
    ],
    blok_master: [
      { id: 1, kode_blok: 'C10', nama_kebun: 'PT.MJL', bulan_tanam: 'Feb-09', keterangan: 'Plasma', umur_tahun: 17 },
      { id: 31, kode_blok: 'I5', nama_kebun: 'PT.MJL', bulan_tanam: 'Nov-09', keterangan: 'Plasma', umur_tahun: 9 },
      { id: 32, kode_blok: 'I6', nama_kebun: 'PT.MJL', bulan_tanam: 'Nov-09', keterangan: 'Plasma', umur_tahun: 9 },
      { id: 40, kode_blok: 'H5', nama_kebun: 'PT.MJL', bulan_tanam: 'Dec-09', keterangan: 'Plasma', umur_tahun: 9 },
      { id: 41, kode_blok: 'H6', nama_kebun: 'PT.MJL', bulan_tanam: 'Dec-09', keterangan: 'Plasma', umur_tahun: 9 },
      { id: 42, kode_blok: 'G5', nama_kebun: 'PT.MJL', bulan_tanam: 'Aug-10', keterangan: 'Plasma', umur_tahun: 10 },
      { id: 43, kode_blok: 'G6', nama_kebun: 'PT.MJL', bulan_tanam: 'Sep-10', keterangan: 'Plasma', umur_tahun: 10 },
      { id: 44, kode_blok: 'G10', nama_kebun: 'PT.MJL', bulan_tanam: 'Sep-10', keterangan: 'Plasma', umur_tahun: 10 },
    ],
    harga_disbun_inti: [
      { id: 7, umur_label: '9', umur_min: 9, umur_max: 9, periode_1: 3412.47, periode_2: 3369.42, periode_3: 3219.06, periode_4: 3219.06, bulan_tahun: '2026-11' },
      { id: 8, umur_label: '10 - 20', umur_min: 10, umur_max: 20, periode_1: 3484.85, periode_2: 3440.93, periode_3: 3287.46, periode_4: 3287.46, bulan_tahun: '2026-11' },
    ],
    harga_disbun_plasma: [
      { id: 1, bulan_tahun: '2026-11', periode_1: 3484.85, periode_2: 3440.93, periode_3: 3287.46, periode_4: 3287.46 },
    ],
    harga_market_harian: days,
    supplier_transactions: [
      {
        id: 192,
        supplier_id: 5,
        tanggal: '2026-11-20',
        no_kendaraan: 'KB8548CH',
        bruto_kg: 2350,
        denda_kg: 60,
        persen_denda: 2.55,
        netto_kg: 2290,
        grade: 12.25,
        harga_rp: 2750,
        total_rp: 6297500,
        varietas_dxp: 'DURA',
        quality_tier: 'HQ',
        validated: 0,
      },
    ],
    estate_transactions: [
      {
        id: 1,
        estate_id: 1,
        tanggal: '2026-11-02',
        no_polisi: 'KB9826BD',
        bulan_th_tanam: 'Aug-09, Sep-09',
        bruto_kg: 1865,
        denda_kg: 45,
        netto_kg: 1820,
        persen_denda: 2.41,
        umur: 10,
        harga_rp: 3484.85,
        total_rp: 6342427,
        blok_details_json: '[]',
        validated: 1,
      },
    ],
    settings: {
      company_name: 'PT. Fajar Saudara Kusuma',
      company_subtitle: 'Sebawi Mill',
      company_logo: '',
      report_city: 'Sebawi',
      theme_preset: 'navy-emerald',
      dark_mode: false,
      max_grad_pct: 5,
      harga_hq: 2750,
      harga_mq: 2650,
      harga_a: 2550,
      harga_b: 2450,
      pph22_rate: 0.0025,
      pph4_rate: 0.005,
      cek_harga_saat_edit: true,
      periode_mulai: '2026-11-16',
      periode_selesai: '2026-11-22',
      market_periode_mulai: '2026-11-01',
      market_periode_selesai: '2026-11-30',
      show_gridlines: true,
      show_headings: true,
      show_formulabar: true,
      ttd_disetujui_name: 'Ni Song',
      ttd_disetujui_title: 'Deputi FFB Purchase Dept. Head',
      ttd_diperiksa_name: 'Fadly Fadland',
      ttd_diperiksa_title: 'Fin & Acct Sub Dept. Head',
      ttd_disiapkan_name: 'Hamka',
      ttd_disiapkan_title: 'Finance Div. Head (POM)',
      footer_running_text: DEFAULT_FOOTER_RUNNING_TEXT,
      sidebar_bg_image: DEFAULT_SIDEBAR_BG_IMAGE,
      sidebar_bg_zoom: true,
    },
  };
}
