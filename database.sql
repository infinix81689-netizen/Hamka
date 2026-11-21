-- ============================================================================
-- DATABASE.SQL
-- Aplikasi Perhitungan Pembelian & Pembayaran TBS Sawit
-- PT. Fajar Saudara Kusuma - Sebawi Mill
-- Kompatibel dengan SQLite (Offline/Online Engine) & Standar SQL
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'FINANCE', 'VIEWER')) DEFAULT 'OPERATOR',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT DEFAULT '',
  masa_berlaku_spk TEXT NOT NULL DEFAULT 's/d 31/12/26',
  subsidi_netto_rp REAL NOT NULL DEFAULT 0,
  subsidi_tenera_rp REAL NOT NULL DEFAULT 100,
  pph_type TEXT NOT NULL CHECK (pph_type IN ('PPH22', 'PPH4_2', 'NONE')) DEFAULT 'PPH22',
  insentif_rp REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('PLASMA', 'INTI')) DEFAULT 'PLASMA',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blok_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode_blok TEXT NOT NULL,
  nama_kebun TEXT NOT NULL,
  bulan_tanam TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT 'Plasma',
  umur_tahun INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kode_blok, nama_kebun)
);

CREATE TABLE IF NOT EXISTS harga_disbun_inti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umur_label TEXT NOT NULL UNIQUE,
  umur_min INTEGER NOT NULL,
  umur_max INTEGER NOT NULL,
  periode_1 REAL NOT NULL DEFAULT 0,
  periode_2 REAL NOT NULL DEFAULT 0,
  periode_3 REAL NOT NULL DEFAULT 0,
  periode_4 REAL NOT NULL DEFAULT 0,
  bulan_tahun TEXT NOT NULL DEFAULT '2026-11'
);

