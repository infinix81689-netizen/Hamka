import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEstateTemplateRows,
  buildEstateTransactionsExcelRows,
  buildSupplierTemplateRows,
  buildSupplierTransactionsExcelRows,
  calculateEstateBlokBreakdown,
  calculateSupplierMetrics,
  calculateSupplierReportSummary,
  DEFAULT_FOOTER_RUNNING_TEXT,
  DEFAULT_SIDEBAR_BG_IMAGE,
  determineQualityTier,
  enrichBlokRows,
  generateSqlDumpFromState,
  getDisbunPeriodeIndex,
  isValidLogoUrl,
  lookupHargaDisbun,
  mapDxPCodeToVarietas,
  normalizeImportedExcelRows,
  parseTimbanganCSV,
  terbilangRupiah,
} from './tbsCalculations';
import type {
  AppDatabaseState,
  BlokMaster,
  Estate,
  EstateTransaction,
  HargaDisbunInti,
  HargaDisbunPlasma,
  Supplier,
  SupplierTransaction,
} from '../types/tbs';

const sampleInti: HargaDisbunInti[] = [
  { id: 1, umur_label: '9', umur_min: 9, umur_max: 9, periode_1: 3412.47, periode_2: 3369.42, periode_3: 3219.06, periode_4: 3219.06, bulan_tahun: '2026-11' },
  { id: 2, umur_label: '10 - 20', umur_min: 10, umur_max: 20, periode_1: 3484.85, periode_2: 3440.93, periode_3: 3287.46, periode_4: 3287.46, bulan_tahun: '2026-11' },
];

const samplePlasma: HargaDisbunPlasma[] = [
  { id: 1, bulan_tahun: '2026-11', periode_1: 3484.85, periode_2: 3440.93, periode_3: 3287.46, periode_4: 3287.46 },
];

const sampleBlokMaster: BlokMaster[] = [
  { id: 1, kode_blok: 'G6', nama_kebun: 'PT.MJL', bulan_tanam: 'Sep-10', keterangan: 'Plasma', umur_tahun: 10 },
  { id: 2, kode_blok: 'G5', nama_kebun: 'PT.MJL', bulan_tanam: 'Aug-10', keterangan: 'Plasma', umur_tahun: 10 },
  { id: 3, kode_blok: 'H5', nama_kebun: 'PT.MJL', bulan_tanam: 'Dec-09', keterangan: 'Plasma', umur_tahun: 9 },
  { id: 4, kode_blok: 'H6', nama_kebun: 'PT.MJL', bulan_tanam: 'Dec-09', keterangan: 'Plasma', umur_tahun: 9 },
  { id: 5, kode_blok: 'I5', nama_kebun: 'PT.MJL', bulan_tanam: 'Nov-09', keterangan: 'Plasma', umur_tahun: 9 },
  { id: 6, kode_blok: 'I6', nama_kebun: 'PT.MJL', bulan_tanam: 'Nov-09', keterangan: 'Plasma', umur_tahun: 9 },
  { id: 7, kode_blok: 'G10', nama_kebun: 'PT.MJL', bulan_tanam: 'Sep-10', keterangan: 'Plasma', umur_tahun: 10 },
];

test('supplier metrics match screenshot row 192 (KB8548CH)', () => {
  const res = calculateSupplierMetrics({
    brutoKg: 2350,
    dendaKg: 60,
    grade: 12.25,
    dxpCode: '',
    hargaRp: 2750,
    maxGradPct: 5,
  });
  assert.equal(res.nettoKg, 2290);
  assert.equal(res.persenDenda, 2.55);
  assert.equal(res.varietas, 'DURA');
  assert.equal(res.qualityTier, 'HQ');
  assert.equal(res.totalRp, 6297500);
});

test('DxP mapping and quality tiering work accurately', () => {
  assert.equal(mapDxPCodeToVarietas('0'), 'PSIFERA');
  assert.equal(mapDxPCodeToVarietas('1'), 'TENERA');
  assert.equal(mapDxPCodeToVarietas(''), 'DURA');
  assert.equal(determineQualityTier(2.5, 5, 13), 'HQ');
  assert.equal(determineQualityTier(6.5, 5, 10.5), 'MQ');
  assert.equal(determineQualityTier(12.0, 5, 9), 'B');
});

test('Disbun period index and rate lookup', () => {
  assert.equal(getDisbunPeriodeIndex('2026-11-03'), 1);
  assert.equal(getDisbunPeriodeIndex('2026-11-12'), 2);
  assert.equal(getDisbunPeriodeIndex('2026-11-20'), 3);
  assert.equal(getDisbunPeriodeIndex('2026-11-28'), 4);

  assert.equal(
    lookupHargaDisbun({
      umur: 9,
      tanggalIso: '2026-11-20',
      kebunType: 'INTI',
      intiRates: sampleInti,
      plasmaRates: samplePlasma,
    }),
    3219.06
  );
  assert.equal(
    lookupHargaDisbun({
      umur: 9,
      tanggalIso: '2026-11-20',
      kebunType: 'PLASMA',
      intiRates: sampleInti,
      plasmaRates: samplePlasma,
    }),
    3287.46
  );
});

