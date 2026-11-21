import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { MillWeighbridgeScene, type WeighbridgePhase } from './MillWeighbridgeScene';

interface PageLoadingProps {
  companyName: string;
  companySubtitle: string;
  companyLogo?: string;
  statusText?: string;
  onSkip?: () => void;
  onComplete?: () => void;
}

const TARGET_BRUTO_KG = 8640;

export const PageLoading: React.FC<PageLoadingProps> = ({
  companyName,
  companySubtitle,
  companyLogo,
  statusText = 'Menyiapkan modul perhitungan TBS...',
  onSkip,
  onComplete,
}) => {
  const [phase, setPhase] = useState<WeighbridgePhase>('entering');
  const [weightKg, setWeightKg] = useState(0);
  const [bgError, setBgError] = useState(false);

  useEffect(() => {
    let timerId = 0;
    const rafId = window.requestAnimationFrame(() => {
      if (phase === 'entering') {
        timerId = window.setTimeout(() => setPhase('weighing'), 850);
      } else if (phase === 'weighing') {
        timerId = window.setTimeout(() => setPhase('verified'), 1550);
      } else {
        timerId = window.setTimeout(() => onComplete?.(), 1200);
      }
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [phase, onComplete]);

  useEffect(() => {
    if (phase === 'entering') {
      setWeightKg(0);
      return;
    }
    if (phase === 'verified') {
      setWeightKg(TARGET_BRUTO_KG);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const duration = 1300;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic for natural digital weighbridge settling
      const eased = 1 - Math.pow(1 - t, 3);
      setWeightKg(Math.round(eased * TARGET_BRUTO_KG));
      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase]);

  const progressPct = phase === 'entering' ? 34 : phase === 'weighing' ? 76 : 100;
  const phaseSubtitle =
    phase === 'entering'
      ? 'Truk pengangkut TBS sawit memasuki gerbang timbangan pabrik...'
      : phase === 'weighing'
        ? 'Menimbang muatan TBS sawit di jembatan timbang digital...'
        : 'Penimbangan selesai — membuka portal akses sistem...';

  const showSubtitle = Boolean(
    companySubtitle && !companyName.toLowerCase().includes(companySubtitle.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-between bg-slate-950 text-white">
      {/* Subtle Palm Mill Landscape Backdrop + Theme Scrim */}
      {!bgError && (
        <img
          src="/src/assets/images/login_palm_mill_bg_1795247935902.jpg"
          alt="Latar Pabrik Kelapa Sawit"
          decoding="async"
          referrerPolicy="no-referrer"
          aria-hidden="true"
          onError={() => setBgError(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-40 select-none login-bg-zoom-anim"
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'linear-gradient(160deg, color-mix(in srgb, var(--brand-primary) 76%, #020617) 0%, color-mix(in srgb, var(--brand-secondary) 64%, #020617) 52%, color-mix(in srgb, var(--brand-accent) 44%, #020617) 100%)',
        }}
      />

      {/* Open Top Bar (No Box) */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-6 flex items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3.5 min-w-0"
        >
          <CompanyLogo logoUrl={companyLogo} companyName={companyName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
              PERHITUNGAN PEMBAYARAN PEMBELIAN TBS
            </h1>
            <p className="text-xs font-semibold text-brand-highlight truncate">
              {showSubtitle ? `${companyName} — ${companySubtitle}` : companyName}
            </p>
          </div>
        </motion.div>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Lewati</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Center Open-Canvas Animated Weighbridge Panorama */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-4">
        <MillWeighbridgeScene phase={phase} weightKg={weightKg} />
      </main>

      {/* Open Bottom Status & Integrated Progress Track (No Box) */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 pb-7 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-white">{phaseSubtitle}</p>
            <p className="text-[11px] text-slate-300">{statusText}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-200 whitespace-nowrap shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span>Kesiapan Sistem</span>
            <span aria-hidden="true">·</span>
            <span>Terproteksi Akses</span>
          </div>
        </div>

        {/* Sleek Roadway Progress Track */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                phase === 'verified'
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : 'linear-gradient(90deg, var(--brand-accent), var(--brand-highlight))',
            }}
            initial={{ width: '10%' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </footer>
    </div>
  );
};
