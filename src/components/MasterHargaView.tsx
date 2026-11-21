import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type {
  AppDatabaseState,
  AppSettings,
  BlokMaster,
  HargaDisbunInti,
  HargaDisbunPlasma,
  HargaMarketHarian,
} from '../types/tbs';

interface MasterHargaViewProps {
  state: AppDatabaseState;
  onSaveBlok: (blok: Omit<BlokMaster, 'id'>) => Promise<void>;
  onDeleteBlok: (id: number) => Promise<void>;
  onSaveDisbunInti: (rows: HargaDisbunInti[]) => Promise<void>;
  onSaveDisbunPlasma: (row: HargaDisbunPlasma) => Promise<void>;
  onSaveMarketPrices: (bulanTahun: string, rows: HargaMarketHarian[]) => Promise<void>;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const MasterHargaView: React.FC<MasterHargaViewProps> = ({
  state,
  onSaveBlok,
  onDeleteBlok,
  onSaveDisbunInti,
  onSaveDisbunPlasma,
  onSaveMarketPrices,
  onUpdateSettings,
}) => {
  const [kategoriFilter, setKategoriFilter] = useState('ALL');
  const [blokSearch, setBlokSearch] = useState('');

  // Add/Edit Blok form
  const [kodeBlok, setKodeBlok] = useState('');
  const [namaKebun, setNamaKebun] = useState('PT.MJL');
  const [bulanTanam, setBulanTanam] = useState('Nov-09');
  const [keterangan, setKeterangan] = useState('Plasma');
  const [umurTahun, setUmurTahun] = useState('16');

  // Harga Disbun Inti & Plasma editable copies
  const [intiRows, setIntiRows] = useState<HargaDisbunInti[]>(state.harga_disbun_inti);
  const [plasmaRow, setPlasmaRow] = useState<HargaDisbunPlasma>(
    state.harga_disbun_plasma[0] || {
      id: 1,
      bulan_tahun: '2026-11',
      periode_1: 3484.85,
      periode_2: 3440.93,
      periode_3: 3287.46,
      periode_4: 3287.46,
    }
  );

  // Harga Market Harian 1..31
  const [marketStart, setMarketStart] = useState(state.settings.market_periode_mulai);
  const [marketEnd, setMarketEnd] = useState(state.settings.market_periode_selesai);
  const [marketDays, setMarketDays] = useState<HargaMarketHarian[]>(() => {
    const map = new Map(state.harga_market_harian.map((m) => [m.tanggal, m.harga]));
    return Array.from({ length: 31 }, (_, i) => ({
      bulan_tahun: '2026-11',
      tanggal: i + 1,
      harga: map.get(i + 1) ?? 2750,
    }));
  });

  const [savedFeedback, setSavedFeedback] = useState('');

  useEffect(() => {
    setIntiRows(state.harga_disbun_inti);
    if (state.harga_disbun_plasma[0]) setPlasmaRow(state.harga_disbun_plasma[0]);
    const map = new Map(state.harga_market_harian.map((m) => [m.tanggal, m.harga]));
    setMarketDays(
      Array.from({ length: 31 }, (_, i) => ({
        bulan_tahun: '2026-11',
        tanggal: i + 1,
        harga: map.get(i + 1) ?? 2750,
      }))
    );
  }, [state.harga_disbun_inti, state.harga_disbun_plasma, state.harga_market_harian]);

  const filteredBloks = useMemo(() => {
    return state.blok_master.filter((b) => {
      if (kategoriFilter !== 'ALL' && b.nama_kebun !== kategoriFilter) return false;
      if (blokSearch.trim()) {
        const q = blokSearch.trim().toLowerCase();
        return (
          b.kode_blok.toLowerCase().includes(q) ||
          b.bulan_tanam.toLowerCase().includes(q) ||
          b.keterangan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.blok_master, kategoriFilter, blokSearch]);

  const showToast = (msg: string) => {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(''), 2500);
  };

  const handleAddBlok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeBlok.trim()) return;
    await onSaveBlok({
      kode_blok: kodeBlok.trim().toUpperCase(),
      nama_kebun: namaKebun.trim(),
      bulan_tanam: bulanTanam.trim(),
      keterangan: keterangan.trim(),
      umur_tahun: Number(umurTahun) || 10,
    });
    setKodeBlok('');
    showToast('Data Blok disimpan.');
  };

  return (
    <div className="space-y-3 p-3 lg:p-4">
      {savedFeedback && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {savedFeedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* LEFT: DATA BLOK PT.MJL & PT.DSU */}
        <section className="xl:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <h2 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">DATA BLOK PT.MJL & PT.DSU</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">{filteredBloks.length} Blok</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter kategori kebun"
              value={kategoriFilter}
              onChange={(e) => setKategoriFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="ALL">Semua Kebun</option>
              <option value="PT.MJL">PT.MJL</option>
              <option value="PT.DSU">PT.DSU</option>
              <option value="PT.FSK KBN">PT.FSK KBN</option>
            </select>
            <input
              type="search"
              placeholder="Cari Kode Blok / Bulan Tanam..."
              value={blokSearch}
              onChange={(e) => setBlokSearch(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2.5 py-1 text-xs"
            />
          </div>

          {/* Add/Update Blok inline form */}
          <form onSubmit={handleAddBlok} className="grid grid-cols-5 gap-1.5 rounded bg-slate-50 p-2 border border-slate-200 text-xs">
            <input
              type="text"
              placeholder="Blok (G6)"
              value={kodeBlok}
              onChange={(e) => setKodeBlok(e.target.value.toUpperCase())}
              className="rounded border border-slate-300 bg-white px-1.5 py-1 font-mono-num uppercase"
            />
            <input
              type="text"
              placeholder="Kebun"
              value={namaKebun}
              onChange={(e) => setNamaKebun(e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-1"
            />
            <input
              type="text"
              placeholder="Bln Tnm"
              value={bulanTanam}
              onChange={(e) => setBulanTanam(e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-1 font-mono-num"
            />
            <input
              type="number"
              placeholder="Umur"
              value={umurTahun}
              onChange={(e) => setUmurTahun(e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-1 font-mono-num"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1 font-semibold text-white hover:bg-emerald-800"
            >
              <Plus className="h-3 w-3" />
              Save
            </button>
          </form>

          <div className="max-h-[460px] overflow-y-auto rounded border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Kode Blok</th>
                  <th className="px-2 py-1.5 font-semibold">Nama Kebun</th>
                  <th className="px-2 py-1.5 font-semibold">Bulan Tanam</th>
                  <th className="px-2 py-1.5 font-semibold">Keterangan</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Umur Thn</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBloks.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1 font-mono-num font-semibold">{b.kode_blok}</td>
                    <td className="px-2 py-1">{b.nama_kebun}</td>
                    <td className="px-2 py-1 font-mono-num">{b.bulan_tanam}</td>
                    <td className="px-2 py-1">{b.keterangan}</td>
                    <td className="px-2 py-1 text-right font-mono-num">{b.umur_tahun}</td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        aria-label={`Hapus blok ${b.kode_blok}`}
                        onClick={() => onDeleteBlok(b.id)}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CENTER: Harga Disbun (Prov. Kalbar) - Harga Inti & Harga Plasma */}
        <section className="xl:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Harga Disbun (Prov. Kalbar)</h2>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline">Harga Inti</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onSaveDisbunInti(intiRows);
                  showToast('Harga Disbun Inti disimpan.');
                }}
                className="inline-flex items-center gap-1 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Save className="h-3.5 w-3.5" />
                ADD / Save
              </button>
            </div>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-1.5 py-1.5 text-left">Umur (TBS/Th)</th>
                    <th className="px-1.5 py-1.5 text-right">
                      Periode 1<br />
                      <span className="font-normal text-[10px] text-amber-700">Tgl.01 - 07</span>
                    </th>
                    <th className="px-1.5 py-1.5 text-right">
                      Periode 2<br />
                      <span className="font-normal text-[10px] text-amber-700">Tgl.08 - 15</span>
                    </th>
                    <th className="px-1.5 py-1.5 text-right">
                      Periode 3<br />
                      <span className="font-normal text-[10px] text-amber-700">Tgl.16 - 22</span>
                    </th>
                    <th className="px-1.5 py-1.5 text-right">
                      Periode 4<br />
                      <span className="font-normal text-[10px] text-amber-700">Tgl.23 - S/D</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {intiRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="px-1.5 py-1 font-semibold text-slate-800 whitespace-nowrap">
                        {row.umur_label}
                      </td>
                      {(['periode_1', 'periode_2', 'periode_3', 'periode_4'] as const).map((field) => (
                        <td key={field} className="p-0.5">
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`Umur ${row.umur_label} ${field}`}
                            value={row[field]}
                            onChange={(e) => {
                              const next = [...intiRows];
                              next[idx] = { ...next[idx], [field]: Number(e.target.value) || 0 };
                              setIntiRows(next);
                            }}
                            className="w-full min-w-[62px] rounded border border-slate-200 px-1 py-0.5 text-right font-mono-num"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Harga Plasma */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 underline">Harga Plasma</h3>
              <button
                type="button"
                onClick={async () => {
                  await onSaveDisbunPlasma(plasmaRow);
                  showToast('Harga Disbun Plasma disimpan.');
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Save className="h-3 w-3" />
                ADD / Save
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ['periode_1', 'Periode 1'],
                  ['periode_2', 'Periode 2'],
                  ['periode_3', 'Periode 3'],
                  ['periode_4', 'Periode 4'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{label} :</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plasmaRow[field]}
                    onChange={(e) =>
                      setPlasmaRow({ ...plasmaRow, [field]: Number(e.target.value) || 0 })
                    }
                    className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right font-mono-num font-semibold"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT: Harga Market (PT.FSK SM) */}
        <section className="xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col gap-3 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Harga Market (PT.FSK SM)</h2>
            <p className="mt-1 text-xs font-semibold text-blue-800 dark:text-sky-300">* Periode Bulanan :</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <input
                type="date"
                value={marketStart}
                onChange={(e) => setMarketStart(e.target.value)}
                className="rounded border border-slate-300 px-1.5 py-1 font-mono-num"
              />
              <span>s/d</span>
              <input
                type="date"
                value={marketEnd}
                onChange={(e) => setMarketEnd(e.target.value)}
                className="rounded border border-slate-300 px-1.5 py-1 font-mono-num"
              />
              <button
                type="button"
                onClick={async () => {
                  await onUpdateSettings({
                    market_periode_mulai: marketStart,
                    market_periode_selesai: marketEnd,
                  });
                  showToast('Periode bulanan market disimpan.');
                }}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-800">$ Harga Harian (Tanggal 1 - 31)</h3>
              <button
                type="button"
                onClick={async () => {
                  await onSaveMarketPrices('2026-11', marketDays);
                  showToast('Harga Market Harian 1-31 disimpan.');
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
              {marketDays.map((m, idx) => (
                <label key={m.tanggal} className="flex items-center gap-1">
                  <span className="w-5 text-right font-mono-num text-rose-700 font-semibold">
                    {m.tanggal}
                  </span>
                  <input
                    type="number"
                    aria-label={`Harga tanggal ${m.tanggal}`}
                    value={m.harga}
                    onChange={(e) => {
                      const next = [...marketDays];
                      next[idx] = { ...next[idx], harga: Number(e.target.value) || 0 };
                      setMarketDays(next);
                    }}
                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right font-mono-num font-semibold"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