test('estate blok kalkulasi matches screenshot totals and zero selisih', () => {
  const enriched = enrichBlokRows(
    [
      { blok: 'G6', jjg: 87, brd_kg: 0 },
      { blok: 'G5', jjg: 50, brd_kg: 0 },
      { blok: 'H5', jjg: 58, brd_kg: 64 },
      { blok: 'H6', jjg: 45, brd_kg: 160 },
      { blok: 'I5', jjg: 84, brd_kg: 64 },
      { blok: 'I6', jjg: 30, brd_kg: 64 },
      { blok: 'G10', jjg: 78, brd_kg: 0 },
    ],
    sampleBlokMaster,
    'PT.MJL PLASMA'
  );

  const breakdown = calculateEstateBlokBreakdown({
    totalBruto: 6780,
    totalDenda: 190,
    blokRows: enriched,
    kebunType: 'PLASMA',
    tanggalIso: '2026-11-20',
    intiRates: sampleInti,
    plasmaRates: samplePlasma,
  });

  assert.equal(breakdown.totalJjg, 432);
  assert.equal(breakdown.totalBrd, 352);
  assert.equal(breakdown.groups.length, 2);
  assert.equal(breakdown.jumlahBruto, 6780);
  assert.equal(breakdown.jumlahDenda, 190);
  assert.equal(breakdown.selisihBruto, 0);
  assert.equal(breakdown.selisihDenda, 0);
  assert.equal(breakdown.groups[0].umur, 9);
  assert.equal(breakdown.groups[1].umur, 10);
});

test('parseTimbanganCSV parses Indonesian/ISO dates and numeric rows', () => {
  const csv = [
    'TANGGAL,NO_KENDARAAN,BRUTO,DENDA,GRADE,DXP',
    '21/11/2026,KB8888XX,4500,120,13.5,1',
    '2026-11-21,KB9999YY,3200,80,12.2,0',
  ].join('\n');
  const rows = parseTimbanganCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tanggal, '2026-11-21');
  assert.equal(rows[0].bruto_kg, 4500);
  assert.equal(rows[1].dxp, '0');
});

test('terbilangRupiah converts numbers accurately matching PDF wording', () => {
  assert.equal(terbilangRupiah(0), 'Nol Rupiah.');
  assert.equal(
    terbilangRupiah(47102989),
    'Empat Puluh Tujuh Juta Seratus Dua Ribu Sembilan Ratus Delapan Puluh Sembilan Rupiah.'
  );
  assert.equal(
    terbilangRupiah(25284913),
    'Dua Puluh Lima Juta Dua Ratus Delapan Puluh Empat Ribu Sembilan Ratus Tiga Belas Rupiah.'
  );
});

test('calculateSupplierReportSummary computes Subsidi Netto, Tenera, and PPH 22 / 4(2)', () => {
  const sup: Supplier = {
    id: 2,
    name: 'PT.MEGAMBAS',
    code: 'SUP-02',
    masa_berlaku_spk: 's/d 31/12/26',
    subsidi_netto_rp: 20,
    subsidi_tenera_rp: 100,
    pph_type: 'PPH22',
    active: 1,
  };
  const txs: SupplierTransaction[] = [
    {
      id: 1,
      supplier_id: 2,
      tanggal: '2026-11-20',
      no_kendaraan: 'KB8154PC',
      bruto_kg: 10200,
      denda_kg: 200,
      persen_denda: 1.96,
      netto_kg: 10000,
      grade: 13,
      harga_rp: 2750,
      total_rp: 27500000,
      varietas_dxp: 'DURA',
      quality_tier: 'HQ',
      validated: 1,
    },
    {
      id: 2,
      supplier_id: 2,
      tanggal: '2026-11-20',
      no_kendaraan: 'KB8977J',
      bruto_kg: 5200,
      denda_kg: 200,
      persen_denda: 3.85,
      netto_kg: 5000,
      grade: 13,
      harga_rp: 2750,
      total_rp: 13750000,
      varietas_dxp: 'TENERA',
      quality_tier: 'HQ',
      validated: 1,
    },
  ];
  const res = calculateSupplierReportSummary({
    supplier: sup,
    transactions: txs,
    pph22Rate: 0.0025,
    pph4Rate: 0.005,
  });
  assert.equal(res.nilaiRupiah, 41250000);
  assert.equal(res.subsidiNettoRp, 200000); // 10000 * 20
  assert.equal(res.subsidiTeneraRp, 500000); // 5000 * 100
  assert.equal(res.pph22Rp, 103125); // 41250000 * 0.0025
  assert.equal(res.pph4Rp, 0);
  assert.equal(res.nilaiDibayar, 41250000 + 200000 + 500000 - 103125);
});

