import type {
  AppDatabaseState,
  BlokInputRow,
  BlokMaster,
  Estate,
  EstateTransaction,
  EstateType,
  HargaDisbunInti,
  HargaDisbunPlasma,
  HargaMarketHarian,
  KalkulasiGroupRow,
  PphType,
  QualityTier,
  Supplier,
  SupplierTransaction,
  VarietasDxP,
} from '../types/tbs';

export const DEFAULT_FOOTER_RUNNING_TEXT =
  'Aplikasi Perhitungan Pembelian & Pembayaran TBS Sawit PT. Fajar Saudara Kusuma - Sebawi Mill (Sebawi Mill). Utamakan Keselamatan Kerja.';

export const DEFAULT_SIDEBAR_BG_IMAGE = '/src/assets/images/sidebar_palm_bg_1795236071731.jpg';

export function mapDxPCodeToVarietas(code: string | number | undefined | null): VarietasDxP {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (normalized === '0' || normalized === 'PSIFERA') return 'PSIFERA';
  if (normalized === '1' || normalized === 'TENERA') return 'TENERA';
  return 'DURA';
}

export function mapVarietasToDxPCode(varietas: VarietasDxP): string {
  if (varietas === 'PSIFERA') return '0';
  if (varietas === 'TENERA') return '1';
  return '';
}

export function determineQualityTier(
  persenDenda: number,
  maxGradPct: number,
  grade: number
): QualityTier {
  if (persenDenda <= maxGradPct && grade >= 12) return 'HQ';
  if (persenDenda <= maxGradPct + 2 && grade >= 10) return 'MQ';
  if (persenDenda <= maxGradPct + 5) return 'A';
  return 'B';
}

export function lookupMarketPriceForDate(
  tanggalIso: string,
  marketPrices: HargaMarketHarian[],
  fallbackHarga: number
): number {
  const day = parseInt(tanggalIso.split('-')[2] || '1', 10);
  const ym = tanggalIso.slice(0, 7);
  const match =
    marketPrices.find((m) => m.bulan_tahun === ym && m.tanggal === day) ||
    marketPrices.find((m) => m.tanggal === day);
  return match && match.harga > 0 ? match.harga : fallbackHarga;
}

export function calculateSupplierMetrics(params: {
  brutoKg: number;
  dendaKg: number;
  grade: number;
  dxpCode: string;
  hargaRp: number;
  maxGradPct: number;
}) {
  const bruto = Math.max(0, Number(params.brutoKg) || 0);
  const denda = Math.max(0, Math.min(bruto, Number(params.dendaKg) || 0));
  const nettoKg = Math.max(0, bruto - denda);
  const persenDenda = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
  const varietas = mapDxPCodeToVarietas(params.dxpCode);
  const qualityTier = determineQualityTier(persenDenda, params.maxGradPct, Number(params.grade) || 0);
  const hargaRp = Math.max(0, Number(params.hargaRp) || 0);
  const totalRp = Math.round(nettoKg * hargaRp);

  return {
    brutoKg: bruto,
    dendaKg: denda,
    nettoKg,
    persenDenda,
    varietas,
    qualityTier,
    hargaRp,
    totalRp,
  };
}

export function getDisbunPeriodeIndex(tanggalIso: string): 1 | 2 | 3 | 4 {
  const day = parseInt(tanggalIso.split('-')[2] || '1', 10);
  if (day <= 7) return 1;
  if (day <= 15) return 2;
  if (day <= 22) return 3;
  return 4;
}

export function lookupHargaDisbun(params: {
  umur: number;
  tanggalIso: string;
  kebunType: EstateType;
  intiRates: HargaDisbunInti[];
  plasmaRates: HargaDisbunPlasma[];
}): number {
  const periode = getDisbunPeriodeIndex(params.tanggalIso);
  const ym = params.tanggalIso.slice(0, 7);

  if (params.kebunType === 'PLASMA') {
    const plasma =
      params.plasmaRates.find((p) => p.bulan_tahun === ym) || params.plasmaRates[0];
    if (!plasma) return 0;
    return plasma[`periode_${periode}`];
  }

  const umur = Math.max(3, Math.min(25, Math.round(params.umur || 10)));
  const inti =
    params.intiRates.find((r) => umur >= r.umur_min && umur <= r.umur_max) ||
    params.intiRates.find((r) => r.umur_label.includes('10')) ||
    params.intiRates[0];
  if (!inti) return 0;
  return inti[`periode_${periode}`];
}