CREATE TABLE IF NOT EXISTS harga_disbun_plasma (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bulan_tahun TEXT NOT NULL UNIQUE,
  periode_1 REAL NOT NULL DEFAULT 0,
  periode_2 REAL NOT NULL DEFAULT 0,
  periode_3 REAL NOT NULL DEFAULT 0,
  periode_4 REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS harga_market_harian (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bulan_tahun TEXT NOT NULL,
  tanggal INTEGER NOT NULL CHECK (tanggal BETWEEN 1 AND 31),
  harga REAL NOT NULL DEFAULT 0,
  UNIQUE(bulan_tahun, tanggal)
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  tanggal TEXT NOT NULL,
  no_kendaraan TEXT NOT NULL,
  bruto_kg REAL NOT NULL DEFAULT 0,
  denda_kg REAL NOT NULL DEFAULT 0,
  persen_denda REAL NOT NULL DEFAULT 0,
  netto_kg REAL NOT NULL DEFAULT 0,
  grade REAL NOT NULL DEFAULT 0,
  harga_rp REAL NOT NULL DEFAULT 0,
  total_rp REAL NOT NULL DEFAULT 0,
  varietas_dxp TEXT NOT NULL DEFAULT 'DURA',
  quality_tier TEXT NOT NULL DEFAULT 'HQ',
  validated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS estate_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estate_id INTEGER NOT NULL,
  tanggal TEXT NOT NULL,
  no_polisi TEXT NOT NULL,
  bulan_th_tanam TEXT NOT NULL DEFAULT '',
  bruto_kg REAL NOT NULL DEFAULT 0,
  denda_kg REAL NOT NULL DEFAULT 0,
  netto_kg REAL NOT NULL DEFAULT 0,
  persen_denda REAL NOT NULL DEFAULT 0,
  umur INTEGER NOT NULL DEFAULT 10,
  harga_rp REAL NOT NULL DEFAULT 0,
  total_rp REAL NOT NULL DEFAULT 0,
  blok_details_json TEXT NOT NULL DEFAULT '[]',
  validated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (estate_id) REFERENCES estates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================================
-- SEED DATA: SUPPLIERS (31 Suppliers sesuai daftar operasional mill & laporan)
-- ============================================================================
INSERT OR IGNORE INTO suppliers (id, name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, insentif_rp) VALUES
  (1, 'PT. CHAKRA', 'SUP-01', 's/d 31/12/26', 0, 100, 'PPH22', 10),
  (2, 'PT.MEGAMBAS', 'SUP-02', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (3, 'CV.GUNUNG MAS', 'SUP-03', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (4, 'CV. ANEKA MAJU JAYA', 'SUP-04', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (5, 'CV.BAYA MARAGIT', 'SUP-05', 's/d 31/12/26', 100, 100, 'PPH22', 0),
  (6, 'CV SJA', 'SUP-06', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (7, 'CV.CLARA S', 'SUP-07', 's/d 31/12/26', 10, 100, 'PPH22', 0),
  (8, 'AGIMAN', 'SUP-08', 's/d 31/12/26', 100, 100, 'PPH4_2', 0),
  (9, 'TJONG LIE KO', 'SUP-09', 's/d 31/12/26', 50, 100, 'PPH22', 0),
  (10, 'Hiu Thiam Djie', 'SUP-10', 's/d 31/12/26', 10, 100, 'PPH22', 0),
  (11, 'Lie Cen Jung', 'SUP-11', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (12, 'Kop SBT', 'SUP-12', 's/d 31/12/26', 10, 100, 'PPH22', 0),
  (13, 'Tan Darsono', 'SUP-13', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (14, 'Ng Sian Jung', 'SUP-14', 's/d 31/12/26', 15, 100, 'PPH22', 4),
  (15, 'Thong Fu Tjiung', 'SUP-15', 's/d 31/12/26', 25, 100, 'PPH22', 0),
  (16, 'Tjhai Elvira L', 'SUP-16', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (17, 'Eric H', 'SUP-17', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (18, 'Hendra Gunawan', 'SUP-18', 's/d 31/12/26', 15, 100, 'PPH4_2', 0),
  (19, 'HO Gunawan', 'SUP-19', 's/d 31/12/26', 15, 100, 'PPH4_2', 0),
  (20, 'PDN', 'SUP-20', 's/d 31/12/26', 10, 100, 'PPH22', 0),
  (21, 'HERRY JANTO', 'SUP-21', 's/d 31/12/26', 0, 100, 'PPH4_2', 0),
  (22, 'Tjhang Rudianto', 'SUP-22', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (23, 'PT.RSL', 'SUP-23', 's/d 15/04/27', 50, 100, 'PPH22', 0),
  (24, 'CV.AMT', 'SUP-24', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (25, 'PSS', 'SUP-25', 's/d 31/12/26', 25, 100, 'PPH22', 0),
  (26, 'PT.BEM', 'SUP-26', 's/d 31/12/26', 20, 100, 'PPH22', 0),
  (27, 'PSA', 'SUP-27', 's/d 31/12/26', 25, 100, 'PPH22', 0),
  (28, 'PT.Alao Kuning', 'SUP-28', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (29, 'Mardhani Sampe', 'SUP-29', 's/d 31/12/26', 0, 100, 'PPH22', 0),
  (30, 'PT.BGN', 'SUP-30', 's/d 31/12/26', 150, 100, 'PPH22', 0),
  (31, 'PT.HPA', 'SUP-31', 's/d 31/12/26', 0, 100, 'PPH22', 0);

-- ============================================================================
-- SEED DATA: ESTATES (5 Kebun)
-- ============================================================================
INSERT OR IGNORE INTO estates (id, name, type) VALUES
  (1, 'PT.MJL PLASMA', 'PLASMA'),
  (2, 'PT.MJL INTI', 'INTI'),
  (3, 'PT.FSK KBN', 'INTI'),
  (4, 'PT.DSU', 'PLASMA'),
  (5, 'NI SONG', 'PLASMA');

-- ============================================================================
-- SEED DATA: BLOK MASTER (PT.MJL & PT.DSU)
-- ============================================================================
INSERT OR IGNORE INTO blok_master (id, kode_blok, nama_kebun, bulan_tanam, keterangan, umur_tahun) VALUES
  (1, 'C10', 'PT.MJL', 'Feb-09', 'Plasma', 17),
  (2, 'C9', 'PT.MJL', 'Feb-09', 'Plasma', 17),
  (3, 'C7', 'PT.MJL', 'Mar-09', 'Plasma', 17),
  (4, 'C8', 'PT.MJL', 'Mar-09', 'Plasma', 17),
  (5, 'D11', 'PT.MJL', 'Mar-09', 'Plasma', 17),
  (6, 'D10', 'PT.MJL', 'Mar-09', 'Plasma', 17),
  (7, 'D9', 'PT.MJL', 'May-09', 'Plasma', 17),
  (8, 'E10', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (9, 'E11', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (10, 'E9', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (11, 'F10', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (12, 'F11', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (13, 'F9', 'PT.MJL', 'Jul-09', 'Plasma', 17),
  (14, 'F7', 'PT.MJL', 'Aug-09', 'Plasma', 17),
  (15, 'F8', 'PT.MJL', 'Aug-09', 'Plasma', 17),
  (16, 'D8', 'PT.MJL', 'Sep-09', 'Plasma', 17),
  (17, 'E8', 'PT.MJL', 'Sep-09', 'Plasma', 17),
  (18, 'F5', 'PT.MJL', 'Sep-09', 'Plasma', 17),
  (19, 'F6', 'PT.MJL', 'Sep-09', 'Plasma', 17),
  (20, 'F1', 'PT.MJL', 'Oct-09', 'Plasma', 17),
  (21, 'F2', 'PT.MJL', 'Oct-09', 'Plasma', 17),
  (22, 'F4', 'PT.MJL', 'Oct-09', 'Plasma', 17),
  (23, 'H3', 'PT.MJL', 'Oct-09', 'Plasma', 17),
  (24, 'C5', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (25, 'E6', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (26, 'E7', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (27, 'G3', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (28, 'H2', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (29, 'H4', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (30, 'I4', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (31, 'I5', 'PT.MJL', 'Nov-09', 'Plasma', 9),
  (32, 'I6', 'PT.MJL', 'Nov-09', 'Plasma', 9),
  (33, 'I7', 'PT.MJL', 'Nov-09', 'Plasma', 16),
  (34, 'C6', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (35, 'D5', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (36, 'D6', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (37, 'D7', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (38, 'E5', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (39, 'F3', 'PT.MJL', 'Dec-09', 'Plasma', 16),
  (40, 'H5', 'PT.MJL', 'Dec-09', 'Plasma', 9),
  (41, 'H6', 'PT.MJL', 'Dec-09', 'Plasma', 9),
  (42, 'G5', 'PT.MJL', 'Aug-10', 'Plasma', 10),
  (43, 'G6', 'PT.MJL', 'Sep-10', 'Plasma', 10),
  (44, 'G10', 'PT.MJL', 'Sep-10', 'Plasma', 10),
  (45, 'A1', 'PT.DSU', 'Jan-12', 'Plasma', 14),
  (46, 'A2', 'PT.DSU', 'Mar-12', 'Plasma', 14),
  (47, 'B1', 'PT.FSK KBN', 'May-14', 'Inti', 12);

-- ============================================================================
-- SEED DATA: HARGA DISBUN (PROV. KALBAR) - INTI & PLASMA
-- ============================================================================
INSERT OR IGNORE INTO harga_disbun_inti (id, umur_label, umur_min, umur_max, periode_1, periode_2, periode_3, periode_4, bulan_tahun) VALUES
  (1, '3', 3, 3, 2617.07, 2584.19, 2469.09, 2469.09, '2026-11'),
  (2, '4', 4, 4, 2811.44, 2775.94, 2652.03, 2652.03, '2026-11'),
  (3, '5', 5, 5, 3017.52, 2979.32, 2846.18, 2846.18, '2026-11'),
  (4, '6', 6, 6, 3145.50, 3105.72, 2966.99, 2966.99, '2026-11'),
  (5, '7', 7, 7, 3258.01, 3216.82, 3073.16, 3073.16, '2026-11'),
  (6, '8', 8, 8, 3349.43, 3307.17, 3159.59, 3159.59, '2026-11'),
  (7, '9', 9, 9, 3412.47, 3369.42, 3219.06, 3219.06, '2026-11'),
  (8, '10 - 20', 10, 20, 3484.85, 3440.93, 3287.46, 3287.46, '2026-11'),
  (9, '21', 21, 21, 3420.00, 3380.00, 3230.00, 3230.00, '2026-11'),
  (10, '22', 22, 22, 3380.00, 3340.00, 3190.00, 3190.00, '2026-11'),
  (11, '23', 23, 23, 3340.00, 3300.00, 3150.00, 3150.00, '2026-11'),
  (12, '24', 24, 24, 3300.00, 3260.00, 3110.00, 3110.00, '2026-11'),
  (13, '25', 25, 25, 3260.00, 3220.00, 3070.00, 3070.00, '2026-11');

INSERT OR IGNORE INTO harga_disbun_plasma (id, bulan_tahun, periode_1, periode_2, periode_3, periode_4) VALUES
  (1, '2026-11', 3484.85, 3440.93, 3287.46, 3287.46);

-- ============================================================================
-- SEED DATA: HARGA MARKET HARIAN (PT.FSK SM - November 2026)
-- ============================================================================
INSERT OR IGNORE INTO harga_market_harian (bulan_tahun, tanggal, harga) VALUES
  ('2026-11', 1, 2850), ('2026-11', 2, 2850), ('2026-11', 3, 2900), ('2026-11', 4, 2900),
  ('2026-11', 5, 2900), ('2026-11', 6, 2850), ('2026-11', 7, 2850), ('2026-11', 8, 2850),
  ('2026-11', 9, 2850), ('2026-11', 10, 2850), ('2026-11', 11, 2750), ('2026-11', 12, 2750),
  ('2026-11', 13, 2750), ('2026-11', 14, 2750), ('2026-11', 15, 2750), ('2026-11', 16, 2750),
  ('2026-11', 17, 2750), ('2026-11', 18, 2750), ('2026-11', 19, 2750), ('2026-11', 20, 2750),
  ('2026-11', 21, 2750), ('2026-11', 22, 2750), ('2026-11', 23, 2750), ('2026-11', 24, 2750),
  ('2026-11', 25, 2750), ('2026-11', 26, 2750), ('2026-11', 27, 2750), ('2026-11', 28, 2750),
  ('2026-11', 29, 2750), ('2026-11', 30, 2750), ('2026-11', 31, 2750);

-- ============================================================================
-- SEED DATA: SUPPLIER TRANSACTIONS (CV.BAYA MARAGIT + Suppliers Lain)
-- ============================================================================
INSERT OR IGNORE INTO supplier_transactions (id, supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda, netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated) VALUES
  (166, 5, '2026-11-18', 'KB8536PF', 2230, 50, 2.24, 2180, 12.05, 2750, 5995000, 'DURA', 'HQ', 0),
  (167, 5, '2026-11-18', 'KB8709PG', 2330, 60, 2.58, 2270, 13.00, 2750, 6242500, 'DURA', 'HQ', 0),
  (168, 5, '2026-11-18', 'KB8313PB', 7820, 200, 2.56, 7620, 14.00, 2750, 20955000, 'DURA', 'HQ', 0),
  (169, 5, '2026-11-18', 'KB8710YM', 8190, 300, 3.66, 7890, 14.00, 2750, 21697500, 'DURA', 'HQ', 0),
  (170, 5, '2026-11-18', 'KB8269PE', 6590, 160, 2.43, 6430, 14.00, 2750, 17682500, 'DURA', 'HQ', 0),
  (171, 5, '2026-11-18', 'KB8385PE', 6820, 140, 2.05, 6680, 12.04, 2750, 18370000, 'DURA', 'HQ', 0),
  (172, 5, '2026-11-18', 'KB9863AC', 3570, 130, 3.64, 3440, 12.07, 2750, 9460000, 'DURA', 'HQ', 0),
  (173, 5, '2026-11-18', 'KB1819XX', 2340, 70, 2.99, 2270, 12.06, 2750, 6242500, 'DURA', 'HQ', 0),
  (174, 5, '2026-11-18', 'KB8361BA', 2720, 70, 2.57, 2650, 13.00, 2750, 7287500, 'DURA', 'HQ', 0),
  (175, 5, '2026-11-19', 'KB8385PE', 5900, 140, 2.37, 5760, 12.03, 2750, 15840000, 'DURA', 'HQ', 0),
  (176, 5, '2026-11-19', 'KB8443PF', 3060, 90, 2.94, 2970, 13.00, 2750, 8167500, 'DURA', 'HQ', 0),
  (177, 5, '2026-11-19', 'KB8408CG', 7740, 300, 3.88, 7440, 13.00, 2750, 20460000, 'DURA', 'HQ', 0),
  (178, 5, '2026-11-19', 'KB8314PH', 2280, 60, 2.63, 2220, 12.03, 2750, 6105000, 'DURA', 'HQ', 0),
  (179, 5, '2026-11-19', 'B9383FDD', 2600, 80, 3.08, 2520, 14.00, 2750, 6930000, 'DURA', 'HQ', 0),
  (180, 5, '2026-11-19', 'KB8536PF', 2220, 80, 3.60, 2140, 13.00, 2750, 5885000, 'DURA', 'HQ', 0),
  (181, 5, '2026-11-19', 'KB8437PE', 6000, 140, 2.33, 5860, 12.03, 2750, 16115000, 'DURA', 'HQ', 0),
  (182, 5, '2026-11-19', 'KB8417PH', 2180, 70, 3.21, 2110, 12.03, 2750, 5802500, 'DURA', 'HQ', 0),
  (183, 5, '2026-11-19', 'KB1427YX', 2400, 80, 3.33, 2320, 12.04, 2750, 6380000, 'DURA', 'HQ', 0),
  (184, 5, '2026-11-19', 'KB1819XX', 2380, 60, 2.52, 2320, 12.08, 2750, 6380000, 'DURA', 'HQ', 0),
  (185, 5, '2026-11-20', 'B9383FDD', 3780, 130, 3.44, 3650, 14.00, 2750, 10037500, 'DURA', 'HQ', 0),
  (186, 5, '2026-11-20', 'KB1427YX', 1300, 40, 3.08, 1260, 12.07, 2750, 3465000, 'DURA', 'HQ', 0),
  (187, 5, '2026-11-20', 'KB8993YM', 6300, 250, 3.97, 6050, 12.68, 2750, 16637500, 'DURA', 'HQ', 0),
  (188, 5, '2026-11-20', 'KB8646PZ', 5000, 130, 2.60, 4870, 13.00, 2750, 13392500, 'DURA', 'HQ', 0),
  (189, 5, '2026-11-20', 'KB8710YM', 7550, 340, 4.50, 7210, 14.00, 2750, 19827500, 'DURA', 'HQ', 0),
  (190, 5, '2026-11-20', 'KB8067YM', 7970, 310, 3.89, 7660, 14.00, 2750, 21065000, 'DURA', 'HQ', 0),
  (191, 5, '2026-11-20', 'KB8970KL', 4350, 140, 3.22, 4210, 12.07, 2750, 11577500, 'DURA', 'HQ', 0),
  (192, 5, '2026-11-20', 'KB8548CH', 2350, 60, 2.55, 2290, 12.25, 2750, 6297500, 'DURA', 'HQ', 0),
  (193, 1, '2026-11-20', 'KB8112AA', 6420, 180, 2.80, 6240, 13.50, 2750, 17160000, 'TENERA', 'HQ', 1),
  (194, 2, '2026-11-20', 'KB8445BB', 5180, 120, 2.32, 5060, 12.80, 2750, 13915000, 'DURA', 'HQ', 1),
  (195, 2, '2026-11-20', 'KB8154PC', 6280, 190, 3.03, 6090, 13.10, 2750, 16747500, 'TENERA', 'HQ', 1),
  (196, 3, '2026-11-21', 'KB8771CC', 4890, 150, 3.07, 4740, 13.20, 2750, 13035000, 'TENERA', 'HQ', 0),
  (197, 23, '2026-11-20', 'KB8286SF', 7170, 270, 3.77, 6900, 13.00, 2750, 18975000, 'TENERA', 'HQ', 1),
  (198, 18, '2026-11-20', 'B9098SS', 5000, 130, 2.60, 4870, 13.00, 2750, 13392500, 'DURA', 'HQ', 1);

-- ============================================================================
-- SEED DATA: ESTATE TRANSACTIONS (PT.MJL PLASMA & Kebun Lain)
-- ============================================================================
INSERT OR IGNORE INTO estate_transactions (id, estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg, netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated) VALUES
  (1, 1, '2026-11-02', 'KB9826BD', 'Aug-09, Sep-09', 1865, 45, 1820, 2.41, 10, 3484.85, 6342427, '[]', 1),
  (2, 1, '2026-11-02', 'KB9826BD-B', 'Nov-10, Dec-10', 6125, 135, 5990, 2.20, 10, 3484.85, 20874251.5, '[]', 1),
  (3, 1, '2026-11-02', 'K8051IS', 'Oct-09, Nov-09, Dec-09', 4591, 147, 4444, 3.20, 10, 3484.85, 15486673.4, '[]', 1),
  (4, 1, '2026-11-02', 'KB8974GA', 'Mar-09, Aug-09, Sep-09, Dec-09', 6880, 270, 6610, 3.92, 10, 3484.85, 23034858.5, '[]', 1),
  (5, 1, '2026-11-02', 'KB8032PB', 'Sep-10, Nov-10, Dec-10', 7740, 220, 7520, 2.84, 10, 3484.85, 26206072, '[]', 1),
  (6, 1, '2026-11-02', 'KB8982HB', 'Sep-09, Nov-09, Dec-09', 6860, 180, 6680, 2.62, 10, 3484.85, 23278798, '[]', 1),
  (7, 1, '2026-11-02', 'KB8773AT', 'Feb-09, Mar-09, Jul-09, Sep-09', 6770, 250, 6520, 3.69, 10, 3484.85, 22721222, '[]', 1),
  (8, 1, '2026-11-03', 'KB8481WD', 'Dec-09', 926, 23, 903, 2.48, 10, 3484.85, 3146819.55, '[]', 1),
  (9, 1, '2026-11-03', 'KB8051IS', 'Oct-09, Dec-09', 5008, 178, 4830, 3.55, 10, 3484.85, 16831825.5, '[]', 1),
  (10, 1, '2026-11-03', 'KB8974GA', 'Oct-09, Nov-09, Dec-09', 7410, 280, 7130, 3.78, 10, 3484.85, 24846980.5, '[]', 1),
  (11, 1, '2026-11-03', 'R9059OD', 'Feb-09, Mar-09, Jul-09', 7810, 290, 7520, 3.71, 10, 3484.85, 26206072, '[]', 1),
  (12, 1, '2026-11-03', 'KB8982HB', 'Sep-09, Nov-09, Dec-09', 6657, 237, 6420, 3.56, 10, 3484.85, 22372737, '[]', 1),
  (13, 1, '2026-11-03', 'KB9826BD', 'Feb-09, Mar-09, May-09, Jul-09', 7690, 250, 7440, 3.25, 10, 3484.85, 25927284, '[]', 1),
  (14, 1, '2026-11-03', 'KB8773AT', 'Jul-09, Aug-09, Sep-09', 6420, 220, 6200, 3.43, 10, 3484.85, 21606070, '[]', 1),
  (15, 1, '2026-11-04', 'K8051IS', 'Jul-09, Aug-09', 6660, 160, 6500, 2.40, 10, 3484.85, 22651525, '[]', 1),
  (16, 1, '2026-11-04', 'KB8032PB', 'Jul-09, Nov-09, Dec-09', 6955, 283, 6672, 4.07, 10, 3484.85, 23250919.2, '[]', 1),
  (17, 1, '2026-11-04', 'KB8974GA', 'Aug-09, Oct-09, Nov-09', 7260, 310, 6950, 4.27, 10, 3484.85, 24219707.5, '[]', 1),
  (18, 1, '2026-11-04', 'KB8982HB', 'Feb-09, May-09, Jul-09', 7330, 180, 7150, 2.46, 10, 3484.85, 24916677.5, '[]', 1),
  (19, 1, '2026-11-04', 'KB9826BD', 'Oct-09, Nov-09, Dec-09', 7600, 220, 7380, 2.89, 10, 3484.85, 25718193, '[]', 1),
  (20, 2, '2026-11-20', 'KB8277HD', 'Apr-15', 2548, 91, 2457, 3.57, 11, 3287.46, 8076159, '[]', 1),
  (21, 2, '2026-11-20', 'KB8277HD', 'Apr-18', 1937, 69, 1868, 3.56, 8, 3159.59, 5902880, '[]', 1),
  (22, 2, '2026-11-20', 'KB8277HD', 'Jan-19', 113, 4, 109, 3.54, 7, 3073.16, 334957, '[]', 1),
  (23, 2, '2026-11-20', 'KB8277HD', 'Sep-20', 760, 28, 732, 3.68, 6, 2966.99, 2171844, '[]', 1),
  (24, 2, '2026-11-20', 'KB8277HD', 'Dec-20, Jan-21', 3232, 118, 3114, 3.65, 5, 2846.18, 8862444, '[]', 1),
  (25, 1, '2026-11-20', 'K8051IS', 'Dec-09', 4485, 90, 4395, 2.00, 10, 3287.46, 14446365, '[]', 1),
  (26, 1, '2026-11-20', 'K8051IS', 'Aug-10, Sep-10, Dec-10', 3395, 68, 3327, 2.00, 10, 3287.46, 10935849, '[]', 1),
  (27, 1, '2026-11-20', 'KB8773AT', 'Nov-09, Dec-09', 3580, 72, 3508, 2.00, 10, 3287.46, 11530796, '[]', 1),
  (28, 1, '2026-11-20', 'KB8773AT', 'Aug-10, Sep-10', 3200, 64, 3136, 2.00, 10, 3287.46, 10308032, '[]', 1),
  (29, 3, '2026-11-20', 'KB9001FS', 'May-14', 5420, 120, 5300, 2.21, 12, 3287.46, 17423538, '[]', 0);

-- ============================================================================
-- SEED DATA: APP SETTINGS
-- ============================================================================
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('company_name', 'PT. Fajar Saudara Kusuma'),
  ('company_subtitle', 'Sebawi Mill'),
  ('company_logo', ''),
  ('report_city', 'Sebawi'),
  ('theme_preset', 'navy-emerald'),
  ('dark_mode', 'false'),
  ('max_grad_pct', '5'),
  ('harga_hq', '2750'),
  ('harga_mq', '2650'),
  ('harga_a', '2550'),
  ('harga_b', '2450'),
  ('pph22_rate', '0.0025'),
  ('pph4_rate', '0.005'),
  ('cek_harga_saat_edit', 'true'),
  ('periode_mulai', '2026-11-16'),
  ('periode_selesai', '2026-11-22'),
  ('market_periode_mulai', '2026-11-01'),
  ('market_periode_selesai', '2026-11-30'),
  ('show_gridlines', 'true'),
  ('show_headings', 'true'),
  ('show_formulabar', 'true'),
  ('ttd_disetujui_name', 'Ni Song'),
  ('ttd_disetujui_title', 'Deputi FFB Purchase Dept. Head'),
  ('ttd_diperiksa_name', 'Fadly Fadland'),
  ('ttd_diperiksa_title', 'Fin & Acct Sub Dept. Head'),
  ('ttd_disiapkan_name', 'Hamka'),
  ('ttd_disiapkan_title', 'Finance Div. Head (POM)'),
  ('footer_running_text', 'Aplikasi Perhitungan Pembelian & Pembayaran TBS Sawit PT. Fajar Saudara Kusuma - Sebawi Mill (Sebawi Mill). Utamakan Keselamatan Kerja.'),
  ('sidebar_bg_image', '/src/assets/images/sidebar_palm_bg_1795236071731.jpg'),
  ('sidebar_bg_zoom', 'true');