test('normalizeImportedExcelRows separates Suppliers and Estate rows accurately', () => {
  const existingSuppliers: Supplier[] = [
    { id: 5, name: 'CV.BAYA MARAGIT', code: 'SUP-05', active: 1 },
  ];
  const existingEstates: Estate[] = [
    { id: 1, name: 'PT.MJL PLASMA', type: 'PLASMA' },
  ];
  const res = normalizeImportedExcelRows({
    rawRows: [
      {
        Tipe: 'SUPPLIER',
        Supplier: 'CV.BAYA MARAGIT',
        Tanggal: '20/11/2026',
        No_Kendaraan: 'KB1234AA',
        Bruto: 5000,
        Denda: 150,
        Grade: 13,
        DxP: '1',
      },
      {
        Tipe: 'ESTATE',
        Kebun: 'PT.MJL PLASMA',
        Tanggal: '20/11/2026',
        No_Polisi: 'KB5678BB',
        Bulan_Th_Tanam: 'Dec-09',
        Bruto: 6000,
        Denda: 120,
        Umur: 10,
      },
    ],
    targetMode: 'AUTO',
    defaultSupplierName: 'CV.BAYA MARAGIT',
    defaultEstateName: 'PT.MJL PLASMA',
    existingSuppliers,
    existingEstates,
    marketPrices: [{ bulan_tahun: '2026-11', tanggal: 20, harga: 2750 }],
    intiRates: sampleInti,
    plasmaRates: samplePlasma,
    fallbackHarga: 2750,
    maxGradPct: 5,
  });

  assert.equal(res.supplierRows.length, 1);
  assert.equal(res.supplierRows[0].varietas_dxp, 'TENERA');
  assert.equal(res.supplierRows[0].netto_kg, 4850);
  assert.equal(res.estateRows.length, 1);
  assert.equal(res.estateRows[0].harga_rp, 3287.46);
  assert.equal(res.estateRows[0].netto_kg, 5880);
});

test('isValidLogoUrl allows safe /src/assets/ paths and blocks javascript/traversal/SVG URIs', () => {
  assert.equal(isValidLogoUrl(''), true);
  assert.equal(isValidLogoUrl(DEFAULT_SIDEBAR_BG_IMAGE), true);
  assert.equal(isValidLogoUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isValidLogoUrl('/src/assets/../secret.txt'), false);
  assert.equal(isValidLogoUrl('javascript:alert(1)'), false);
  assert.equal(isValidLogoUrl('data:image/svg+xml;base64,PHNjcmlwdD4='), false);
});

test('Excel row builders and templates format Supplier and Estate data cleanly', () => {
  const suppliers: Supplier[] = [
    { id: 1, name: 'PT. CHAKRA', code: 'SUP-01', active: 1 },
    { id: 5, name: 'CV.BAYA MARAGIT', code: 'SUP-05', active: 1 },
  ];
  const supTxs: SupplierTransaction[] = [
    {
      id: 1,
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
      varietas_dxp: 'TENERA',
      quality_tier: 'HQ',
      validated: 1,
    },
  ];
  const supRows = buildSupplierTransactionsExcelRows(supTxs, suppliers, 5);
  assert.equal(supRows.length, 1);
  assert.equal(supRows[0].Supplier, 'CV.BAYA MARAGIT');
  assert.equal(supRows[0].DxP, '1');
  assert.equal(supRows[0].Validated, 'OK');
  assert.equal(buildSupplierTransactionsExcelRows(supTxs, suppliers, 1).length, 0);

  const estates: Estate[] = [{ id: 1, name: 'PT.MJL PLASMA', type: 'PLASMA' }];
  const estTxs: EstateTransaction[] = [
    {
      id: 1,
      estate_id: 1,
      tanggal: '2026-11-20',
      no_polisi: 'KB8773AT',
      bulan_th_tanam: 'Dec-09',
      bruto_kg: 6780,
      denda_kg: 190,
      netto_kg: 6590,
      persen_denda: 2.8,
      umur: 10,
      harga_rp: 3287.46,
      total_rp: 21664361,
      blok_details_json: '[]',
      validated: 0,
    },
  ];
  const estRows = buildEstateTransactionsExcelRows(estTxs, estates, 1);
  assert.equal(estRows.length, 1);
  assert.equal(estRows[0].Kebun, 'PT.MJL PLASMA');
  assert.equal(estRows[0].Tipe, 'PLASMA');
  assert.equal(estRows[0].Validated, 'Draft');

  const supTpl = buildSupplierTemplateRows('PT. CHAKRA');
  const estTpl = buildEstateTemplateRows('PT.DSU');
  assert.equal(supTpl[0].Supplier, 'PT. CHAKRA');
  assert.equal(estTpl[0].Kebun, 'PT.DSU');
});

test('generateSqlDumpFromState omits ttd_mengetahui and includes footer & sidebar settings', () => {
  const sampleState: AppDatabaseState = {
    suppliers: [],
    estates: [],
    blok_master: [],
    harga_disbun_inti: [],
    harga_disbun_plasma: [],
    harga_market_harian: [],
    supplier_transactions: [],
    estate_transactions: [],
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
  const dump = generateSqlDumpFromState(sampleState);
  assert.equal(dump.includes('ttd_mengetahui'), false);
  assert.equal(dump.includes('Rohmat Kuncoro'), false);
  assert.equal(dump.includes('footer_running_text'), true);
  assert.equal(dump.includes('sidebar_bg_image'), true);
  assert.equal(dump.includes('sidebar_bg_zoom'), true);
});
