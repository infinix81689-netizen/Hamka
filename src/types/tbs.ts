export type NavTab = 'home' | 'suppliers' | 'estate' | 'laporan' | 'master' | 'pengaturan';

export type EstateType = 'PLASMA' | 'INTI';
export type VarietasDxP = 'DURA' | 'PSIFERA' | 'TENERA';
export type QualityTier = 'HQ' | 'MQ' | 'A' | 'B';
export type PphType = 'PPH22' | 'PPH4_2' | 'NONE';
export type UserRole = 'ADMIN' | 'OPERATOR' | 'FINANCE' | 'VIEWER';
export type ThemePreset = 'navy-emerald' | 'forest-gold' | 'slate-indigo' | 'crimson-charcoal';

export interface UserAccount {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  active: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  mode: 'online' | 'offline';
}

export interface Supplier {
  id: number;
  name: string;
  code: string;
  masa_berlaku_spk?: string;
  subsidi_netto_rp?: number;
  subsidi_tenera_rp?: number;
  pph_type?: PphType;
  insentif_rp?: number;
  active: number;
  created_at?: string;
  updated_at?: string;
}

export interface Estate {
  id: number;
  name: string;
  type: EstateType;
  created_at?: string;
  updated_at?: string;
}

export interface BlokMaster {
  id: number;
  kode_blok: string;
  nama_kebun: string;
  bulan_tanam: string;
  keterangan: string;
  umur_tahun: number;
  updated_at?: string;
}

export interface HargaDisbunInti {
  id: number;
  umur_label: string;
  umur_min: number;
  umur_max: number;
  periode_1: number;
  periode_2: number;
  periode_3: number;
  periode_4: number;
  bulan_tahun: string;
}

export interface HargaDisbunPlasma {
  id: number;
  bulan_tahun: string;
  periode_1: number;
  periode_2: number;
  periode_3: number;
  periode_4: number;
}

export interface HargaMarketHarian {
  id?: number;
  bulan_tahun: string;
  tanggal: number;
  harga: number;
}

export interface SupplierTransaction {
  id: number;
  supplier_id: number;
  tanggal: string; // YYYY-MM-DD
  no_kendaraan: string;
  bruto_kg: number;
  denda_kg: number;
  persen_denda: number;
  netto_kg: number;
  grade: number;
  harga_rp: number;
  total_rp: number;
  varietas_dxp: VarietasDxP;
  quality_tier: QualityTier;
  validated: number; // 0 or 1
  updated_at?: string;
}

export interface BlokInputRow {
  blok: string;
  jjg: number;
  brd_kg: number;
  umur: number;
  th_tnm: string;
}

export interface EstateTransaction {
  id: number;
  estate_id: number;
  tanggal: string; // YYYY-MM-DD
  no_polisi: string;
  bulan_th_tanam: string;
  bruto_kg: number;
  denda_kg: number;
  netto_kg: number;
  persen_denda: number;
  umur: number;
  harga_rp: number;
  total_rp: number;
  blok_details_json: string;
  validated: number;
  updated_at?: string;
}

export interface KalkulasiGroupRow {
  umur: number;
  bulan_th_tanam: string;
  bruto: number;
  denda: number;
  netto: number;
  persen: number;
  harga_rp: number;
  total_rp: number;
  bloks: BlokInputRow[];
}

export interface AppSettings {
  company_name: string;
  company_subtitle: string;
  company_logo: string;
  report_city: string;
  theme_preset: ThemePreset;
  dark_mode: boolean;
  max_grad_pct: number;
  harga_hq: number;
  harga_mq: number;
  harga_a: number;
  harga_b: number;
  pph22_rate: number;
  pph4_rate: number;
  cek_harga_saat_edit: boolean;
  periode_mulai: string;
  periode_selesai: string;
  market_periode_mulai: string;
  market_periode_selesai: string;
  show_gridlines: boolean;
  show_headings: boolean;
  show_formulabar: boolean;
  ttd_disetujui_name: string;
  ttd_disetujui_title: string;
  ttd_diperiksa_name: string;
  ttd_diperiksa_title: string;
  ttd_disiapkan_name: string;
  ttd_disiapkan_title: string;
  footer_running_text: string;
  sidebar_bg_image: string;
  sidebar_bg_zoom: boolean;
}

export interface AppDatabaseState {
  suppliers: Supplier[];
  estates: Estate[];
  blok_master: BlokMaster[];
  harga_disbun_inti: HargaDisbunInti[];
  harga_disbun_plasma: HargaDisbunPlasma[];
  harga_market_harian: HargaMarketHarian[];
  supplier_transactions: SupplierTransaction[];
  estate_transactions: EstateTransaction[];
  settings: AppSettings;
}

export interface SyncQueueItem {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  payload: unknown;
  createdAt: string;
  description: string;
}
