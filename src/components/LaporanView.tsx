import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { AppDatabaseState } from '../types/tbs';
import {
  calculateSupplierReportSummary,
  enumerateDateRangeIso,
  formatDateDisplay,
  formatDateIndoLong,
  formatNumberID,
  terbilangRupiah,
} from '../utils/tbsCalculations';
import { CompanyLogo } from './CompanyLogo';

interface LaporanViewProps {
  state: AppDatabaseState;
  initialStart: string;
  initialEnd: string;
  onPrint: () => void;
}

type ReportMode =
  | 'rekap_relasi'
  | 'detail_supplier'
  | 'draft_estate_harian'
  | 'rekap_estate_periode'
  | 'rekap_gabungan';

export const LaporanView: React.FC<LaporanViewProps> = ({
  state,
  initialStart,
  initialEnd,
  onPrint,
}) => {
  const [mode, setMode] = useState<ReportMode>('rekap_relasi');
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [usePeriodFilter, setUsePeriodFilter] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(
    state.suppliers.find((s) => s.name.includes('MEGAMBAS'))?.id || state.suppliers[0]?.id || 1
  );
  const [selectedEstateId, setSelectedEstateId] = useState<number>(
    state.estates[0]?.id || 1
  );
  const [draftDate, setDraftDate] = useState<string>('2026-11-20');
  const [signDateIso, setSignDateIso] = useState<string>(initialEnd || '2026-11-23');

  const pph22Rate = state.settings.pph22_rate || 0.0025;
  const pph4Rate = state.settings.pph4_rate || 0.005;

  const supFiltered = useMemo(() => {
    return state.supplier_transactions.filter((t) => {
      if (!usePeriodFilter) return true;
      return (!startDate || t.tanggal >= startDate) && (!endDate || t.tanggal <= endDate);
    });
  }, [state.supplier_transactions, usePeriodFilter, startDate, endDate]);

  const estFiltered = useMemo(() => {
    return state.estate_transactions.filter((t) => {
      if (!usePeriodFilter) return true;
      return (!startDate || t.tanggal >= startDate) && (!endDate || t.tanggal <= endDate);
    });
  }, [state.estate_transactions, usePeriodFilter, startDate, endDate]);

  // 1. Rekap Relasi (All 31+ Suppliers)
  const relasiRows = useMemo(() => {
    return state.suppliers.map((sup) => {
      const txs = supFiltered.filter((t) => t.supplier_id === sup.id);
      const calc = calculateSupplierReportSummary({
        supplier: sup,
        transactions: txs,
        pph22Rate,
        pph4Rate,
      });
      return { supplier: sup, calc };
    });
  }, [state.suppliers, supFiltered, pph22Rate, pph4Rate]);

  const relasiTotals = useMemo(() => {
    return relasiRows.reduce(
      (acc, r) => ({
        bruto: acc.bruto + r.calc.brutoKg,
        denda: acc.denda + r.calc.dendaKg,
        netto: acc.netto + r.calc.nettoKg,
        nilaiRupiah: acc.nilaiRupiah + r.calc.nilaiRupiah,
        subsidiNetto: acc.subsidiNetto + r.calc.subsidiNettoRp,
        subsidiTenera: acc.subsidiTenera + r.calc.subsidiTeneraRp,
        pph22: acc.pph22 + r.calc.pph22Rp,
        pph4: acc.pph4 + r.calc.pph4Rp,
        nilaiDibayar: acc.nilaiDibayar + r.calc.nilaiDibayar,
      }),
      {
        bruto: 0,
        denda: 0,
        netto: 0,
        nilaiRupiah: 0,
        subsidiNetto: 0,
        subsidiTenera: 0,
        pph22: 0,
        pph4: 0,
        nilaiDibayar: 0,
      }
    );
  }, [relasiRows]);

  // 2. Detail Per Supplier
  const activeSupplier =
    state.suppliers.find((s) => s.id === selectedSupplierId) || state.suppliers[0];
  const supplierDetailTxs = useMemo(() => {
    if (!activeSupplier) return [];
    return supFiltered
      .filter((t) => t.supplier_id === activeSupplier.id)
      .slice()
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id - b.id);
  }, [supFiltered, activeSupplier]);

  const supplierDetailSummary = useMemo(() => {
    if (!activeSupplier) return null;
    return calculateSupplierReportSummary({
      supplier: activeSupplier,
      transactions: supplierDetailTxs,
      pph22Rate,
      pph4Rate,
    });
  }, [activeSupplier, supplierDetailTxs, pph22Rate, pph4Rate]);

  // 3. Draft Harian Estate (Inti / Plasma)
  const activeEstate =
    state.estates.find((e) => e.id === selectedEstateId) || state.estates[0];

  const estateDraftRows = useMemo(() => {
    if (!activeEstate) return [];
    const rows = state.estate_transactions
      .filter((t) => t.estate_id === activeEstate.id && t.tanggal === draftDate)
      .slice()
      .sort((a, b) => a.no_polisi.localeCompare(b.no_polisi) || a.id - b.id);

    let vehicleNo = 0;
    let prevPol = '';
    return rows.map((r) => {
      const isFirstOfVehicle = r.no_polisi !== prevPol;
      if (isFirstOfVehicle) {
        vehicleNo += 1;
        prevPol = r.no_polisi;
      }
      const totalRp = Math.round(r.total_rp);
      return {
        ...r,
        vehicleNo: isFirstOfVehicle ? String(vehicleNo) : '',
        displayPolisi: isFirstOfVehicle ? r.no_polisi : '-',
        totalRpRounded: totalRp,
      };
    });
  }, [state.estate_transactions, activeEstate, draftDate]);

  const estateDraftTotals = useMemo(() => {
    const bruto = estateDraftRows.reduce((s, r) => s + r.bruto_kg, 0);
    const denda = estateDraftRows.reduce((s, r) => s + r.denda_kg, 0);
    const netto = estateDraftRows.reduce((s, r) => s + r.netto_kg, 0);
    const totalRp = estateDraftRows.reduce((s, r) => s + r.totalRpRounded, 0);
    const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
    const pph22 = Math.round(totalRp * pph22Rate);
    const nilaiDibayar = Math.max(0, totalRp - pph22);
    return { bruto, denda, netto, persen, totalRp, pph22, nilaiDibayar };
  }, [estateDraftRows, pph22Rate]);

  // 4. Rekap Estate Per Periode (Date-by-date calendar)
  const estatePeriodRows = useMemo(() => {
    if (!activeEstate) return [];
    const dates = enumerateDateRangeIso(startDate, endDate);
    return dates.map((iso) => {
      const dayTxs = state.estate_transactions.filter(
        (t) => t.estate_id === activeEstate.id && t.tanggal === iso
      );
      const bruto = dayTxs.reduce((s, r) => s + r.bruto_kg, 0);
      const denda = dayTxs.reduce((s, r) => s + r.denda_kg, 0);
      const netto = dayTxs.reduce((s, r) => s + r.netto_kg, 0);
      const totalRp = dayTxs.reduce((s, r) => s + Math.round(r.total_rp), 0);
      const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
      const pph22 = Math.round(totalRp * pph22Rate);
      const nilaiDibayar = Math.max(0, totalRp - pph22);
      const avgUmur = dayTxs.length > 0 ? dayTxs[0].umur : 0;
      const avgHarga = dayTxs.length > 0 ? dayTxs[0].harga_rp : 0;
      return { iso, count: dayTxs.length, bruto, denda, netto, persen, avgUmur, avgHarga, totalRp, pph22, nilaiDibayar };
    });
  }, [state.estate_transactions, activeEstate, startDate, endDate, pph22Rate]);

  const estatePeriodTotals = useMemo(() => {
    const bruto = estatePeriodRows.reduce((s, r) => s + r.bruto, 0);
    const denda = estatePeriodRows.reduce((s, r) => s + r.denda, 0);
    const netto = estatePeriodRows.reduce((s, r) => s + r.netto, 0);
    const totalRp = estatePeriodRows.reduce((s, r) => s + r.totalRp, 0);
    const pph22 = estatePeriodRows.reduce((s, r) => s + r.pph22, 0);
    const nilaiDibayar = estatePeriodRows.reduce((s, r) => s + r.nilaiDibayar, 0);
    const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
    return { bruto, denda, netto, persen, totalRp, pph22, nilaiDibayar };
  }, [estatePeriodRows]);

  // 5. Rekap Penerimaan Gabungan (Suppliers + Estates)
  const gabunganRows = useMemo(() => {
    const supPart = relasiRows.map((r) => ({
      name: r.supplier.name,
      bruto: r.calc.brutoKg,
      denda: r.calc.dendaKg,
      netto: r.calc.nettoKg,
      persen: r.calc.persenDenda,
      totalRp: r.calc.nilaiRupiah,
      subsidi: r.calc.subsidiNettoRp + r.calc.subsidiTeneraRp,
      insentif: r.calc.insentifRp,
      grandTotal: r.calc.nilaiRupiah + r.calc.subsidiNettoRp + r.calc.subsidiTeneraRp + r.calc.insentifRp,
    }));
    const estPart = state.estates.map((est) => {
      const txs = estFiltered.filter((t) => t.estate_id === est.id);
      const bruto = txs.reduce((s, t) => s + t.bruto_kg, 0);
      const denda = txs.reduce((s, t) => s + t.denda_kg, 0);
      const netto = txs.reduce((s, t) => s + t.netto_kg, 0);
      const totalRp = txs.reduce((s, t) => s + Math.round(t.total_rp), 0);
      const persen = bruto > 0 ? Number(((denda / bruto) * 100).toFixed(2)) : 0;
      return {
        name: est.name,
        bruto,
        denda,
        netto,
        persen,
        totalRp,
        subsidi: 0,
        insentif: 0,
        grandTotal: totalRp,
      };
    });
    return [...supPart, ...estPart];
  }, [relasiRows, state.estates, estFiltered]);

  const gabunganTotals = useMemo(() => {
    return gabunganRows.reduce(
      (acc, r) => ({
        bruto: acc.bruto + r.bruto,
        denda: acc.denda + r.denda,
        netto: acc.netto + r.netto,
        totalRp: acc.totalRp + r.totalRp,
        subsidi: acc.subsidi + r.subsidi,
        insentif: acc.insentif + r.insentif,
        grandTotal: acc.grandTotal + r.grandTotal,
      }),
      { bruto: 0, denda: 0, netto: 0, totalRp: 0, subsidi: 0, insentif: 0, grandTotal: 0 }
    );
  }, [gabunganRows]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (mode === 'rekap_relasi') {
      const aoa = [
        [state.settings.company_name.toUpperCase()],
        ['REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI RELASI'],
        [`PERIODE: ${formatDateIndoLong(startDate)} S/D ${formatDateIndoLong(endDate)}`],
        [],
        [
          'No.',
          'Nama Relasi',
          'Masa Berlaku SPK',
          'Bruto (kg)',
          'Denda (kg)',
          'Netto (Kg)',
          'Nilai Rupiah',
          'Subsidi Netto Harga (Rp/Kg)',
          'Subsidi Netto Jlh (Rp)',
          'Subsidi Tenera Jlh (Rp)',
          'Potongan PPH Pasal 22',
          'Potongan PPH Pasal 4 (2)',
          'Nilai Rupiah Dibayar',
        ],
        ...relasiRows.map((r, i) => [
          i + 1,
          r.supplier.name,
          r.supplier.masa_berlaku_spk || 's/d 31/12/26',
          r.calc.brutoKg,
          r.calc.dendaKg,
          r.calc.nettoKg,
          r.calc.nilaiRupiah,
          r.calc.subsidiNettoRate,
          r.calc.subsidiNettoRp,
          r.calc.subsidiTeneraRp,
          r.calc.pph22Rp,
          r.calc.pph4Rp,
          r.calc.nilaiDibayar,
        ]),
        [
          '',
          'GRAND TOTAL',
          '',
          relasiTotals.bruto,
          relasiTotals.denda,
          relasiTotals.netto,
          relasiTotals.nilaiRupiah,
          '',
          relasiTotals.subsidiNetto,
          relasiTotals.subsidiTenera,
          relasiTotals.pph22,
          relasiTotals.pph4,
          relasiTotals.nilaiDibayar,
        ],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Rekap Relasi');
      XLSX.writeFile(wb, `Laporan_Rekapitulasi_Pembayaran_Relasi_${startDate}.xlsx`);
    } else if (mode === 'detail_supplier' && activeSupplier && supplierDetailSummary) {
      const aoa = [
        [state.settings.company_name.toUpperCase()],
        [`REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI ${activeSupplier.name.toUpperCase()}`],
        [],
        ['No.', 'TGL. Terima', 'No. Kendaraan', 'Bruto (kg)', 'Denda (kg)', '%', 'Netto (Kg)', 'Grade', 'Varietas', 'Harga', 'Nilai Rupiah'],
        ...supplierDetailTxs.map((t, i) => [
          i + 1,
          formatDateDisplay(t.tanggal),
          t.no_kendaraan,
          t.bruto_kg,
          t.denda_kg,
          t.persen_denda,
          t.netto_kg,
          t.quality_tier,
          t.varietas_dxp,
          t.harga_rp,
          t.total_rp,
        ]),
        [
          '',
          'GRAND TOTAL',
          '',
          supplierDetailSummary.brutoKg,
          supplierDetailSummary.dendaKg,
          supplierDetailSummary.persenDenda,
          supplierDetailSummary.nettoKg,
          '',
          '',
          '',
          supplierDetailSummary.nilaiRupiah,
        ],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Detail Supplier');
      XLSX.writeFile(wb, `Laporan_${activeSupplier.name.replace(/\s+/g, '_')}.xlsx`);
    } else if (mode === 'draft_estate_harian' && activeEstate) {
      const aoa = [
        [state.settings.company_name.toUpperCase()],
        [`PERHITUNGAN PEMBELIAN TBS DARI ${activeEstate.name.toUpperCase()}`],
        [`TANGGAL : ${formatDateIndoLong(draftDate)}`],
        [],
        ['No.', 'No. Kendaraan', 'Bulan & Tahun Tanam', 'Bruto (kg)', 'Denda (kg)', 'Netto (kg)', '%', 'Umur (Thn)', 'Harga (Disbun)', 'Total (Rp.)'],
        ...estateDraftRows.map((r) => [
          r.vehicleNo,
          r.displayPolisi,
          r.bulan_th_tanam,
          r.bruto_kg,
          r.denda_kg,
          r.netto_kg,
          r.persen_denda,
          activeEstate.type === 'PLASMA' ? '≥ 10' : r.umur,
          r.harga_rp,
          r.totalRpRounded,
        ]),
        [
          '',
          'Jumlah',
          '',
          estateDraftTotals.bruto,
          estateDraftTotals.denda,
          estateDraftTotals.netto,
          estateDraftTotals.persen,
          '',
          '',
          estateDraftTotals.totalRp,
        ],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Draft Estate');
      XLSX.writeFile(wb, `Draft_${activeEstate.name.replace(/\s+/g, '_')}_${draftDate}.xlsx`);
    } else if (mode === 'rekap_estate_periode' && activeEstate) {
      const aoa = [
        [state.settings.company_name.toUpperCase()],
        [`REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI ${activeEstate.name.toUpperCase()}`],
        [`PERIODE : ${formatDateIndoLong(startDate)} s/d ${formatDateIndoLong(endDate)}`],
        [],
        ['Tanggal Terima', 'Bruto (kg)', 'Denda (kg)', 'Netto (kg)', '%', 'Total (Rp.)', 'PPH Pasal 22', 'Nilai Dibayar'],
        ...estatePeriodRows.map((r) => [
          formatDateDisplay(r.iso),
          r.bruto,
          r.denda,
          r.netto,
          r.persen,
          r.totalRp,
          r.pph22,
          r.nilaiDibayar,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Rekap Estate Periode');
      XLSX.writeFile(wb, `Rekap_Estate_${activeEstate.name.replace(/\s+/g, '_')}.xlsx`);
    } else {
      const aoa = [
        [state.settings.company_name.toUpperCase()],
        ['REKAPITULASI PENERIMAAN TBS GABUNGAN'],
        [],
        ['No.', 'Nama Relasi / Suppliers', 'Bruto', 'Denda', 'Netto', '%', 'Total (RP)', 'Subsidi Transport', 'Insentif', 'Grand Total'],
        ...gabunganRows.map((r, i) => [
          i + 1,
          r.name,
          r.bruto,
          r.denda,
          r.netto,
          r.persen,
          r.totalRp,
          r.subsidi,
          r.insentif,
          r.grandTotal,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Rekap Gabungan');
      XLSX.writeFile(wb, `Rekap_Penerimaan_TBS_Gabungan.xlsx`);
    }
  };

  const renderSignatures = () => {
    const s = state.settings;
    return (
      <div className="mt-8 text-xs text-slate-900">
        <div className="flex justify-end mb-2">
          <p className="font-medium">
            {s.report_city || 'Sebawi'}, {formatDateIndoLong(signDateIso)}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <p>Disetujui,</p>
            <div className="h-14" />
            <p className="font-bold underline">{s.ttd_disetujui_name}</p>
            <p className="text-[11px]">{s.ttd_disetujui_title}</p>
          </div>
          <div>
            <p>Diperiksa,</p>
            <div className="h-14" />
            <p className="font-bold underline">{s.ttd_diperiksa_name}</p>
            <p className="text-[11px]">{s.ttd_diperiksa_title}</p>
          </div>
          <div>
            <p>Disiapkan,</p>
            <div className="h-14" />
            <p className="font-bold underline">{s.ttd_disiapkan_name}</p>
            <p className="text-[11px]">{s.ttd_disiapkan_title}</p>
          </div>
        </div>
      </div>
    );
  };

  const refDocCode = useMemo(() => {
    if (!activeEstate) return '';
    const prefix = activeEstate.type === 'INTI' ? '0017 /INTI' : '0015 /PLSM';
    const shortKebun = activeEstate.name.replace(/\s*(PLASMA|INTI)$/i, '').replace(/\./g, '').trim();
    const yr = draftDate.slice(2, 4) || '26';
    return `${prefix}/REK-TBS/FSK-${shortKebun}/XI/${yr}`;
  }, [activeEstate, draftDate]);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Controls Bar (hidden on print) */}
      <div className="no-print space-y-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Menu Laporan Resmi Pembelian & Pembayaran TBS
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Format laporan resmi sesuai dokumen Rekapitulasi Relasi, Detail Per Supplier, dan Draft Harian Estate Inti/Plasma.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 font-semibold text-white hover:opacity-95"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* Report Type Sub-tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'rekap_relasi', label: '1. Rekap Relasi (All Suppliers)' },
            { id: 'detail_supplier', label: '2. Detail Per Supplier' },
            { id: 'draft_estate_harian', label: '3. Draft Estate Harian (Inti/Plasma)' },
            { id: 'rekap_estate_periode', label: '4. Rekap Harian Estate Periode' },
            { id: 'rekap_gabungan', label: '5. Rekap Penerimaan Gabungan' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id as ReportMode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === tab.id
                  ? 'bg-brand-accent text-white shadow-xs'
                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
          {mode === 'detail_supplier' && (
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <span>Pilih Supplier:</span>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-white"
              >
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(mode === 'draft_estate_harian' || mode === 'rekap_estate_periode') && (
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <span>Pilih Kebun / Estate:</span>
              <select
                value={selectedEstateId}
                onChange={(e) => setSelectedEstateId(Number(e.target.value))}
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-900 dark:text-white"
              >
                {state.estates.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.type})
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'draft_estate_harian' ? (
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <span>Tanggal Draft:</span>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-mono-num"
              />
            </label>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Periode:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono-num"
                />
                <span>s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono-num"
                />
              </div>
              {mode !== 'rekap_estate_periode' && (
                <button
                  type="button"
                  onClick={() => setUsePeriodFilter((v) => !v)}
                  className={`rounded px-3 py-1.5 font-semibold ${
                    usePeriodFilter
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {usePeriodFilter ? 'Filter Periode Aktif (Lihat Semua)' : 'Terapkan Filter Tanggal'}
                </button>
              )}
            </>
          )}

          <label className="ml-auto flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span>Tgl. TTD:</span>
            <input
              type="date"
              value={signDateIso}
              onChange={(e) => setSignDateIso(e.target.value)}
              className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono-num"
            />
          </label>
        </div>
      </div>

      {/* PRINTABLE OFFICIAL REPORT SHEET */}
      <div className="print-sheet rounded-xl border border-slate-300 bg-white p-6 text-slate-950 shadow-sm overflow-x-auto">
        {/* Official Letterhead matching uploaded PDFs */}
        <div className="relative flex items-center justify-center border-b border-slate-200 pb-4 mb-4">
          <div className="absolute left-0 top-0">
            <CompanyLogo
              logoUrl={state.settings.company_logo}
              companyName={state.settings.company_name}
              size="lg"
            />
          </div>
          <div className="text-center px-16">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              {state.settings.company_name}
            </h3>
            <p className="text-sm font-bold uppercase">
              {mode === 'rekap_relasi' && 'REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI RELASI'}
              {mode === 'detail_supplier' &&
                `REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI ${activeSupplier?.name || ''}`}
              {mode === 'draft_estate_harian' &&
                `PERHITUNGAN PEMBELIAN TBS DARI ${activeEstate?.name || ''}`}
              {mode === 'rekap_estate_periode' &&
                `REKAPITULASI PERHITUNGAN PEMBELIAN TBS DARI ${activeEstate?.name || ''}`}
              {mode === 'rekap_gabungan' && 'REKAPITULASI PENERIMAAN TBS'}
            </p>
            <p className="text-xs font-semibold mt-0.5">
              {mode === 'draft_estate_harian'
                ? `TANGGAL : ${formatDateIndoLong(draftDate)}`
                : usePeriodFilter || mode === 'rekap_estate_periode'
                ? `PERIODE : ${formatDateIndoLong(startDate)} S/D ${formatDateIndoLong(endDate)}`
                : `PERIODE : ${formatDateIndoLong(startDate)} S/D ${formatDateIndoLong(endDate)} (Semua Data Tersimpan)`}
            </p>
          </div>
          {mode === 'draft_estate_harian' && (
            <div className="absolute right-0 bottom-1 font-mono-num text-[11px] font-semibold">
              {refDocCode}
            </div>
          )}
        </div>

        {/* REPORT 1: REKAP RELASI (ALL SUPPLIERS) */}
        {mode === 'rekap_relasi' && (
          <>
            <table className="w-full border-collapse border-2 border-slate-900 text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th rowSpan={2} className="border border-slate-800 px-1.5 py-1.5">No.</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5 text-left">Nama Relasi</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Masa Berlaku SPK</th>
                  <th colSpan={3} className="border border-slate-800 px-2 py-1">Penerimaan TBS</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Nilai Rupiah</th>
                  <th colSpan={2} className="border border-slate-800 px-2 py-1">Subsidi Netto</th>
                  <th className="border border-slate-800 px-2 py-1">Tenera</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Potongan PPH pasal 22</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Potongan PPH pasal 4 (2)</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Nilai Rupiah Dibayar</th>
                </tr>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-800 px-2 py-1">Bruto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1">Denda (kg)</th>
                  <th className="border border-slate-800 px-2 py-1">Netto (Kg)</th>
                  <th className="border border-slate-800 px-1.5 py-1">Harga (Rp/Kg)</th>
                  <th className="border border-slate-800 px-2 py-1">Jlh (Rp.)</th>
                  <th className="border border-slate-800 px-2 py-1">Jlh (Rp.)</th>
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {relasiRows.map(({ supplier, calc }, idx) => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{idx + 1}</td>
                    <td className="border border-slate-400 px-2 py-1 font-sans font-semibold whitespace-nowrap">
                      {supplier.name}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-center whitespace-nowrap">
                      {supplier.masa_berlaku_spk || 's/d 31/12/26'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.brutoKg > 0 ? formatNumberID(calc.brutoKg) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.dendaKg > 0 ? formatNumberID(calc.dendaKg) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-semibold">
                      {calc.nettoKg > 0 ? formatNumberID(calc.nettoKg) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.nilaiRupiah > 0 ? formatNumberID(calc.nilaiRupiah) : '-'}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1 text-right">
                      {calc.subsidiNettoRate > 0 ? formatNumberID(calc.subsidiNettoRate) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.subsidiNettoRp > 0 ? formatNumberID(calc.subsidiNettoRp) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.subsidiTeneraRp > 0 ? formatNumberID(calc.subsidiTeneraRp) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.pph22Rp > 0 ? formatNumberID(calc.pph22Rp) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {calc.pph4Rp > 0 ? formatNumberID(calc.pph4Rp) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-bold">
                      {calc.nilaiDibayar > 0 ? formatNumberID(calc.nilaiDibayar) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono-num">
                <tr>
                  <td colSpan={3} className="border-2 border-slate-900 px-2 py-1.5 text-center font-sans">
                    GRAND TOTAL
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.bruto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.denda)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.netto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.nilaiRupiah)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.subsidiNetto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.subsidiTenera)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.pph22)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.pph4)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(relasiTotals.nilaiDibayar)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs">
              <strong>Terbilang :</strong> {terbilangRupiah(relasiTotals.nilaiDibayar)}
            </p>
            {renderSignatures()}
          </>
        )}

        {/* REPORT 2: DETAIL PER SUPPLIER (contoh_1 .. contoh_4) */}
        {mode === 'detail_supplier' && activeSupplier && supplierDetailSummary && (
          <>
            <table className="w-full border-collapse border-2 border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">No.</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">TGL. Terima</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">No. Kendaraan</th>
                  <th colSpan={4} className="border border-slate-800 px-2 py-1">Penerimaan TBS</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Grade</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Harga</th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Nilai Rupiah</th>
                  {(supplierDetailSummary.subsidiNettoRp > 0 || supplierDetailSummary.subsidiTeneraRp > 0) && (
                    <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Subsidi Transport</th>
                  )}
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">
                    {activeSupplier.pph_type === 'PPH4_2' ? 'Potongan PPH pasal 4 (2)' : 'PPH pasal 22'}
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1.5">Nilai Dibayar</th>
                </tr>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-800 px-2 py-1">Bruto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1">Denda (kg)</th>
                  <th className="border border-slate-800 px-2 py-1">%</th>
                  <th className="border border-slate-800 px-2 py-1">Netto (Kg)</th>
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {supplierDetailTxs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="border border-slate-400 px-4 py-6 text-center font-sans text-slate-500">
                      Belum ada transaksi timbangan untuk {activeSupplier.name} pada periode ini.
                    </td>
                  </tr>
                ) : (
                  supplierDetailTxs.map((tx, idx) => {
                    const isTenera = tx.varietas_dxp === 'TENERA';
                    const rowSubsidi = isTenera
                      ? Math.round(tx.netto_kg * (activeSupplier.subsidi_tenera_rp ?? 100))
                      : Math.round(tx.netto_kg * (activeSupplier.subsidi_netto_rp ?? 0));
                    return (
                      <tr key={tx.id}>
                        <td className="border border-slate-400 px-2 py-1 text-center">{idx + 1}</td>
                        <td className="border border-slate-400 px-2 py-1 text-center font-semibold">
                          {formatDateDisplay(tx.tanggal)}
                        </td>
                        <td className="border border-slate-400 px-2 py-1 text-center">{tx.no_kendaraan}</td>
                        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(tx.bruto_kg)}</td>
                        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(tx.denda_kg)}</td>
                        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(tx.persen_denda, 2)}</td>
                        <td
                          className={`border border-slate-400 px-2 py-1 text-right font-semibold ${
                            isTenera ? 'bg-lime-300/80 text-slate-950' : ''
                          }`}
                        >
                          {formatNumberID(tx.netto_kg)}
                        </td>
                        <td className="border border-slate-400 px-2 py-1 text-center font-bold">{tx.quality_tier}</td>
                        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(tx.harga_rp)}</td>
                        <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(tx.total_rp)}</td>
                        {(supplierDetailSummary.subsidiNettoRp > 0 || supplierDetailSummary.subsidiTeneraRp > 0) && (
                          <td className="border border-slate-400 px-2 py-1 text-right">
                            {rowSubsidi > 0 ? formatNumberID(rowSubsidi) : '-'}
                          </td>
                        )}
                        <td className="border border-slate-400 px-2 py-1 text-right" />
                        <td className="border border-slate-400 px-2 py-1 text-right" />
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono-num">
                <tr>
                  <td colSpan={3} className="border-2 border-slate-900 px-2 py-1.5 text-center font-sans">
                    GRAND TOTAL
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.brutoKg)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.dendaKg)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.persenDenda, 2)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.nettoKg)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.nilaiRupiah)}
                  </td>
                  {(supplierDetailSummary.subsidiNettoRp > 0 || supplierDetailSummary.subsidiTeneraRp > 0) && (
                    <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                      {formatNumberID(supplierDetailSummary.subsidiNettoRp + supplierDetailSummary.subsidiTeneraRp)}
                    </td>
                  )}
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(
                      activeSupplier.pph_type === 'PPH4_2'
                        ? supplierDetailSummary.pph4Rp
                        : supplierDetailSummary.pph22Rp
                    )}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(supplierDetailSummary.nilaiDibayar)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-3 text-xs">
              <strong>Terbilang :</strong> {terbilangRupiah(supplierDetailSummary.nilaiDibayar)}
            </p>

            {/* NB Footnotes matching contoh_1 .. contoh_4 */}
            <div className="mt-4 space-y-1 text-xs font-mono-num">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-sans w-72">
                  NB: Subsidi angkutan Netto TBS @ Rp.{formatNumberID(supplierDetailSummary.subsidiNettoRate)},-/Kg *
                </span>
                <span className="w-24 text-right font-semibold">
                  {supplierDetailSummary.nonTeneraNettoKg > 0
                    ? formatNumberID(supplierDetailSummary.nonTeneraNettoKg)
                    : '-'}
                </span>
                <span>Kg = Rp.</span>
                <span className="w-28 text-right font-bold">
                  {supplierDetailSummary.subsidiNettoRp > 0
                    ? `${formatNumberID(supplierDetailSummary.subsidiNettoRp)} ,-`
                    : '- ,-'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-sans w-72 inline-flex items-center gap-2">
                  <span className="inline-block h-3.5 w-6 bg-lime-300 border border-lime-600" />
                  Subsidi angkutan Khusus TBS Tenera @ Rp.{formatNumberID(supplierDetailSummary.subsidiTeneraRate)},-/Kg *
                </span>
                <span className="w-24 text-right font-semibold">
                  {supplierDetailSummary.teneraNettoKg > 0
                    ? formatNumberID(supplierDetailSummary.teneraNettoKg)
                    : '-'}
                </span>
                <span>Kg = Rp.</span>
                <span className="w-28 text-right font-bold">
                  {supplierDetailSummary.subsidiTeneraRp > 0
                    ? `${formatNumberID(supplierDetailSummary.subsidiTeneraRp)} ,-`
                    : '- ,-'}
                </span>
              </div>
            </div>

            {renderSignatures()}
          </>
        )}

        {/* REPORT 3: DRAFT HARIAN ESTATE (INTI / PLASMA) */}
        {mode === 'draft_estate_harian' && activeEstate && (
          <>
            <table className="w-full border-collapse border-2 border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-800 px-2 py-1.5">No.</th>
                  <th className="border border-slate-800 px-2 py-1.5">No. Kendaraan</th>
                  <th className="border border-slate-800 px-2 py-1.5">Bulan & Tahun Tanam</th>
                  <th className="border border-slate-800 px-2 py-1.5">Bruto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Denda (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Netto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">%</th>
                  <th className="border border-slate-800 px-2 py-1.5">Umur Tanaman (Tahun)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Harga (Disbun)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Total ( Rp. )</th>
                  <th className="border border-slate-800 px-2 py-1.5">PPH pasal 22</th>
                  <th className="border border-slate-800 px-2 py-1.5">Nilai Dibayar</th>
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {estateDraftRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="border border-slate-400 px-4 py-6 text-center font-sans text-slate-500">
                      Tidak ada penerimaan TBS untuk {activeEstate.name} pada tanggal {formatDateIndoLong(draftDate)}.
                    </td>
                  </tr>
                ) : (
                  estateDraftRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-slate-400 px-2 py-1 text-center">{row.vehicleNo}</td>
                      <td className="border border-slate-400 px-2 py-1 text-center font-semibold">
                        {row.displayPolisi}
                      </td>
                      <td className="border border-slate-400 px-2 py-1 text-center font-sans">
                        {row.bulan_th_tanam}
                      </td>
                      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(row.bruto_kg)}</td>
                      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(row.denda_kg)}</td>
                      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(row.netto_kg)}</td>
                      <td className="border border-slate-400 px-2 py-1 text-right">{formatNumberID(row.persen_denda, 2)}</td>
                      <td className="border border-slate-400 px-2 py-1 text-center">
                        {activeEstate.type === 'PLASMA' && row.umur >= 10 ? '≥ 10' : row.umur}
                      </td>
                      <td className="border border-slate-400 px-2 py-1 text-right">
                        {formatNumberID(Math.round(row.harga_rp))}
                      </td>
                      <td className="border border-slate-400 px-2 py-1 text-right font-semibold">
                        {formatNumberID(row.totalRpRounded)}
                      </td>
                      <td className="border border-slate-400 px-2 py-1 text-right" />
                      <td className="border border-slate-400 px-2 py-1 text-right" />
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono-num">
                <tr>
                  <td colSpan={3} className="border-2 border-slate-900 px-2 py-1.5 text-center font-sans">
                    Jumlah
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.bruto)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.denda)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.netto)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.persen, 2)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.totalRp)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.pph22)}
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">
                    {formatNumberID(estateDraftTotals.nilaiDibayar)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs">
              <strong>Terbilang :</strong> {terbilangRupiah(estateDraftTotals.nilaiDibayar)}
            </p>
            {renderSignatures()}
          </>
        )}

        {/* REPORT 4: REKAP ESTATE PER PERIODE (Calendar Table) */}
        {mode === 'rekap_estate_periode' && activeEstate && (
          <>
            <table className="w-full border-collapse border-2 border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-800 px-2 py-1.5">Tanggal Terima</th>
                  <th className="border border-slate-800 px-2 py-1.5">Bruto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Denda (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Netto (kg)</th>
                  <th className="border border-slate-800 px-2 py-1.5">%</th>
                  <th className="border border-slate-800 px-2 py-1.5">Total ( Rp. )</th>
                  <th className="border border-slate-800 px-2 py-1.5">PPH pasal 22</th>
                  <th className="border border-slate-800 px-2 py-1.5">Nilai Dibayar</th>
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {estatePeriodRows.map((r) => (
                  <tr key={r.iso}>
                    <td className="border border-slate-400 px-2 py-1 text-center">
                      {formatDateDisplay(r.iso)}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-semibold">
                      {r.bruto > 0 ? formatNumberID(r.bruto) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {r.denda > 0 ? formatNumberID(r.denda) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-semibold">
                      {r.netto > 0 ? formatNumberID(r.netto) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {r.bruto > 0 ? formatNumberID(r.persen, 2) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-bold">
                      {r.totalRp > 0 ? formatNumberID(r.totalRp) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {r.pph22 > 0 ? formatNumberID(r.pph22) : '-'}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-bold">
                      {r.nilaiDibayar > 0 ? formatNumberID(r.nilaiDibayar) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono-num">
                <tr>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-center font-sans">TOTAL</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.bruto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.denda)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.netto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.persen, 2)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.totalRp)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.pph22)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(estatePeriodTotals.nilaiDibayar)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs">
              <strong>Terbilang :</strong> {terbilangRupiah(estatePeriodTotals.nilaiDibayar)}
            </p>
            {renderSignatures()}
          </>
        )}

        {/* REPORT 5: REKAP PENERIMAAN GABUNGAN (Page 13) */}
        {mode === 'rekap_gabungan' && (
          <>
            <table className="w-full border-collapse border-2 border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-800 px-2 py-1.5">No.</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-left">Nama Relasi / Suppliers</th>
                  <th className="border border-slate-800 px-2 py-1.5">Bruto</th>
                  <th className="border border-slate-800 px-2 py-1.5">Denda</th>
                  <th className="border border-slate-800 px-2 py-1.5">Netto</th>
                  <th className="border border-slate-800 px-2 py-1.5">%</th>
                  <th className="border border-slate-800 px-2 py-1.5">Total (RP)</th>
                  <th className="border border-slate-800 px-2 py-1.5">Subsidi Transport</th>
                  <th className="border border-slate-800 px-2 py-1.5">Insentif</th>
                  <th className="border border-slate-800 px-2 py-1.5">Grand Total</th>
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {gabunganRows.map((r, idx) => (
                  <tr key={`${r.name}-${idx}`}>
                    <td className="border border-slate-400 px-2 py-1 text-center">{idx + 1}</td>
                    <td className="border border-slate-400 px-2 py-1 font-sans font-semibold">{r.name}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.bruto > 0 ? formatNumberID(r.bruto) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.denda > 0 ? formatNumberID(r.denda) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-semibold">{r.netto > 0 ? formatNumberID(r.netto) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.bruto > 0 ? formatNumberID(r.persen, 2) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.totalRp > 0 ? formatNumberID(r.totalRp) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.subsidi > 0 ? formatNumberID(r.subsidi) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{r.insentif > 0 ? formatNumberID(r.insentif) : '-'}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-bold">{r.grandTotal > 0 ? formatNumberID(r.grandTotal) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono-num">
                <tr>
                  <td colSpan={2} className="border-2 border-slate-900 px-2 py-1.5 text-center font-sans">
                    Grand Total
                  </td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.bruto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.denda)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.netto)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5" />
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.totalRp)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.subsidi)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.insentif)}</td>
                  <td className="border-2 border-slate-900 px-2 py-1.5 text-right">{formatNumberID(gabunganTotals.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs">
              <strong>Terbilang :</strong> {terbilangRupiah(gabunganTotals.grandTotal)}
            </p>
            {renderSignatures()}
          </>
        )}
      </div>
    </div>
  );
};
