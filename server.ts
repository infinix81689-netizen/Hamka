import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { createServer as createViteServer } from 'vite';
import type {
  AppDatabaseState,
  AppSettings,
  BlokMaster,
  Estate,
  EstateTransaction,
  HargaDisbunInti,
  HargaDisbunPlasma,
  HargaMarketHarian,
  PphType,
  Supplier,
  SupplierTransaction,
  ThemePreset,
  UserAccount,
  UserRole,
} from './src/types/tbs';
import {
  DEFAULT_FOOTER_RUNNING_TEXT,
  DEFAULT_SIDEBAR_BG_IMAGE,
  generateSqlDumpFromState,
  isValidLogoUrl,
} from './src/utils/tbsCalculations';

const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'fsk_sebawi.sqlite');
const SCHEMA_SQL_FILE = path.join(ROOT_DIR, 'database.sql');

let SQL: SqlJsStatic;
let db: Database;

interface SessionEntry {
  user: UserAccount;
  expiresAt: number;
}

const sessionStore = new Map<string, SessionEntry>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface AuthenticatedRequest extends Request {
  authUser?: UserAccount;
  authToken?: string;
}

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function createSessionToken(user: UserAccount): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessionStore.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sesi login diperlukan. Silakan login terlebih dahulu.' });
  }
  const entry = sessionStore.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) sessionStore.delete(token);
    return res.status(401).json({ error: 'Sesi login telah berakhir. Silakan login kembali.' });
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  req.authUser = entry.user;
  req.authToken = token;
  return next();
}

function requireRole(allowed: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.authUser?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({
        error: `Akses ditolak. Fitur ini membutuhkan hak akses: ${allowed.join(', ')}.`,
      });
    }
    return next();
  };
}

function persistDbToDisk() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params as (string | number | Uint8Array | null)[]);
  }
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function runStmt(sql: string, params: unknown[] = []): { lastId: number; changes: number } {
  db.run(sql, params as (string | number | Uint8Array | null)[]);
  const res = queryAll<{ id: number }>('SELECT last_insert_rowid() AS id');
  const changes = db.getRowsModified();
  persistDbToDisk();
  return { lastId: res[0]?.id ?? 0, changes };
}

function ensureColumnExists(tableName: string, colName: string, alterSql: string) {
  const cols = queryAll<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (!cols.some((c) => c.name === colName)) {
    db.run(alterSql);
  }
}