export function enrichBlokRows(
  rows: Array<{ blok: string; jjg: number; brd_kg: number }>,
  blokMaster: BlokMaster[],
  namaKebunFilter?: string
): BlokInputRow[] {
  const kebunPrefix = (namaKebunFilter || '').replace(/\s*(PLASMA|INTI)$/i, '').trim().toUpperCase();

  return rows
    .filter((r) => r.blok.trim() !== '' && (r.jjg > 0 || r.brd_kg > 0))
    .map((r) => {
      const code = r.blok.trim().toUpperCase();
      const master =
        blokMaster.find(
          (b) =>
            b.kode_blok.toUpperCase() === code &&
            (!kebunPrefix || b.nama_kebun.toUpperCase().includes(kebunPrefix))
        ) || blokMaster.find((b) => b.kode_blok.toUpperCase() === code);

      return {
        blok: code,
        jjg: Math.max(0, Number(r.jjg) || 0),
        brd_kg: Math.max(0, Number(r.brd_kg) || 0),
        umur: master ? master.umur_tahun : 10,
        th_tnm: master ? master.bulan_tanam : 'Sep-10',
      };
    });
}

export function calculateEstateBlokBreakdown(params: {
  totalBruto: number;
  totalDenda: number;
  blokRows: BlokInputRow[];
  kebunType: EstateType;
  tanggalIso: string;
  intiRates: HargaDisbunInti[];
  plasmaRates: HargaDisbunPlasma[];
}): {
  groups: KalkulasiGroupRow[];
  totalJjg: number;
  totalBrd: number;
  jumlahBruto: number;
  jumlahDenda: number;
  selisihBruto: number;
  selisihDenda: number;
} {
  const totalBruto = Math.max(0, Math.round(Number(params.totalBruto) || 0));
  const totalDenda = Math.max(0, Math.min(totalBruto, Math.round(Number(params.totalDenda) || 0)));
  const validRows = params.blokRows.filter((r) => r.blok.trim() !== '' && (r.jjg > 0 || r.brd_kg > 0));

  const totalJjg = validRows.reduce((sum, r) => sum + r.jjg, 0);
  const totalBrd = validRows.reduce((sum, r) => sum + r.brd_kg, 0);

  if (validRows.length === 0 || totalBruto === 0) {
    return {
      groups: [],
      totalJjg,
      totalBrd,
      jumlahBruto: 0,
      jumlahDenda: 0,
      selisihBruto: totalBruto,
      selisihDenda: totalDenda,
    };
  }

  const remainingForJjg = Math.max(0, totalBruto - totalBrd);
  const bjr = totalJjg > 0 ? remainingForJjg / totalJjg : 0;

  const groupMap = new Map<number, { umur: number; rawWeight: number; thSet: Set<string>; bloks: BlokInputRow[] }>();

  for (const row of validRows) {
    const rowWeight = totalJjg > 0 ? row.jjg * bjr + row.brd_kg : totalBruto / validRows.length;
    const existing = groupMap.get(row.umur);
    if (existing) {
      existing.rawWeight += rowWeight;
      if (row.th_tnm) existing.thSet.add(row.th_tnm);
      existing.bloks.push(row);
    } else {
      groupMap.set(row.umur, {
        umur: row.umur,
        rawWeight: rowWeight,
        thSet: new Set(row.th_tnm ? [row.th_tnm] : []),
        bloks: [row],
      });
    }
  }

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => a.umur - b.umur);
  const totalRawWeight = sortedGroups.reduce((s, g) => s + g.rawWeight, 0) || 1;

  let assignedBruto = 0;
  let assignedDenda = 0;

  const groups: KalkulasiGroupRow[] = sortedGroups.map((g, idx) => {
    const isLast = idx === sortedGroups.length - 1;
    const ratio = g.rawWeight / totalRawWeight;
    const bruto = isLast ? totalBruto - assignedBruto : Math.round(totalBruto * ratio);
    const denda = isLast ? totalDenda - assignedDenda : Math.round(totalDenda * ratio);
    assignedBruto += bruto;
    assignedDenda += denda;

    const netto = Math.max(0, bruto - denda);
    const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
    const harga_rp = lookupHargaDisbun({
      umur: g.umur,
      tanggalIso: params.tanggalIso,
      kebunType: params.kebunType,
      intiRates: params.intiRates,
      plasmaRates: params.plasmaRates,
    });

    const bulanList = Array.from(g.thSet).sort().join(', ');

    return {
      umur: g.umur,
      bulan_th_tanam: bulanList,
      bruto,
      denda,
      netto,
      persen,
      harga_rp,
      total_rp: Math.round(netto * harga_rp),
      bloks: g.bloks,
    };
  });

  const jumlahBruto = groups.reduce((s, g) => s + g.bruto, 0);
  const jumlahDenda = groups.reduce((s, g) => s + g.denda, 0);

  return {
    groups,
    totalJjg,
    totalBrd,
    jumlahBruto,
    jumlahDenda,
    selisihBruto: totalBruto - jumlahBruto,
    selisihDenda: totalDenda - jumlahDenda,
  };
}

