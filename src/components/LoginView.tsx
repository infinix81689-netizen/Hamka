import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import type { AuthSession, UserAccount } from '../types/tbs';
import { CompanyLogo } from './CompanyLogo';
import { SmartLoginRobot, type RobotMood } from './SmartLoginRobot';
import { cacheOfflineAuthCredential, verifyOfflineAuthCredential } from '../utils/offlineDb';

interface LoginViewProps {
  companyName: string;
  companySubtitle: string;
  companyLogo?: string;
  isOnline: boolean;
  hasUsers: boolean;
  envPasscodeConfigured: boolean;
  hasOfflineUsers: boolean;
  onLoginSuccess: (session: AuthSession, serverState?: unknown) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  companyName,
  companySubtitle,
  companyLogo,
  isOnline,
  hasUsers,
  envPasscodeConfigured,
  hasOfflineUsers,
  onLoginSuccess,
}) => {
  const needsFirstRunSetup = isOnline && !hasUsers && !envPasscodeConfigured;
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('Administrator Mill');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [activeField, setActiveField] = useState<'none' | 'username' | 'password'>('none');
  const [successUser, setSuccessUser] = useState('');
  const [reactionKey, setReactionKey] = useState(0);
  const [bgImageError, setBgImageError] = useState(false);
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setLoginStatus('error');
    setReactionKey((k) => k + 1);
  };

  const triggerSuccess = (
    user: UserAccount,
    session: AuthSession,
    serverState?: unknown
  ) => {
    setErrorMsg('');
    setSuccessUser(user.full_name || user.username);
    setLoginStatus('success');
    setReactionKey((k) => k + 1);
    successTimerRef.current = window.setTimeout(() => {
      onLoginSuccess(session, serverState);
    }, 950);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStatus === 'success') return;
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      triggerError('Username wajib diisi.');
      return;
    }
    if (!password) {
      triggerError('Password wajib diisi.');
      return;
    }

    setLoading(true);
    setLoginStatus('loading');
    try {
      if (needsFirstRunSetup) {
        if (password.length < 6) {
          triggerError('Password Admin minimal 6 karakter.');
          return;
        }
        if (password !== confirmPassword) {
          triggerError('Konfirmasi password tidak cocok.');
          return;
        }
        const res = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            full_name: fullName.trim() || 'Administrator Mill',
            password,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          triggerError(json.error || 'Gagal membuat akun Admin awal.');
          return;
        }
        const user = json.user as UserAccount;
        await cacheOfflineAuthCredential(user, password);
        triggerSuccess(user, { token: json.token, user, mode: 'online' }, json.state);
        return;
      }

      if (isOnline) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password }),
        });
        const json = await res.json();
        if (!res.ok) {
          triggerError(json.error || 'Username atau password salah.');
          return;
        }
        const user = json.user as UserAccount;
        await cacheOfflineAuthCredential(user, password);
        triggerSuccess(user, { token: json.token, user, mode: 'online' }, json.state);
      } else {
        // Offline authentication via salted SHA-256 verifier stored in IndexedDB
        const offlineUser = await verifyOfflineAuthCredential(cleanUser, password);
        if (!offlineUser) {
          triggerError(
            hasOfflineUsers
              ? 'Username atau password tidak cocok dengan kredensial offline tersimpan.'
              : 'Belum ada sesi login yang tersimpan untuk mode offline. Hubungkan ke internet/server terlebih dahulu untuk login pertama.'
          );
          return;
        }
        triggerSuccess(offlineUser, {
          token: 'offline-local-session',
          user: offlineUser,
          mode: 'offline',
        });
      }
    } catch {
      triggerError('Terjadi kesalahan koneksi saat memverifikasi login.');
    } finally {
      setLoading(false);
    }
  };

  const robotMood: RobotMood =
    loginStatus === 'success'
      ? 'success'
      : loading || loginStatus === 'loading'
        ? 'loading'
        : loginStatus === 'error'
          ? 'error'
          : activeField === 'password'
            ? showPassword
              ? 'peeking-password'
              : 'typing-password'
            : activeField === 'username'
              ? 'typing-username'
              : 'idle';

  const robotMessage =
    loginStatus === 'success'
      ? `Selamat datang, ${successUser}! Akses disetujui, membuka ruang kerja...`
      : loading || loginStatus === 'loading'
        ? 'Sedang memverifikasi identitas & hak akses Anda...'
        : loginStatus === 'error' && errorMsg
          ? errorMsg
          : activeField === 'password'
            ? showPassword
              ? 'Password sedang ditampilkan. Pastikan tidak ada yang mengintip.'
              : 'Mode privasi aktif — kata sandi Anda dilindungi.'
            : activeField === 'username'
              ? username.trim()
                ? `Halo ${username.trim()}! Silakan lanjutkan mengisi password.`
                : 'Masukkan username akun Anda yang terdaftar.'
              : 'Siap membantu akses sistem Mill. Silakan masukkan Username & Password.';

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-brand-primary p-4 sm:p-6">
      {/* Full-bleed zooming palm oil mill & plantation backdrop */}
      {!bgImageError && (
        <img
          src="/src/assets/images/login_palm_mill_bg_1795247935902.jpg"
          alt="Pabrik Kelapa Sawit dan Perkebunan Kelapa Sawit"
          referrerPolicy="no-referrer"
          aria-hidden="true"
          onError={() => setBgImageError(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center select-none login-bg-zoom-anim"
        />
      )}

      {/* Theme-harmonized atmospheric scrim over backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 78%, rgba(2, 6, 23, 0.35)) 0%, color-mix(in srgb, var(--brand-secondary) 60%, rgba(2, 6, 23, 0.25)) 52%, color-mix(in srgb, var(--brand-accent) 48%, rgba(2, 6, 23, 0.72)) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/45"
      />

      {/* Floating ambient light glow behind login frame (radial-gradient for 60fps performance) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full login-orb-float"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--brand-accent) 28%, transparent) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 rounded-full login-orb-float-delayed"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--brand-highlight) 20%, transparent) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={
          loginStatus === 'error'
            ? { opacity: 1, y: 0, scale: 1, x: [0, -7, 7, -5, 5, 0] }
            : loginStatus === 'success'
              ? { opacity: 1, y: 0, scale: [1, 1.015, 1], x: 0 }
              : { opacity: 1, y: 0, scale: 1, x: 0 }
        }
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-4xl rounded-2xl shadow-[0_28px_75px_-12px_rgba(2,6,23,0.75)]"
      >
        {/* Hollow 1.5px luminous gradient border overlay (center stays clear so 70% glass shows backdrop cleanly) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl p-[1.5px] login-border-flow"
          style={{
            backgroundImage:
              loginStatus === 'error'
                ? 'linear-gradient(125deg, rgba(251, 113, 133, 0.95), rgba(244, 63, 94, 0.35), rgba(251, 191, 36, 0.75), rgba(251, 113, 133, 0.95))'
                : loginStatus === 'success'
                  ? 'linear-gradient(125deg, rgba(52, 211, 153, 0.95), rgba(250, 204, 21, 0.85), rgba(16, 185, 129, 0.45), rgba(52, 211, 153, 0.95))'
                  : 'linear-gradient(125deg, rgba(255, 255, 255, 0.65), var(--brand-highlight), var(--brand-accent), rgba(255, 255, 255, 0.55))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        {/* Inner 70% translucent white glass login frame */}
        <div className="relative rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.65)]">
          {/* Top animated theme rim matching workspace header */}
          <div
            aria-hidden="true"
            className="relative h-1.5 w-full overflow-hidden header-animated-bg"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent header-shimmer-sweep" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Left Institutional Showcase Panel + Smart Login Robot */}
            <div className="md:col-span-5 header-animated-bg opacity-95 p-7 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
              {/* Subtle drifting theme orbs inside frame */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -left-10 h-44 w-44 rounded-full login-orb-float"
                style={{
                  background:
                    'radial-gradient(circle, color-mix(in srgb, var(--brand-accent) 45%, transparent) 0%, transparent 72%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-12 -right-8 h-48 w-48 rounded-full login-orb-float-delayed"
                style={{
                  background:
                    'radial-gradient(circle, color-mix(in srgb, var(--brand-highlight) 30%, transparent) 0%, transparent 72%)',
                }}
              />

              {/* Animated shimmer sweep across showcase panel */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent header-shimmer-sweep"
              />

              {/* Floating botanical palm-frond line motif */}
              <svg
                aria-hidden="true"
                viewBox="0 0 180 180"
                fill="none"
                className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-44 text-white/10 login-motif-float"
              >
                <path
                  d="M24 166C48 118 88 78 158 34"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M52 126C36 106 28 84 32 62M74 104C58 80 54 54 62 32M98 84C86 60 88 36 100 18M68 118C94 114 120 120 144 134M92 94C118 92 142 100 164 114M114 72C136 72 154 78 170 88"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              {/* Vertical animated seam shimmer on desktop split */}
              <div
                aria-hidden="true"
                className="hidden md:block pointer-events-none absolute right-0 top-0 bottom-0 w-px bg-white/15 overflow-hidden"
              >
                <div
                  className="w-full h-24 login-divider-sheen"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent, var(--brand-highlight), transparent)',
                  }}
                />
              </div>

              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3"
                >
                  <CompanyLogo logoUrl={companyLogo} companyName={companyName} size="lg" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-highlight">
                      {companySubtitle}
                    </p>
                    <h2 className="text-sm font-bold leading-snug text-white">
                      {companyName}
                    </h2>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-6 space-y-2"
                >
                  <h1 className="text-xl font-bold tracking-tight leading-tight text-balance">
                    Sistem Pembayaran & Pembelian TBS Sawit
                  </h1>
                  <p className="text-xs text-slate-200/90 leading-relaxed">
                    Platform terpadu input timbangan Suppliers, kalkulasi BJR Estate, Master Harga Disbun, dan Laporan Rekapitulasi Pembayaran.
                  </p>
                </motion.div>

                {/* Interactive Smart Robot Assistant */}
                <SmartLoginRobot
                  mood={robotMood}
                  message={robotMessage}
                  reactionKey={reactionKey}
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.22 }}
                className="relative z-10 mt-6 border-t border-white/15 pt-4 text-xs"
              >
                <div className="flex items-center gap-2 text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-brand-highlight shrink-0" />
                  <span>Hak Akses Berbasis Peran (Admin, Operator, Finance, Viewer)</span>
                </div>
              </motion.div>
            </div>

            {/* Right Login / Initial Admin Setup Form (70% Translucent White Glass Surface) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center relative"
            >
              {/* Soft specular top glass reflection */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/35 dark:from-white/5 to-transparent"
              />

              <div className="relative z-10 mb-6">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  {needsFirstRunSetup ? (
                    <>
                      <UserPlus className="h-3.5 w-3.5 shrink-0" />
                      <span>Aktivasi Awal Administrator</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Autentikasi Pengguna</span>
                    </>
                  )}
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                  {needsFirstRunSetup ? 'Buat Akun Admin Utama' : 'Masuk ke Menu Utama'}
                </h2>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                  {needsFirstRunSetup
                    ? 'Database belum memiliki akun pengguna. Tetapkan username & password Admin untuk mengaktifkan sistem hak akses.'
                    : 'Masukkan username dan password akun yang telah didaftarkan pada database.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      placeholder={needsFirstRunSetup ? 'misal: admin' : 'Masukkan username'}
                      value={username}
                      onFocus={() => setActiveField('username')}
                      onBlur={() => setActiveField((prev) => (prev === 'username' ? 'none' : prev))}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (loginStatus === 'error') {
                          setLoginStatus('idle');
                          setErrorMsg('');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white transition-colors focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>

                {needsFirstRunSetup && (
                  <div>
                    <label
                      htmlFor="login-fullname"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
                    >
                      Nama Lengkap Admin
                    </label>
                    <input
                      id="login-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama lengkap penanggung jawab"
                      className="w-full rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 px-3 py-2.5 text-sm text-slate-900 dark:text-white transition-colors focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={needsFirstRunSetup ? 'new-password' : 'current-password'}
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onFocus={() => setActiveField('password')}
                      onBlur={() => setActiveField((prev) => (prev === 'password' ? 'none' : prev))}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (loginStatus === 'error') {
                          setLoginStatus('idle');
                          setErrorMsg('');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 pl-9 pr-10 py-2.5 text-sm text-slate-900 dark:text-white transition-colors focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setShowPassword((v) => !v);
                        setActiveField('password');
                      }}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-2.5 top-2 rounded p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {needsFirstRunSetup && (
                  <div>
                    <label
                      htmlFor="login-confirm-password"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
                    >
                      Konfirmasi Password
                    </label>
                    <input
                      id="login-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Ulangi password"
                      value={confirmPassword}
                      onFocus={() => setActiveField('password')}
                      onBlur={() => setActiveField((prev) => (prev === 'password' ? 'none' : prev))}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85 px-3 py-2.5 text-sm text-slate-900 dark:text-white transition-colors focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                )}

                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/75 px-3 py-2 text-xs font-medium text-rose-800 dark:text-rose-200"
                  >
                    {errorMsg}
                  </motion.div>
                )}

                {loginStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="status"
                    className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/75 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
                  >
                    Login berhasil! Mengarahkan ke menu utama...
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={loading || loginStatus === 'success'}
                  whileHover={loading || loginStatus === 'success' ? undefined : { y: -1 }}
                  whileTap={loading || loginStatus === 'success' ? undefined : { scale: 0.99 }}
                  className="group relative w-full overflow-hidden rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95 disabled:opacity-70 transition-all cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100 header-shimmer-sweep"
                  />
                  <span className="relative z-10">
                    {loginStatus === 'success'
                      ? 'Akses Diterima...'
                      : loading
                        ? 'Memproses...'
                        : needsFirstRunSetup
                          ? 'Simpan Admin & Buka Aplikasi'
                          : 'Login ke Sistem'}
                  </span>
                </motion.button>
              </form>

              {!needsFirstRunSetup && envPasscodeConfigured && (
                <p className="relative z-10 mt-4 text-[11px] text-slate-600 dark:text-slate-300">
                  Admin override aktif melalui konfigurasi lingkungan (<code className="font-mono-num">admin</code>).
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