function runSchemaMigrations() {
  db.run(`
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
    )
  `);

  ensureColumnExists('suppliers', 'masa_berlaku_spk', "ALTER TABLE suppliers ADD COLUMN masa_berlaku_spk TEXT NOT NULL DEFAULT 's/d 31/12/26'");
  ensureColumnExists('suppliers', 'subsidi_netto_rp', 'ALTER TABLE suppliers ADD COLUMN subsidi_netto_rp REAL NOT NULL DEFAULT 0');
  ensureColumnExists('suppliers', 'subsidi_tenera_rp', 'ALTER TABLE suppliers ADD COLUMN subsidi_tenera_rp REAL NOT NULL DEFAULT 100');
  ensureColumnExists('suppliers', 'pph_type', "ALTER TABLE suppliers ADD COLUMN pph_type TEXT NOT NULL DEFAULT 'PPH22'");
  ensureColumnExists('suppliers', 'insentif_rp', 'ALTER TABLE suppliers ADD COLUMN insentif_rp REAL NOT NULL DEFAULT 0');

  // Backfill known supplier SPK/subsidi defaults if still 0
  const knownSupplierRates: Array<[string, string, number, number, PphType, number]> = [
    ['PT. CHAKRA', 's/d 31/12/26', 0, 100, 'PPH22', 10],
    ['PT.MEGAMBAS', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['CV.GUNUNG MAS', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['CV.BAYA MARAGIT', 's/d 31/12/26', 100, 100, 'PPH22', 0],
    ['CV SJA', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['CV.CLARA S', 's/d 31/12/26', 10, 100, 'PPH22', 0],
    ['AGIMAN', 's/d 31/12/26', 100, 100, 'PPH4_2', 0],
    ['TJONG LIE KO', 's/d 31/12/26', 50, 100, 'PPH22', 0],
    ['Hiu Thiam Djie', 's/d 31/12/26', 10, 100, 'PPH22', 0],
    ['Kop SBT', 's/d 31/12/26', 10, 100, 'PPH22', 0],
    ['Tan Darsono', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['Ng Sian Jung', 's/d 31/12/26', 15, 100, 'PPH22', 4],
    ['Thong Fu Tjiung', 's/d 31/12/26', 25, 100, 'PPH22', 0],
    ['Hendra Gunawan', 's/d 31/12/26', 15, 100, 'PPH4_2', 0],
    ['HO Gunawan', 's/d 31/12/26', 15, 100, 'PPH4_2', 0],
    ['PDN', 's/d 31/12/26', 10, 100, 'PPH22', 0],
    ['HERRY JANTO', 's/d 31/12/26', 0, 100, 'PPH4_2', 0],
    ['PT.RSL', 's/d 15/04/27', 50, 100, 'PPH22', 0],
    ['CV.AMT', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['PSS', 's/d 31/12/26', 25, 100, 'PPH22', 0],
    ['PT.BEM', 's/d 31/12/26', 20, 100, 'PPH22', 0],
    ['PSA', 's/d 31/12/26', 25, 100, 'PPH22', 0],
    ['PT.BGN', 's/d 31/12/26', 150, 100, 'PPH22', 0],
  ];
  for (const [name, spk, subNet, subTen, pph, ins] of knownSupplierRates) {
    db.run(
      `UPDATE suppliers SET masa_berlaku_spk = ?, subsidi_netto_rp = CASE WHEN subsidi_netto_rp = 0 THEN ? ELSE subsidi_netto_rp END, subsidi_tenera_rp = ?, pph_type = ?, insentif_rp = CASE WHEN insentif_rp = 0 THEN ? ELSE insentif_rp END WHERE UPPER(name) = UPPER(?)`,
      [spk, subNet, subTen, pph, ins, name]
    );
  }

  db.run("DELETE FROM app_settings WHERE key IN ('ttd_mengetahui_name', 'ttd_mengetahui_title')");

  const settingDefaults: Array<[string, string]> = [
    ['company_name', 'PT. Fajar Saudara Kusuma'],
    ['company_subtitle', 'Sebawi Mill'],
    ['company_logo', ''],
    ['report_city', 'Sebawi'],
    ['theme_preset', 'navy-emerald'],
    ['dark_mode', 'false'],
    ['pph22_rate', '0.0025'],
    ['pph4_rate', '0.005'],
    ['ttd_disetujui_name', 'Ni Song'],
    ['ttd_disetujui_title', 'Deputi FFB Purchase Dept. Head'],
    ['ttd_diperiksa_name', 'Fadly Fadland'],
    ['ttd_diperiksa_title', 'Fin & Acct Sub Dept. Head'],
    ['ttd_disiapkan_name', 'Hamka'],
    ['ttd_disiapkan_title', 'Finance Div. Head (POM)'],
    ['footer_running_text', DEFAULT_FOOTER_RUNNING_TEXT],
    ['sidebar_bg_image', DEFAULT_SIDEBAR_BG_IMAGE],
    ['sidebar_bg_zoom', 'true'],
  ];
  for (const [k, v] of settingDefaults) {
    db.run('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)', [k, v]);
  }
  persistDbToDisk();
}

function buildSettings(rows: Array<{ key: string; value: string }>): AppSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const rawTheme = map.get('theme_preset') || 'navy-emerald';
  const validThemes: ThemePreset[] = ['navy-emerald', 'forest-gold', 'slate-indigo', 'crimson-charcoal'];
  const theme_preset = validThemes.includes(rawTheme as ThemePreset)
    ? (rawTheme as ThemePreset)
    : 'navy-emerald';

  return {
    company_name: map.get('company_name') || 'PT. Fajar Saudara Kusuma',
    company_subtitle: map.get('company_subtitle') || 'Sebawi Mill',
    company_logo: map.get('company_logo') || '',
    report_city: map.get('report_city') || 'Sebawi',
    theme_preset,
    dark_mode: map.get('dark_mode') === 'true',
    max_grad_pct: Number(map.get('max_grad_pct') ?? 5),
    harga_hq: Number(map.get('harga_hq') ?? 2750),
    harga_mq: Number(map.get('harga_mq') ?? 2650),
    harga_a: Number(map.get('harga_a') ?? 2550),
    harga_b: Number(map.get('harga_b') ?? 2450),
    pph22_rate: Number(map.get('pph22_rate') ?? 0.0025),
    pph4_rate: Number(map.get('pph4_rate') ?? 0.005),
    cek_harga_saat_edit: map.get('cek_harga_saat_edit') !== 'false',
    periode_mulai: map.get('periode_mulai') || '2026-11-16',
    periode_selesai: map.get('periode_selesai') || '2026-11-22',
    market_periode_mulai: map.get('market_periode_mulai') || '2026-11-01',
    market_periode_selesai: map.get('market_periode_selesai') || '2026-11-30',
    show_gridlines: map.get('show_gridlines') !== 'false',
    show_headings: map.get('show_headings') !== 'false',
    show_formulabar: map.get('show_formulabar') !== 'false',
    ttd_disetujui_name: map.get('ttd_disetujui_name') || 'Ni Song',
    ttd_disetujui_title: map.get('ttd_disetujui_title') || 'Deputi FFB Purchase Dept. Head',
    ttd_diperiksa_name: map.get('ttd_diperiksa_name') || 'Fadly Fadland',
    ttd_diperiksa_title: map.get('ttd_diperiksa_title') || 'Fin & Acct Sub Dept. Head',
    ttd_disiapkan_name: map.get('ttd_disiapkan_name') || 'Hamka',
    ttd_disiapkan_title: map.get('ttd_disiapkan_title') || 'Finance Div. Head (POM)',
    footer_running_text: map.get('footer_running_text') ?? DEFAULT_FOOTER_RUNNING_TEXT,
    sidebar_bg_image: map.get('sidebar_bg_image') ?? DEFAULT_SIDEBAR_BG_IMAGE,
    sidebar_bg_zoom: map.get('sidebar_bg_zoom') !== 'false',
  };
}

function getFullState(): AppDatabaseState {
  const suppliers = queryAll<Supplier>('SELECT * FROM suppliers ORDER BY id ASC');
  const estates = queryAll<Estate>('SELECT * FROM estates ORDER BY id ASC');
  const blok_master = queryAll<BlokMaster>('SELECT * FROM blok_master ORDER BY nama_kebun ASC, kode_blok ASC');
  const harga_disbun_inti = queryAll<HargaDisbunInti>('SELECT * FROM harga_disbun_inti ORDER BY umur_min ASC');
  const harga_disbun_plasma = queryAll<HargaDisbunPlasma>('SELECT * FROM harga_disbun_plasma ORDER BY bulan_tahun DESC');
  const harga_market_harian = queryAll<HargaMarketHarian>('SELECT * FROM harga_market_harian ORDER BY bulan_tahun DESC, tanggal ASC');
  const supplier_transactions = queryAll<SupplierTransaction>(
    'SELECT * FROM supplier_transactions ORDER BY tanggal DESC, id DESC'
  );
  const estate_transactions = queryAll<EstateTransaction>(
    'SELECT * FROM estate_transactions ORDER BY tanggal DESC, id DESC'
  );
  const settingsRows = queryAll<{ key: string; value: string }>('SELECT key, value FROM app_settings');

  return {
    suppliers,
    estates,
    blok_master,
    harga_disbun_inti,
    harga_disbun_plasma,
    harga_market_harian,
    supplier_transactions,
    estate_transactions,
    settings: buildSettings(settingsRows),
  };
}

async function initDatabase() {
  SQL = await initSqlJs({
    locateFile: (file) => path.join(ROOT_DIR, 'node_modules/sql.js/dist', file),
    useOldExtensionFunctions: false,
  });

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    const tables = queryAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length === 0 && fs.existsSync(SCHEMA_SQL_FILE)) {
      db.exec(fs.readFileSync(SCHEMA_SQL_FILE, 'utf8'));
    }
    runSchemaMigrations();
  } else {
    db = new SQL.Database();
    if (fs.existsSync(SCHEMA_SQL_FILE)) {
      db.exec(fs.readFileSync(SCHEMA_SQL_FILE, 'utf8'));
    }
    runSchemaMigrations();
  }
}

async function startServer() {
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: 'sqlite-sqljs', timestamp: new Date().toISOString() });
  });

  // Public non-sensitive branding for PageLoading & Login screen
  app.get('/api/public-branding', (_req, res) => {
    try {
      const settingsRows = queryAll<{ key: string; value: string }>('SELECT key, value FROM app_settings');
      const s = buildSettings(settingsRows);
      res.json({
        company_name: s.company_name,
        company_subtitle: s.company_subtitle,
        company_logo: s.company_logo,
        theme_preset: s.theme_preset,
        dark_mode: s.dark_mode,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Auth status & initial bootstrap
  app.get('/api/auth/status', (_req, res) => {
    try {
      const countRow = queryAll<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users');
      const hasUsers = (countRow[0]?.cnt ?? 0) > 0;
      const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
      res.json({ hasUsers, envPasscodeConfigured });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/setup-admin', (req, res) => {
    try {
      const countRow = queryAll<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users');
      if ((countRow[0]?.cnt ?? 0) > 0) {
        return res.status(409).json({ error: 'Akun Admin sudah terdaftar. Gunakan form login.' });
      }
      const username = String(req.body?.username || '').trim().toLowerCase();
      const full_name = String(req.body?.full_name || 'Administrator Mill').trim();
      const password = String(req.body?.password || '');

      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'Username harus 3-32 karakter (huruf, angka, titik, underscore).' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter.' });
      }

      const { salt, hash } = hashPassword(password);
      const { lastId } = runStmt(
        "INSERT INTO users (username, full_name, role, password_hash, salt, active, updated_at) VALUES (?, ?, 'ADMIN', ?, ?, 1, datetime('now'))",
        [username, full_name, hash, salt]
      );
      const user: UserAccount = { id: lastId, username, full_name, role: 'ADMIN', active: 1 };
      const token = createSessionToken(user);
      return res.status(201).json({ token, user, state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });
      }

      // Check SQLite users table first
      const rows = queryAll<{
        id: number;
        username: string;
        full_name: string;
        role: UserRole;
        password_hash: string;
        salt: string;
        active: number;
      }>('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);

      const found = rows[0];
      if (found) {
        if (!found.active) {
          return res.status(403).json({ error: 'Akun pengguna ini sedang dinonaktifkan oleh Admin.' });
        }
        if (!verifyPassword(password, found.salt, found.password_hash)) {
          return res.status(401).json({ error: 'Username atau password salah.' });
        }
        const user: UserAccount = {
          id: found.id,
          username: found.username,
          full_name: found.full_name,
          role: found.role,
          active: found.active,
        };
        const token = createSessionToken(user);
        return res.json({ token, user, state: getFullState() });
      }

      // Optional ADMIN_PASSCODE env override if configured
      const envPass = process.env.ADMIN_PASSCODE?.trim();
      if (envPass && username === 'admin' && password.length === envPass.length) {
        const a = Buffer.from(password, 'utf8');
        const b = Buffer.from(envPass, 'utf8');
        if (crypto.timingSafeEqual(a, b)) {
          const user: UserAccount = {
            id: 0,
            username: 'admin',
            full_name: 'Administrator (Env)',
            role: 'ADMIN',
            active: 1,
          };
          const token = createSessionToken(user);
          return res.json({ token, user, state: getFullState() });
        }
      }

      return res.status(401).json({ error: 'Username atau password salah.' });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const token = extractBearerToken(req);
    if (token) sessionStore.delete(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // Protected State Endpoint
  app.get('/api/state', requireAuth, (_req, res) => {
    try {
      res.json(getFullState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Users Management (ADMIN only)
  app.get('/api/users', requireAuth, requireRole(['ADMIN']), (_req, res) => {
    try {
      const users = queryAll<UserAccount>(
        'SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC'
      );
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const full_name = String(req.body?.full_name || '').trim();
      const role = String(req.body?.role || 'OPERATOR').toUpperCase() as UserRole;
      const password = String(req.body?.password || '');

      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'Username harus 3-32 karakter valid.' });
      }
      if (!full_name) return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      if (!['ADMIN', 'OPERATOR', 'FINANCE', 'VIEWER'].includes(role)) {
        return res.status(400).json({ error: 'Role tidak valid.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter.' });
      }

      const existing = queryAll<{ id: number }>('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Username sudah digunakan.' });
      }

      const { salt, hash } = hashPassword(password);
      runStmt(
        "INSERT INTO users (username, full_name, role, password_hash, salt, active, updated_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))",
        [username, full_name, role, hash, salt]
      );
      const users = queryAll<UserAccount>(
        'SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC'
      );
      return res.status(201).json({ users });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak valid.' });
      const existing = queryAll<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'User tidak ditemukan.' });

      const full_name = String(req.body?.full_name || '').trim();
      const role = String(req.body?.role || 'OPERATOR').toUpperCase() as UserRole;
      const active = req.body?.active ? 1 : 0;
      const password = String(req.body?.password || '');

      if (!full_name) return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      if (!['ADMIN', 'OPERATOR', 'FINANCE', 'VIEWER'].includes(role)) {
        return res.status(400).json({ error: 'Role tidak valid.' });
      }

      if (password.length > 0) {
        if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
        const { salt, hash } = hashPassword(password);
        runStmt(
          "UPDATE users SET full_name = ?, role = ?, active = ?, password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ?",
          [full_name, role, active, hash, salt, id]
        );
      } else {
        runStmt(
          "UPDATE users SET full_name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?",
          [full_name, role, active, id]
        );
      }

      const users = queryAll<UserAccount>(
        'SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC'
      );
      return res.json({ users });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole(['ADMIN']), (req: AuthenticatedRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (req.authUser?.id === id) {
        return res.status(400).json({ error: 'Tidak dapat menghapus akun yang sedang digunakan.' });
      }
      runStmt('DELETE FROM users WHERE id = ?', [id]);
      const users = queryAll<UserAccount>(
        'SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC'
      );
      return res.json({ users });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Suppliers CRUD
  app.post('/api/suppliers', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const code = String(req.body?.code || '').trim();
      const spk = String(req.body?.masa_berlaku_spk || 's/d 31/12/26').trim();
      const subsidiNetto = Number(req.body?.subsidi_netto_rp ?? 0) || 0;
      const subsidiTenera = Number(req.body?.subsidi_tenera_rp ?? 100) || 0;
      const pphType = (['PPH22', 'PPH4_2', 'NONE'].includes(String(req.body?.pph_type))
        ? String(req.body?.pph_type)
        : 'PPH22') as PphType;

      if (!name) return res.status(400).json({ error: 'Nama supplier wajib diisi' });
      const existing = queryAll<Supplier>('SELECT * FROM suppliers WHERE UPPER(name) = UPPER(?)', [name]);
      if (existing.length > 0) return res.status(409).json({ error: 'Supplier sudah terdaftar' });
      const { lastId } = runStmt(
        `INSERT INTO suppliers (name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, insentif_rp, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [name, code || `SUP-${Date.now().toString().slice(-3)}`, spk, subsidiNetto, subsidiTenera, pphType, Number(req.body?.insentif_rp ?? 0) || 0]
      );
      return res.status(201).json({ id: lastId, state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/suppliers/:id', requireAuth, requireRole(['ADMIN', 'FINANCE', 'OPERATOR']), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak valid' });
      const b = req.body || {};
      const pphType = (['PPH22', 'PPH4_2', 'NONE'].includes(String(b.pph_type))
        ? String(b.pph_type)
        : 'PPH22') as PphType;
      runStmt(
        `UPDATE suppliers SET
          name = COALESCE(NULLIF(?, ''), name),
          masa_berlaku_spk = ?,
          subsidi_netto_rp = ?,
          subsidi_tenera_rp = ?,
          pph_type = ?,
          insentif_rp = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          String(b.name || '').trim(),
          String(b.masa_berlaku_spk || 's/d 31/12/26'),
          Number(b.subsidi_netto_rp) || 0,
          Number(b.subsidi_tenera_rp) || 0,
          pphType,
          Number(b.insentif_rp) || 0,
          id,
        ]
      );
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/suppliers/:id', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak valid' });
      runStmt('DELETE FROM suppliers WHERE id = ?', [id]);
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Supplier Transactions CRUD
  app.post('/api/supplier-transactions', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const b = req.body || {};
      if (!b.supplier_id || !b.tanggal || !b.no_kendaraan) {
        return res.status(400).json({ error: 'supplier_id, tanggal, dan no_kendaraan wajib diisi' });
      }
      const { lastId } = runStmt(
        `INSERT INTO supplier_transactions (
          supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda,
          netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          Number(b.supplier_id),
          String(b.tanggal),
          String(b.no_kendaraan).toUpperCase(),
          Number(b.bruto_kg) || 0,
          Number(b.denda_kg) || 0,
          Number(b.persen_denda) || 0,
          Number(b.netto_kg) || 0,
          Number(b.grade) || 0,
          Number(b.harga_rp) || 0,
          Number(b.total_rp) || 0,
          String(b.varietas_dxp || 'DURA'),
          String(b.quality_tier || 'HQ'),
          b.validated ? 1 : 0,
        ]
      );
      return res.status(201).json({ id: lastId, state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/supplier-transactions/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak valid' });
      runStmt(
        `UPDATE supplier_transactions SET
          supplier_id = ?, tanggal = ?, no_kendaraan = ?, bruto_kg = ?, denda_kg = ?,
          persen_denda = ?, netto_kg = ?, grade = ?, harga_rp = ?, total_rp = ?,
          varietas_dxp = ?, quality_tier = ?, validated = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [
          Number(b.supplier_id),
          String(b.tanggal),
          String(b.no_kendaraan || '').toUpperCase(),
          Number(b.bruto_kg) || 0,
          Number(b.denda_kg) || 0,
          Number(b.persen_denda) || 0,
          Number(b.netto_kg) || 0,
          Number(b.grade) || 0,
          Number(b.harga_rp) || 0,
          Number(b.total_rp) || 0,
          String(b.varietas_dxp || 'DURA'),
          String(b.quality_tier || 'HQ'),
          b.validated ? 1 : 0,
          id,
        ]
      );
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/supplier-transactions', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const supIdRaw = req.query.supplier_id;
      if (supIdRaw !== undefined && supIdRaw !== '') {
        const supId = Number(supIdRaw);
        if (!Number.isFinite(supId)) return res.status(400).json({ error: 'supplier_id tidak valid' });
        runStmt('DELETE FROM supplier_transactions WHERE supplier_id = ?', [supId]);
      } else {
        runStmt('DELETE FROM supplier_transactions');
      }
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/supplier-transactions/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const id = Number(req.params.id);
      runStmt('DELETE FROM supplier_transactions WHERE id = ?', [id]);
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/supplier-transactions/bulk-validate', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const { ids, validated, supplier_id } = req.body || {};
      const val = validated ? 1 : 0;
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        runStmt(`UPDATE supplier_transactions SET validated = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`, [
          val,
          ...ids.map(Number),
        ]);
      } else if (supplier_id) {
        runStmt("UPDATE supplier_transactions SET validated = ?, updated_at = datetime('now') WHERE supplier_id = ?", [
          val,
          Number(supplier_id),
        ]);
      } else {
        runStmt("UPDATE supplier_transactions SET validated = ?, updated_at = datetime('now')", [val]);
      }
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/supplier-transactions/batch', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      db.run('BEGIN TRANSACTION');
      for (const b of rows) {
        db.run(
          `INSERT INTO supplier_transactions (
            supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda,
            netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            Number(b.supplier_id),
            String(b.tanggal),
            String(b.no_kendaraan || '').toUpperCase(),
            Number(b.bruto_kg) || 0,
            Number(b.denda_kg) || 0,
            Number(b.persen_denda) || 0,
            Number(b.netto_kg) || 0,
            Number(b.grade) || 0,
            Number(b.harga_rp) || 0,
            Number(b.total_rp) || 0,
            String(b.varietas_dxp || 'DURA'),
            String(b.quality_tier || 'HQ'),
            b.validated ? 1 : 0,
          ]
        );
      }
      db.run('COMMIT');
      persistDbToDisk();
      return res.status(201).json({ count: rows.length, state: getFullState() });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Bulk Excel Import for ALL Suppliers & Estates
  app.post('/api/import/excel-all', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const supplierRows = Array.isArray(req.body?.supplierRows) ? req.body.supplierRows : [];
      const estateRows = Array.isArray(req.body?.estateRows) ? req.body.estateRows : [];

      db.run('BEGIN TRANSACTION');

      const supplierIdByName = new Map<string, number>();
      for (const s of queryAll<Supplier>('SELECT id, name FROM suppliers')) {
        supplierIdByName.set(s.name.trim().toUpperCase(), s.id);
      }
      const estateIdByName = new Map<string, number>();
      for (const e of queryAll<Estate>('SELECT id, name FROM estates')) {
        estateIdByName.set(e.name.trim().toUpperCase(), e.id);
      }

      let createdSuppliers = 0;
      let createdEstates = 0;

      for (const r of supplierRows) {
        const name = String(r.entityName || '').trim();
        if (!name) continue;
        const key = name.toUpperCase();
        let supId = supplierIdByName.get(key);
        if (!supId) {
          db.run(
            "INSERT INTO suppliers (name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, active, updated_at) VALUES (?, ?, 's/d 31/12/26', 0, 100, 'PPH22', 1, datetime('now'))",
            [name, `SUP-${String(supplierIdByName.size + 1).padStart(2, '0')}`]
          );
          const idRow = queryAll<{ id: number }>('SELECT last_insert_rowid() AS id');
          supId = idRow[0].id;
          supplierIdByName.set(key, supId);
          createdSuppliers++;
        }
        db.run(
          `INSERT INTO supplier_transactions (
            supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda,
            netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            supId,
            String(r.tanggal),
            String(r.no_kendaraan || '').toUpperCase(),
            Number(r.bruto_kg) || 0,
            Number(r.denda_kg) || 0,
            Number(r.persen_denda) || 0,
            Number(r.netto_kg) || 0,
            Number(r.grade) || 0,
            Number(r.harga_rp) || 0,
            Number(r.total_rp) || 0,
            String(r.varietas_dxp || 'DURA'),
            String(r.quality_tier || 'HQ'),
            r.validated ? 1 : 0,
          ]
        );
      }

      for (const r of estateRows) {
        const name = String(r.entityName || '').trim();
        if (!name) continue;
        const key = name.toUpperCase();
        let estId = estateIdByName.get(key);
        if (!estId) {
          const estType = r.estateType === 'INTI' ? 'INTI' : 'PLASMA';
          db.run("INSERT INTO estates (name, type, updated_at) VALUES (?, ?, datetime('now'))", [name, estType]);
          const idRow = queryAll<{ id: number }>('SELECT last_insert_rowid() AS id');
          estId = idRow[0].id;
          estateIdByName.set(key, estId);
          createdEstates++;
        }
        db.run(
          `INSERT INTO estate_transactions (
            estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg,
            netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, datetime('now'))`,
          [
            estId,
            String(r.tanggal),
            String(r.no_polisi || '').toUpperCase(),
            String(r.bulan_th_tanam || ''),
            Number(r.bruto_kg) || 0,
            Number(r.denda_kg) || 0,
            Number(r.netto_kg) || 0,
            Number(r.persen_denda) || 0,
            Number(r.umur) || 10,
            Number(r.harga_rp) || 0,
            Number(r.total_rp) || 0,
            r.validated ? 1 : 0,
          ]
        );
      }

      db.run('COMMIT');
      persistDbToDisk();
      return res.status(201).json({
        importedSuppliers: supplierRows.length,
        importedEstates: estateRows.length,
        createdSuppliers,
        createdEstates,
        state: getFullState(),
      });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Estates CRUD
  app.post('/api/estates', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const type = String(req.body?.type || 'PLASMA').toUpperCase() === 'INTI' ? 'INTI' : 'PLASMA';
      if (!name) return res.status(400).json({ error: 'Nama kebun wajib diisi' });
      const existing = queryAll<Estate>('SELECT id FROM estates WHERE UPPER(name) = UPPER(?)', [name]);
      if (existing.length > 0) return res.status(409).json({ error: 'Kebun sudah terdaftar' });
      const { lastId } = runStmt(
        "INSERT INTO estates (name, type, updated_at) VALUES (?, ?, datetime('now'))",
        [name, type]
      );
      return res.status(201).json({ id: lastId, state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Estate Transactions CRUD
  app.post('/api/estate-transactions', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [req.body];
      db.run('BEGIN TRANSACTION');
      for (const b of rows) {
        db.run(
          `INSERT INTO estate_transactions (
            estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg,
            netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            Number(b.estate_id),
            String(b.tanggal),
            String(b.no_polisi || '').toUpperCase(),
            String(b.bulan_th_tanam || ''),
            Number(b.bruto_kg) || 0,
            Number(b.denda_kg) || 0,
            Number(b.netto_kg) || 0,
            Number(b.persen_denda) || 0,
            Number(b.umur) || 10,
            Number(b.harga_rp) || 0,
            Number(b.total_rp) || 0,
            typeof b.blok_details_json === 'string' ? b.blok_details_json : JSON.stringify(b.blok_details_json || []),
            b.validated ? 1 : 0,
          ]
        );
      }
      db.run('COMMIT');
      persistDbToDisk();
      return res.status(201).json({ state: getFullState() });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/estate-transactions/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      runStmt(
        `UPDATE estate_transactions SET
          estate_id = ?, tanggal = ?, no_polisi = ?, bulan_th_tanam = ?, bruto_kg = ?, denda_kg = ?,
          netto_kg = ?, persen_denda = ?, umur = ?, harga_rp = ?, total_rp = ?, blok_details_json = ?,
          validated = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [
          Number(b.estate_id),
          String(b.tanggal),
          String(b.no_polisi || '').toUpperCase(),
          String(b.bulan_th_tanam || ''),
          Number(b.bruto_kg) || 0,
          Number(b.denda_kg) || 0,
          Number(b.netto_kg) || 0,
          Number(b.persen_denda) || 0,
          Number(b.umur) || 10,
          Number(b.harga_rp) || 0,
          Number(b.total_rp) || 0,
          typeof b.blok_details_json === 'string' ? b.blok_details_json : JSON.stringify(b.blok_details_json || []),
          b.validated ? 1 : 0,
          id,
        ]
      );
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/estate-transactions', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const estIdRaw = req.query.estate_id;
      if (estIdRaw !== undefined && estIdRaw !== '') {
        const estId = Number(estIdRaw);
        if (!Number.isFinite(estId)) return res.status(400).json({ error: 'estate_id tidak valid' });
        runStmt('DELETE FROM estate_transactions WHERE estate_id = ?', [estId]);
      } else {
        runStmt('DELETE FROM estate_transactions');
      }
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/estate-transactions/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const id = Number(req.params.id);
      runStmt('DELETE FROM estate_transactions WHERE id = ?', [id]);
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/estate-transactions/bulk-validate', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const { ids, validated, estate_id } = req.body || {};
      const val = validated ? 1 : 0;
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        runStmt(`UPDATE estate_transactions SET validated = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`, [
          val,
          ...ids.map(Number),
        ]);
      } else if (estate_id) {
        runStmt("UPDATE estate_transactions SET validated = ?, updated_at = datetime('now') WHERE estate_id = ?", [
          val,
          Number(estate_id),
        ]);
      } else {
        runStmt("UPDATE estate_transactions SET validated = ?, updated_at = datetime('now')", [val]);
      }
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Blok Master CRUD
  app.post('/api/blok-master', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const b = req.body || {};
      if (!b.kode_blok || !b.nama_kebun) {
        return res.status(400).json({ error: 'Kode blok dan nama kebun wajib diisi' });
      }
      runStmt(
        `INSERT INTO blok_master (kode_blok, nama_kebun, bulan_tanam, keterangan, umur_tahun, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(kode_blok, nama_kebun) DO UPDATE SET
           bulan_tanam = excluded.bulan_tanam,
           keterangan = excluded.keterangan,
           umur_tahun = excluded.umur_tahun,
           updated_at = datetime('now')`,
        [
          String(b.kode_blok).toUpperCase().trim(),
          String(b.nama_kebun).trim(),
          String(b.bulan_tanam || 'Jan-10').trim(),
          String(b.keterangan || 'Plasma').trim(),
          Number(b.umur_tahun) || 10,
        ]
      );
      return res.status(201).json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/blok-master/:id', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      runStmt('DELETE FROM blok_master WHERE id = ?', [Number(req.params.id)]);
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Harga Updates
  app.put('/api/harga/disbun-inti', requireAuth, requireRole(['ADMIN', 'FINANCE']), (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      db.run('BEGIN TRANSACTION');
      for (const r of rows) {
        db.run(
          `UPDATE harga_disbun_inti SET periode_1 = ?, periode_2 = ?, periode_3 = ?, periode_4 = ? WHERE id = ?`,
          [Number(r.periode_1) || 0, Number(r.periode_2) || 0, Number(r.periode_3) || 0, Number(r.periode_4) || 0, Number(r.id)]
        );
      }
      db.run('COMMIT');
      persistDbToDisk();
      return res.json({ state: getFullState() });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/harga/disbun-plasma', requireAuth, requireRole(['ADMIN', 'FINANCE']), (req, res) => {
    try {
      const r = req.body || {};
      runStmt(
        `UPDATE harga_disbun_plasma SET periode_1 = ?, periode_2 = ?, periode_3 = ?, periode_4 = ? WHERE id = ?`,
        [Number(r.periode_1) || 0, Number(r.periode_2) || 0, Number(r.periode_3) || 0, Number(r.periode_4) || 0, Number(r.id || 1)]
      );
      return res.json({ state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/harga/market', requireAuth, requireRole(['ADMIN', 'FINANCE', 'OPERATOR']), (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const bulan_tahun = String(req.body?.bulan_tahun || '2026-11');
      db.run('BEGIN TRANSACTION');
      for (const r of rows) {
        db.run(
          `INSERT INTO harga_market_harian (bulan_tahun, tanggal, harga)
           VALUES (?, ?, ?)
           ON CONFLICT(bulan_tahun, tanggal) DO UPDATE SET harga = excluded.harga`,
          [bulan_tahun, Number(r.tanggal), Number(r.harga) || 0]
        );
      }
      db.run('COMMIT');
      persistDbToDisk();
      return res.json({ state: getFullState() });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Settings (ADMIN for branding/TTD/themes, or operational rates)
  app.put('/api/settings', requireAuth, requireRole(['ADMIN', 'FINANCE', 'OPERATOR']), (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body || {};
      const adminOnlyKeys = new Set([
        'company_name',
        'company_subtitle',
        'company_logo',
        'report_city',
        'ttd_disetujui_name',
        'ttd_disetujui_title',
        'ttd_diperiksa_name',
        'ttd_diperiksa_title',
        'ttd_disiapkan_name',
        'ttd_disiapkan_title',
        'pph22_rate',
        'pph4_rate',
        'footer_running_text',
        'sidebar_bg_image',
        'sidebar_bg_zoom',
      ]);

      for (const key of Object.keys(body)) {
        if (adminOnlyKeys.has(key) && req.authUser?.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Hanya Admin yang dapat mengubah identitas perusahaan, tampilan sidebar/footer & TTD.' });
        }
      }

      if (typeof body.company_logo === 'string' && !isValidLogoUrl(body.company_logo)) {
        return res.status(400).json({ error: 'Format logo harus PNG/JPG/WebP/GIF atau URL yang valid (maks 1.5MB).' });
      }
      if (typeof body.sidebar_bg_image === 'string' && !isValidLogoUrl(body.sidebar_bg_image)) {
        return res.status(400).json({ error: 'Format gambar sidebar harus PNG/JPG/WebP/GIF atau URL yang valid (maks 1.5MB).' });
      }

      db.run('BEGIN TRANSACTION');
      for (const [key, value] of Object.entries(body)) {
        db.run(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, String(value)]
        );
      }
      db.run('COMMIT');
      persistDbToDisk();
      return res.json({ state: getFullState() });
    } catch (err) {
      try { db.run('ROLLBACK'); } catch { /* ignore */ }
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Offline Sync Endpoint
  app.post('/api/sync', requireAuth, requireRole(['ADMIN', 'OPERATOR', 'FINANCE']), (req, res) => {
    try {
      const queue = Array.isArray(req.body?.queue) ? req.body.queue : [];
      for (const item of queue) {
        const { method, endpoint, payload } = item || {};
        if (endpoint === '/api/suppliers' && method === 'POST' && payload?.name) {
          const existing = queryAll<Supplier>('SELECT id FROM suppliers WHERE UPPER(name) = UPPER(?)', [String(payload.name)]);
          if (existing.length === 0) {
            db.run(
              "INSERT INTO suppliers (name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, insentif_rp, active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))",
              [
                String(payload.name),
                String(payload.code || `SUP-${Date.now().toString().slice(-3)}`),
                String(payload.masa_berlaku_spk || 's/d 31/12/26'),
                Number(payload.subsidi_netto_rp) || 0,
                Number(payload.subsidi_tenera_rp ?? 100) || 0,
                String(payload.pph_type || 'PPH22'),
                Number(payload.insentif_rp) || 0,
              ]
            );
          }
        } else if (endpoint.startsWith('/api/suppliers/') && method === 'PUT' && payload) {
          const id = Number(endpoint.split('/').pop());
          if (Number.isFinite(id)) {
            db.run(
              `UPDATE suppliers SET
                name = COALESCE(NULLIF(?, ''), name),
                masa_berlaku_spk = ?,
                subsidi_netto_rp = ?,
                subsidi_tenera_rp = ?,
                pph_type = ?,
                insentif_rp = ?,
                updated_at = datetime('now')
              WHERE id = ?`,
              [
                String(payload.name || '').trim(),
                String(payload.masa_berlaku_spk || 's/d 31/12/26'),
                Number(payload.subsidi_netto_rp) || 0,
                Number(payload.subsidi_tenera_rp) || 0,
                ['PPH22', 'PPH4_2', 'NONE'].includes(String(payload.pph_type)) ? String(payload.pph_type) : 'PPH22',
                Number(payload.insentif_rp) || 0,
                id,
              ]
            );
          }
        } else if (endpoint === '/api/import/excel-all' && method === 'POST' && payload) {
          const sRows = Array.isArray(payload.supplierRows) ? payload.supplierRows : [];
          const eRows = Array.isArray(payload.estateRows) ? payload.estateRows : [];
          const supMap = new Map<string, number>();
          for (const s of queryAll<Supplier>('SELECT id, name FROM suppliers')) {
            supMap.set(s.name.trim().toUpperCase(), s.id);
          }
          const estMap = new Map<string, number>();
          for (const e of queryAll<Estate>('SELECT id, name FROM estates')) {
            estMap.set(e.name.trim().toUpperCase(), e.id);
          }
          for (const r of sRows) {
            const name = String(r.entityName || '').trim();
            if (!name) continue;
            const key = name.toUpperCase();
            let supId = supMap.get(key);
            if (!supId) {
              db.run(
                "INSERT INTO suppliers (name, code, masa_berlaku_spk, subsidi_netto_rp, subsidi_tenera_rp, pph_type, active, updated_at) VALUES (?, ?, 's/d 31/12/26', 0, 100, 'PPH22', 1, datetime('now'))",
                [name, `SUP-${String(supMap.size + 1).padStart(2, '0')}`]
              );
              const idRow = queryAll<{ id: number }>('SELECT last_insert_rowid() AS id');
              supId = idRow[0].id;
              supMap.set(key, supId);
            }
            db.run(
              `INSERT INTO supplier_transactions (
                supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda,
                netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [
                supId,
                String(r.tanggal),
                String(r.no_kendaraan || '').toUpperCase(),
                Number(r.bruto_kg) || 0,
                Number(r.denda_kg) || 0,
                Number(r.persen_denda) || 0,
                Number(r.netto_kg) || 0,
                Number(r.grade) || 0,
                Number(r.harga_rp) || 0,
                Number(r.total_rp) || 0,
                String(r.varietas_dxp || 'DURA'),
                String(r.quality_tier || 'HQ'),
                r.validated ? 1 : 0,
              ]
            );
          }
          for (const r of eRows) {
            const name = String(r.entityName || '').trim();
            if (!name) continue;
            const key = name.toUpperCase();
            let estId = estMap.get(key);
            if (!estId) {
              const estType = r.estateType === 'INTI' ? 'INTI' : 'PLASMA';
              db.run("INSERT INTO estates (name, type, updated_at) VALUES (?, ?, datetime('now'))", [name, estType]);
              const idRow = queryAll<{ id: number }>('SELECT last_insert_rowid() AS id');
              estId = idRow[0].id;
              estMap.set(key, estId);
            }
            db.run(
              `INSERT INTO estate_transactions (
                estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg,
                netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, datetime('now'))`,
              [
                estId,
                String(r.tanggal),
                String(r.no_polisi || '').toUpperCase(),
                String(r.bulan_th_tanam || ''),
                Number(r.bruto_kg) || 0,
                Number(r.denda_kg) || 0,
                Number(r.netto_kg) || 0,
                Number(r.persen_denda) || 0,
                Number(r.umur) || 10,
                Number(r.harga_rp) || 0,
                Number(r.total_rp) || 0,
                r.validated ? 1 : 0,
              ]
            );
          }
        } else if (endpoint === '/api/supplier-transactions' && method === 'POST' && payload) {
          db.run(
            `INSERT INTO supplier_transactions (
              supplier_id, tanggal, no_kendaraan, bruto_kg, denda_kg, persen_denda,
              netto_kg, grade, harga_rp, total_rp, varietas_dxp, quality_tier, validated, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              Number(payload.supplier_id),
              String(payload.tanggal),
              String(payload.no_kendaraan || '').toUpperCase(),
              Number(payload.bruto_kg) || 0,
              Number(payload.denda_kg) || 0,
              Number(payload.persen_denda) || 0,
              Number(payload.netto_kg) || 0,
              Number(payload.grade) || 0,
              Number(payload.harga_rp) || 0,
              Number(payload.total_rp) || 0,
              String(payload.varietas_dxp || 'DURA'),
              String(payload.quality_tier || 'HQ'),
              payload.validated ? 1 : 0,
            ]
          );
        } else if (endpoint.startsWith('/api/supplier-transactions/') && method === 'PUT' && payload) {
          const id = Number(endpoint.split('/').pop());
          db.run(
            `UPDATE supplier_transactions SET
              supplier_id = ?, tanggal = ?, no_kendaraan = ?, bruto_kg = ?, denda_kg = ?,
              persen_denda = ?, netto_kg = ?, grade = ?, harga_rp = ?, total_rp = ?,
              varietas_dxp = ?, quality_tier = ?, validated = ?, updated_at = datetime('now')
            WHERE id = ?`,
            [
              Number(payload.supplier_id),
              String(payload.tanggal),
              String(payload.no_kendaraan || '').toUpperCase(),
              Number(payload.bruto_kg) || 0,
              Number(payload.denda_kg) || 0,
              Number(payload.persen_denda) || 0,
              Number(payload.netto_kg) || 0,
              Number(payload.grade) || 0,
              Number(payload.harga_rp) || 0,
              Number(payload.total_rp) || 0,
              String(payload.varietas_dxp || 'DURA'),
              String(payload.quality_tier || 'HQ'),
              payload.validated ? 1 : 0,
              id,
            ]
          );
        } else if (endpoint === '/api/estates' && method === 'POST' && payload?.name) {
          const name = String(payload.name).trim();
          const type = String(payload.type || 'PLASMA').toUpperCase() === 'INTI' ? 'INTI' : 'PLASMA';
          const existing = queryAll<Estate>('SELECT id FROM estates WHERE UPPER(name) = UPPER(?)', [name]);
          if (existing.length === 0) {
            db.run("INSERT INTO estates (name, type, updated_at) VALUES (?, ?, datetime('now'))", [name, type]);
          }
        } else if (endpoint === '/api/supplier-transactions' && method === 'DELETE') {
          db.run('DELETE FROM supplier_transactions');
        } else if (endpoint.startsWith('/api/supplier-transactions?') && method === 'DELETE') {
          const qs = endpoint.split('?')[1] || '';
          const sp = new URLSearchParams(qs);
          const supId = Number(sp.get('supplier_id'));
          if (Number.isFinite(supId) && supId > 0) {
            db.run('DELETE FROM supplier_transactions WHERE supplier_id = ?', [supId]);
          } else {
            db.run('DELETE FROM supplier_transactions');
          }
        } else if (endpoint.startsWith('/api/supplier-transactions/') && method === 'DELETE') {
          const id = Number(endpoint.split('/').pop());
          db.run('DELETE FROM supplier_transactions WHERE id = ?', [id]);
        } else if (endpoint === '/api/estate-transactions' && method === 'POST' && payload) {
          const rows = Array.isArray(payload.rows) ? payload.rows : [payload];
          for (const b of rows) {
            db.run(
              `INSERT INTO estate_transactions (
                estate_id, tanggal, no_polisi, bulan_th_tanam, bruto_kg, denda_kg,
                netto_kg, persen_denda, umur, harga_rp, total_rp, blok_details_json, validated, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [
                Number(b.estate_id),
                String(b.tanggal),
                String(b.no_polisi || '').toUpperCase(),
                String(b.bulan_th_tanam || ''),
                Number(b.bruto_kg) || 0,
                Number(b.denda_kg) || 0,
                Number(b.netto_kg) || 0,
                Number(b.persen_denda) || 0,
                Number(b.umur) || 10,
                Number(b.harga_rp) || 0,
                Number(b.total_rp) || 0,
                typeof b.blok_details_json === 'string' ? b.blok_details_json : JSON.stringify(b.blok_details_json || []),
                b.validated ? 1 : 0,
              ]
            );
          }
        } else if (endpoint === '/api/estate-transactions' && method === 'DELETE') {
          db.run('DELETE FROM estate_transactions');
        } else if (endpoint.startsWith('/api/estate-transactions?') && method === 'DELETE') {
          const qs = endpoint.split('?')[1] || '';
          const sp = new URLSearchParams(qs);
          const estId = Number(sp.get('estate_id'));
          if (Number.isFinite(estId) && estId > 0) {
            db.run('DELETE FROM estate_transactions WHERE estate_id = ?', [estId]);
          } else {
            db.run('DELETE FROM estate_transactions');
          }
        } else if (endpoint.startsWith('/api/estate-transactions/') && method === 'DELETE') {
          const id = Number(endpoint.split('/').pop());
          db.run('DELETE FROM estate_transactions WHERE id = ?', [id]);
        } else if (endpoint === '/api/settings' && method === 'PUT' && payload) {
          for (const [k, v] of Object.entries(payload)) {
            if ((k === 'company_logo' || k === 'sidebar_bg_image') && typeof v === 'string' && !isValidLogoUrl(v)) {
              continue;
            }
            db.run(
              `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
              [k, String(v)]
            );
          }
        }
      }
      persistDbToDisk();
      return res.json({ synced: queue.length, state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Export & Import database.sql
  app.get('/api/database/export-sql', requireAuth, (_req, res) => {
    try {
      const state = getFullState();
      const schemaHeader = fs.existsSync(SCHEMA_SQL_FILE)
        ? fs.readFileSync(SCHEMA_SQL_FILE, 'utf8').split('-- ============================================================================\n-- SEED DATA')[0]
        : '';
      const dump = `${schemaHeader}\n${generateSqlDumpFromState(state)}`;
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="database.sql"');
      return res.send(dump);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/database/import-sql', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      const sql = String(req.body?.sql || '');
      if (!sql.trim()) return res.status(400).json({ error: 'Konten SQL kosong' });
      db.exec(sql);
      runSchemaMigrations();
      persistDbToDisk();
      return res.json({ message: 'database.sql berhasil diimpor ke SQLite', state: getFullState() });
    } catch (err) {
      return res.status(400).json({ error: `Gagal eksekusi SQL: ${(err as Error).message}` });
    }
  });

  app.post('/api/database/reset', requireAuth, requireRole(['ADMIN']), (_req, res) => {
    try {
      if (!fs.existsSync(SCHEMA_SQL_FILE)) {
        return res.status(404).json({ error: 'File database.sql tidak ditemukan' });
      }
      // Preserve users table so active admin doesn't lock themselves out on data reset
      const existingUsers = queryAll<Record<string, unknown>>('SELECT * FROM users');
      db = new SQL.Database();
      db.exec(fs.readFileSync(SCHEMA_SQL_FILE, 'utf8'));
      runSchemaMigrations();
      for (const u of existingUsers) {
        db.run(
          'INSERT OR IGNORE INTO users (id, username, full_name, role, password_hash, salt, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [u.id as number, u.username as string, u.full_name as string, u.role as string, u.password_hash as string, u.salt as string, u.active as number, u.created_at as string, u.updated_at as string]
        );
      }
      persistDbToDisk();
      return res.json({ message: 'Database direset ulang dari database.sql', state: getFullState() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/database/query', requireAuth, requireRole(['ADMIN']), (req, res) => {
    try {
      const sql = String(req.body?.sql || '').trim();
      if (!/^SELECT\s+/i.test(sql)) {
        return res.status(400).json({ error: 'Hanya query SELECT yang diizinkan di SQL Inspector' });
      }
      if (/\busers\b/i.test(sql) || /\bpassword_hash\b/i.test(sql)) {
        return res.status(403).json({ error: 'Akses langsung ke kolom kredensial users tidak diizinkan.' });
      }
      const rows = queryAll(sql);
      return res.json({ rows: rows.slice(0, 200), total: rows.length });
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  });

  const httpServer = http.createServer(app);

  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: disableHmr ? false : { server: httpServer },
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FSK Sebawi Mill TBS server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