export interface SupplierReportCalculation {
  brutoKg: number;
  dendaKg: number;
  nettoKg: number;
  persenDenda: number;
  nilaiRupiah: number;
  nonTeneraNettoKg: number;
  teneraNettoKg: number;
  subsidiNettoRate: number;
  subsidiNettoRp: number;
  subsidiTeneraRate: number;
  subsidiTeneraRp: number;
  insentifRp: number;
  pphType: PphType;
  pph22Rp: number;
  pph4Rp: number;
  nilaiDibayar: number;
}

export function calculateSupplierReportSummary(params: {
  supplier: Supplier;
  transactions: SupplierTransaction[];
  pph22Rate: number;
  pph4Rate: number;
}): SupplierReportCalculation {
  const { supplier, transactions, pph22Rate, pph4Rate } = params;
  let brutoKg = 0;
  let dendaKg = 0;
  let nettoKg = 0;
  let nilaiRupiah = 0;
  let nonTeneraNettoKg = 0;
  let teneraNettoKg = 0;

  for (const tx of transactions) {
    brutoKg += tx.bruto_kg;
    dendaKg += tx.denda_kg;
    nettoKg += tx.netto_kg;
    nilaiRupiah += tx.total_rp;
    if (tx.varietas_dxp === 'TENERA') {
      teneraNettoKg += tx.netto_kg;
    } else {
      nonTeneraNettoKg += tx.netto_kg;
    }
  }

  const persenDenda = brutoKg > 0 ? Number(((dendaKg / brutoKg) * 100).toFixed(2)) : 0;
  const subsidiNettoRate = Number(supplier.subsidi_netto_rp ?? 0);
  const subsidiTeneraRate = Number(supplier.subsidi_tenera_rp ?? 100);
  const insentifRate = Number(supplier.insentif_rp ?? 0);

  const subsidiNettoRp = Math.round(nonTeneraNettoKg * subsidiNettoRate);
  const subsidiTeneraRp = Math.round(teneraNettoKg * subsidiTeneraRate);
  const insentifRp = Math.round(nettoKg * insentifRate);

  const pphType: PphType = supplier.pph_type || 'PPH22';
  let pph22Rp = 0;
  let pph4Rp = 0;

  if (pphType === 'PPH22') {
    pph22Rp = Math.round(nilaiRupiah * pph22Rate);
  } else if (pphType === 'PPH4_2') {
    pph4Rp = Math.round(nilaiRupiah * pph4Rate);
  }

  const nilaiDibayar = Math.max(
    0,
    nilaiRupiah + subsidiNettoRp + subsidiTeneraRp - pph22Rp - pph4Rp
  );

  return {
    brutoKg,
    dendaKg,
    nettoKg,
    persenDenda,
    nilaiRupiah,
    nonTeneraNettoKg,
    teneraNettoKg,
    subsidiNettoRate,
    subsidiNettoRp,
    subsidiTeneraRate,
    subsidiTeneraRp,
    insentifRp,
    pphType,
    pph22Rp,
    pph4Rp,
    nilaiDibayar,
  };
}

const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function terbilangHelper(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluh]} Puluh${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 200) {
    const sisa = n % 100;
    return `Seratus${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 1000) {
    const ratus = Math.floor(n / 100);
    const sisa = n % 100;
    return `${SATUAN[ratus]} Ratus${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 2000) {
    const sisa = n % 1000;
    return `Seribu${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 1_000_000) {
    const ribu = Math.floor(n / 1000);
    const sisa = n % 1000;
    return `${terbilangHelper(ribu)} Ribu${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 1_000_000_000) {
    const juta = Math.floor(n / 1_000_000);
    const sisa = n % 1_000_000;
    return `${terbilangHelper(juta)} Juta${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  if (n < 1_000_000_000_000) {
    const milyar = Math.floor(n / 1_000_000_000);
    const sisa = n % 1_000_000_000;
    return `${terbilangHelper(milyar)} Milyar${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
  }
  const triliun = Math.floor(n / 1_000_000_000_000);
  const sisa = n % 1_000_000_000_000;
  return `${terbilangHelper(triliun)} Triliun${sisa > 0 ? ` ${terbilangHelper(sisa)}` : ''}`;
}

export function terbilangRupiah(amount: number): string {
  const rounded = Math.round(Math.max(0, Number(amount) || 0));
  if (rounded === 0) return 'Nol Rupiah.';
  return `${terbilangHelper(rounded).replace(/\s+/g, ' ').trim()} Rupiah.`;
}

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatDateIndoLong(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${INDO_MONTHS[(m - 1) % 12] || ''} ${y}`;
}

export function enumerateDateRangeIso(startIso: string, endIso: string): string[] {
  if (!startIso || !endIso || startIso > endIso) return [];
  const res: string[] = [];
  const curr = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  let guard = 0;
  while (curr <= end && guard < 90) {
    res.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
    guard++;
  }
  return res;
}

export function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatNumberID(val: number, decimals = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val || 0);
}

export function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(val || 0));
}

export function isValidLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.includes('..')) return false;
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/src/assets/')
  ) {
    return trimmed.length <= 2048;
  }
  const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed);
  return match && trimmed.length <= 1_500_000;
}

export interface ParsedTimbanganRow {
  tanggal: string;
  no_kendaraan: string;
  bruto_kg: number;
  denda_kg: number;
  grade: number;
  dxp: string;
}

export interface NormalizedExcelSupplierImportRow {
  entityName: string;
  tanggal: string;
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
  validated: number;
}

export interface NormalizedExcelEstateImportRow {
  entityName: string;
  estateType: EstateType;
  tanggal: string;
  no_polisi: string;
  bulan_th_tanam: string;
  bruto_kg: number;
  denda_kg: number;
  netto_kg: number;
  persen_denda: number;
  umur: number;
  harga_rp: number;
  total_rp: number;
  validated: number;
}

function normalizeDateInput(raw: unknown): string {
  if (typeof raw === 'number' && raw > 25000 && raw < 80000) {
    // Excel serial date number (epoch 1899-12-30)
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const str = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function parseLocaleNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  // Handle Indonesian formatting like 6.780 or 12,25
  const cleaned =
    s.includes(',') && s.includes('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.includes(',')
      ? s.replace(',', '.')
      : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, '')
      : s;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function pickField(obj: Record<string, unknown>, candidates: string[]): unknown {
  const entries = Object.entries(obj);
  for (const cand of candidates) {
    const found = entries.find(([k]) => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === cand);
    if (found && found[1] !== undefined && found[1] !== '') return found[1];
  }
  return undefined;
}

export function normalizeImportedExcelRows(params: {
  rawRows: Array<Record<string, unknown>>;
  targetMode: 'AUTO' | 'SUPPLIER' | 'ESTATE';
  defaultSupplierName: string;
  defaultEstateName: string;
  existingSuppliers: Supplier[];
  existingEstates: Estate[];
  marketPrices: HargaMarketHarian[];
  intiRates: HargaDisbunInti[];
  plasmaRates: HargaDisbunPlasma[];
  fallbackHarga: number;
  maxGradPct: number;
}): {
  supplierRows: NormalizedExcelSupplierImportRow[];
  estateRows: NormalizedExcelEstateImportRow[];
} {
  const supplierRows: NormalizedExcelSupplierImportRow[] = [];
  const estateRows: NormalizedExcelEstateImportRow[] = [];

  for (const row of params.rawRows) {
    const tipeRaw = String(pickField(row, ['tipe', 'kategori', 'jenis', 'type', 'sumber']) ?? '')
      .trim()
      .toUpperCase();

    const supplierCol = String(
      pickField(row, ['supplier', 'namasupplier', 'relasi', 'namarelasi']) ?? ''
    ).trim();
    const estateCol = String(
      pickField(row, ['estate', 'kebun', 'namakebun', 'namaestate']) ?? ''
    ).trim();
    const entityCol = String(
      pickField(row, ['nama', 'mitra', 'asal', 'namapemasok']) ?? ''
    ).trim();
    const bulanTanamCol = String(
      pickField(row, ['bulanthtanam', 'bulantahun', 'bulantanam', 'thtnm', 'tahuntanam']) ?? ''
    ).trim();

    let isEstate = false;
    if (params.targetMode === 'ESTATE') isEstate = true;
    else if (params.targetMode === 'SUPPLIER') isEstate = false;
    else {
      if (tipeRaw.includes('ESTATE') || tipeRaw.includes('KEBUN') || tipeRaw === 'PLASMA' || tipeRaw === 'INTI') {
        isEstate = true;
      } else if (estateCol && !supplierCol) {
        isEstate = true;
      } else if (bulanTanamCol && !supplierCol) {
        isEstate = true;
      } else if (entityCol && params.existingEstates.some((e) => e.name.toUpperCase() === entityCol.toUpperCase())) {
        isEstate = true;
      }
    }

    const tanggal = normalizeDateInput(
      pickField(row, ['tanggal', 'tgl', 'tglterima', 'date'])
    );
    const noKendaraan = String(
      pickField(row, ['nokendaraan', 'nopolisi', 'nopol', 'kendaraan', 'plat', 'truck']) ?? 'KB0000XX'
    )
      .trim()
      .toUpperCase();
    const bruto = Math.max(
      0,
      parseLocaleNumber(pickField(row, ['bruto', 'brutokg', 'beratbruto']), 0)
    );
    if (bruto <= 0) continue;

    const denda = Math.max(
      0,
      Math.min(bruto, parseLocaleNumber(pickField(row, ['denda', 'dendakg', 'potongan']), 0))
    );

    if (isEstate) {
      const kebunName = (estateCol || entityCol || params.defaultEstateName).trim();
      const matchedEstate = params.existingEstates.find(
        (e) => e.name.toUpperCase() === kebunName.toUpperCase()
      );
      const estateType: EstateType =
        tipeRaw.includes('INTI') || kebunName.toUpperCase().includes('INTI')
          ? 'INTI'
          : matchedEstate?.type || 'PLASMA';
      const umur = Math.max(
        3,
        Math.min(25, Math.round(parseLocaleNumber(pickField(row, ['umur', 'umurtanam', 'umurtanaman']), 10)))
      );
      const explicitHarga = parseLocaleNumber(pickField(row, ['harga', 'hargarp', 'hargadisbun']), 0);
      const harga_rp =
        explicitHarga > 0
          ? explicitHarga
          : lookupHargaDisbun({
              umur,
              tanggalIso: tanggal,
              kebunType: estateType,
              intiRates: params.intiRates,
              plasmaRates: params.plasmaRates,
            });
      const netto = Math.max(0, bruto - denda);
      const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;

      estateRows.push({
        entityName: matchedEstate?.name || kebunName,
        estateType,
        tanggal,
        no_polisi: noKendaraan,
        bulan_th_tanam: bulanTanamCol || 'Sep-10',
        bruto_kg: bruto,
        denda_kg: denda,
        netto_kg: netto,
        persen_denda: persen,
        umur,
        harga_rp,
        total_rp: Math.round(netto * harga_rp),
        validated: 0,
      });
    } else {
      const supName = (supplierCol || entityCol || params.defaultSupplierName).trim();
      const matchedSup = params.existingSuppliers.find(
        (s) => s.name.toUpperCase() === supName.toUpperCase()
      );
      const grade = Math.max(
        0,
        parseLocaleNumber(pickField(row, ['grade', 'kualitas', 'mutu']), 12.5)
      );
      const dxpRaw = String(pickField(row, ['dxp', 'varietas', 'varietasdxp', 'jenisbuah']) ?? '');
      const explicitHarga = parseLocaleNumber(pickField(row, ['harga', 'hargarp', 'hargamarket']), 0);
      const hargaRp =
        explicitHarga > 0
          ? explicitHarga
          : lookupMarketPriceForDate(tanggal, params.marketPrices, params.fallbackHarga);

      const m = calculateSupplierMetrics({
        brutoKg: bruto,
        dendaKg: denda,
        grade,
        dxpCode: dxpRaw,
        hargaRp,
        maxGradPct: params.maxGradPct,
      });

      supplierRows.push({
        entityName: matchedSup?.name || supName,
        tanggal,
        no_kendaraan: noKendaraan,
        bruto_kg: m.brutoKg,
        denda_kg: m.dendaKg,
        persen_denda: m.persenDenda,
        netto_kg: m.nettoKg,
        grade,
        harga_rp: m.hargaRp,
        total_rp: m.totalRp,
        varietas_dxp: m.varietas,
        quality_tier: m.qualityTier,
        validated: 0,
      });
    }
  }

  return { supplierRows, estateRows };
}

export function parseTimbanganCSV(text: string): ParsedTimbanganRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedTimbanganRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    const maybeBruto = Number(cols[2].replace(/\./g, '').replace(',', '.'));
    if (i === 0 && Number.isNaN(maybeBruto)) continue;

    let tanggal = cols[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(tanggal)) {
      const [d, m, y] = tanggal.split('/');
      tanggal = `${y}-${m}-${d}`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      tanggal = new Date().toISOString().slice(0, 10);
    }

    const bruto_kg = Math.max(0, Number(cols[2].replace(',', '.')) || 0);
    const denda_kg = Math.max(0, Number((cols[3] || '0').replace(',', '.')) || 0);
    const grade = Math.max(0, Number((cols[4] || '12.5').replace(',', '.')) || 12.5);
    const dxp = cols[5] || '';

    results.push({
      tanggal,
      no_kendaraan: (cols[1] || 'KB0000XX').toUpperCase(),
      bruto_kg,
      denda_kg,
      grade,
      dxp,
    });
  }
  return results;
}

function sqlEsc(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function generateSqlDumpFromState(state: AppDatabaseState): string {
  const lines: string[] = [
    '-- ============================================================================',
    '-- EXPORT DATABASE.SQL - PT. FAJAR SAUDARA KUSUMA (SEBAWI MILL)',
    `-- Generated: ${new Date().toISOString()}`,
    '-- ============================================================================',
    '',
    'PRAGMA foreign_keys = OFF;',
    '',
    'DELETE FROM estate_transactions;',
    'DELETE FROM supplier_transactions;',
    'DELETE FROM harga_market_harian;',
    'DELETE FROM harga_disbun_plasma;',
    'DELETE FROM harga_disbun_inti;',
    'DELETE FROM blok_master;',
    'DELETE FROM estates;',
    'DELETE FROM suppliers;',
    'DELETE FROM app_settings;',
    '',
  ];

  for (const s of state.suppliers) {
    lines.push(
      `INSERT INTO suppliers (id, name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, insentif_rp, active) VALUES (${s.id}, ${sqlEsc(s.name)}, ${sqlEsc(s.code)}, ${sqlEsc(s.masa_berlaku_spk || 's/d 31/12/26')}, ${Number(s.subsidi_netto_rp ?? 0)}, ${Number(s.subsidi_tenera_rp ?? 100)}, ${sqlEsc(s.pph_type || 'PPH22')}, ${Number(s.insentif_rp ?? 0)}, ${s.active});`
    );
  }
  lines.push('');

  for (const e of state.estates) {
    lines.push(
      `INSERT INTO estates (id, name, type) VALUES (${e.id}, ${sqlEsc(e.name)}, ${sqlEsc(e.type)});`
    );
  }
  lines.push('');

  for (const b of state.blok_master) {
    lines.push(
      `INSERT INTO blok_master (id, kode_blok, nama_kebun, bulan_tanam, keterangan, umur_tahun) VALUES (${b.id}, ${sqlEsc(b.kode_blok)}, ${sqlEsc(b.nama_kebun)}, ${sqlEsc(b.bulan_tanam)}, ${sqlEsc(b.keterangan)}, ${b.umur_tahun});`
    );
  }
  lines.push('');

  for (const h of state.harga_disbun_inti) {
    lines.push(
      `INSERT INTO harga_disbun_inti (id, umur_label, umur_min, umur_max, periode_1, periode_2, periode_3, periode_4, bulan_tahun) VALUES (${h.id}, ${sqlEsc(h.umur_label)}, ${h.umur_min}, ${h.umur_max}, ${h.periode_1}, ${h.periode_2}, ${h.periode_3}, ${h.periode_4}, ${sqlEsc(h.bulan_tahun)});`
    );
  }
  lines.push('');

  for (const p of state.harga_disbun_plasma) {
    lines.push(
      `INSERT INTO harga_disbun_plasma (id, bulan_tahun, periode_1, periode_2, periode_3, periode_4) VALUES (${p.id}, ${sqlEsc(p.bulan_tahun)}, ${p.periode_1}, ${p.periode_2}, ${p.periode_3}, ${p.periode_4});`
    );
  }
  lines.push('');

  for (const m of state.harga_market_harian) {
    lines.push(
      `INSERT INTO harga_market_harian (bulan_tahun, tanggal, harga) VALUES (${sqlEsc(m.bulan_tahun)}, ${m.tanggal}, ${m.harga});`
    );
  }
  lines.push('');

  for (const t of state.supplier_transactions) {
    lines.push(
      `INSERT INTO supplier_transactions (id, supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda, netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated) VALUES (${t.id}, ${t.supplier_id}, ${sqlEsc(t.tanggal)}, ${sqlEsc(t.no_kendaraan)}, ${t.bruto_kg}, ${t.denda_kg}, ${t.persen_denda}, ${t.netto_kg}, ${t.grade}, ${t.harga_rp}, ${t.total_rp}, ${sqlEsc(t.varietas_dxp)}, ${sqlEsc(t.quality_tier)}, ${t.validated});`
    );
  }
  lines.push('');

  for (const et of state.estate_transactions) {
    lines.push(
      `INSERT INTO estate_transactions (id, estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg, netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated) VALUES (${et.id}, ${et.estate_id}, ${sqlEsc(et.tanggal)}, ${sqlEsc(et.no_polisi)}, ${sqlEsc(et.bulan_th_tanam)}, ${et.bruto_kg}, ${et.denda_kg}, ${et.netto_kg}, ${et.persen_denda}, ${et.umur}, ${et.harga_rp}, ${et.total_rp}, ${sqlEsc(et.blok_details_json)}, ${et.validated});`
    );
  }
  lines.push('');

  const s = state.settings;
  const settingsEntries: Array<[string, string]> = [
    ['company_name', s.company_name],
    ['company_subtitle', s.company_subtitle],
    ['company_logo', s.company_logo],
    ['report_city', s.report_city],
    ['theme_preset', s.theme_preset],
    ['dark_mode', String(s.dark_mode)],
    ['max_grad_pct', String(s.max_grad_pct)],
    ['harga_hq', String(s.harga_hq)],
    ['harga_mq', String(s.harga_mq)],
    ['harga_a', String(s.harga_a)],
    ['harga_b', String(s.harga_b)],
    ['pph22_rate', String(s.pph22_rate)],
    ['pph4_rate', String(s.pph4_rate)],
    ['cek_harga_saat_edit', String(s.cek_harga_saat_edit)],
    ['periode_mulai', s.periode_mulai],
    ['periode_selesai', s.periode_selesai],
    ['market_periode_mulai', s.market_periode_mulai],
    ['market_periode_selesai', s.market_periode_selesai],
    ['show_gridlines', String(s.show_gridlines)],
    ['show_headings', String(s.show_headings)],
    ['show_formulabar', String(s.show_formulabar)],
    ['ttd_disetujui_name', s.ttd_disetujui_name],
    ['ttd_disetujui_title', s.ttd_disetujui_title],
    ['ttd_diperiksa_name', s.ttd_diperiksa_name],
    ['ttd_diperiksa_title', s.ttd_diperiksa_title],
    ['ttd_disiapkan_name', s.ttd_disiapkan_name],
    ['ttd_disiapkan_title', s.ttd_disiapkan_title],
    ['footer_running_text', s.footer_running_text],
    ['sidebar_bg_image', s.sidebar_bg_image],
    ['sidebar_bg_zoom', String(s.sidebar_bg_zoom)],
  ];
  for (const [k, v] of settingsEntries) {
    lines.push(`INSERT INTO app_settings (key, value) VALUES (${sqlEsc(k)}, ${sqlEsc(v)});`);
  }

  lines.push('');
  lines.push('PRAGMA foreign_keys = ON;');
  return lines.join('\n');
}

export function buildSupplierTransactionsExcelRows(
  transactions: SupplierTransaction[],
  suppliers: Supplier[],
  supplierIdFilter?: number
) {
  const supMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const filtered = supplierIdFilter
    ? transactions.filter((t) => t.supplier_id === supplierIdFilter)
    : transactions;

  return filtered.map((t, idx) => ({
    No: idx + 1,
    Supplier: supMap.get(t.supplier_id) || `Supplier_${t.supplier_id}`,
    Tanggal: t.tanggal,
    No_Kendaraan: t.no_kendaraan,
    Bruto: t.bruto_kg,
    Denda: t.denda_kg,
    Persen_Denda: t.persen_denda,
    Netto: t.netto_kg,
    Grade: t.grade,
    Harga: t.harga_rp,
    Total_Rp: t.total_rp,
    DxP: mapVarietasToDxPCode(t.varietas_dxp),
    Varietas: t.varietas_dxp,
    Quality: t.quality_tier,
    Validated: t.validated ? 'OK' : 'Draft',
  }));
}

export function buildEstateTransactionsExcelRows(
  transactions: EstateTransaction[],
  estates: Estate[],
  estateIdFilter?: number
) {
  const estMap = new Map(estates.map((e) => [e.id, e]));
  const filtered = estateIdFilter
    ? transactions.filter((t) => t.estate_id === estateIdFilter)
    : transactions;

  return filtered.map((t, idx) => {
    const est = estMap.get(t.estate_id);
    return {
      No: idx + 1,
      Kebun: est?.name || `Estate_${t.estate_id}`,
      Tipe: est?.type || 'PLASMA',
      Tanggal: t.tanggal,
      No_Polisi: t.no_polisi,
      Bulan_Th_Tanam: t.bulan_th_tanam,
      Bruto: t.bruto_kg,
      Denda: t.denda_kg,
      Netto: t.netto_kg,
      Persen_Denda: t.persen_denda,
      Umur: t.umur,
      Harga: t.harga_rp,
      Total_Rp: t.total_rp,
      Validated: t.validated ? 'OK' : 'Draft',
    };
  });
}

export function buildSupplierTemplateRows(supplierName = 'CV.BAYA MARAGIT') {
  return [
    {
      Tipe: 'SUPPLIER',
      Supplier: supplierName,
      Tanggal: '2026-11-21',
      No_Kendaraan: 'KB8548CH',
      Bruto: 4250,
      Denda: 110,
      Grade: 13.0,
      DxP: '',
      Harga: 2750,
    },
    {
      Tipe: 'SUPPLIER',
      Supplier: supplierName,
      Tanggal: '2026-11-21',
      No_Kendaraan: 'KB8154PC',
      Bruto: 6200,
      Denda: 180,
      Grade: 13.2,
      DxP: '1',
      Harga: 2750,
    },
  ];
}

export function buildEstateTemplateRows(estateName = 'PT.MJL PLASMA') {
  return [
    {
      Tipe: 'ESTATE',
      Kebun: estateName,
      Tanggal: '2026-11-21',
      No_Polisi: 'KB8773AT',
      Bulan_Th_Tanam: 'Dec-09',
      Bruto: 6780,
      Denda: 190,
      Umur: 10,
    },
    {
      Tipe: 'ESTATE',
      Kebun: estateName,
      Tanggal: '2026-11-21',
      No_Polisi: 'KB8277HD',
      Bulan_Th_Tanam: 'Aug-10, Sep-10',
      Bruto: 3200,
      Denda: 64,
      Umur: 10,
    },
  ];
}

