import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Eye, Lock, Sparkles } from 'lucide-react';

export type RobotMood =
  | 'idle'
  | 'typing-username'
  | 'typing-password'
  | 'peeking-password'
  | 'loading'
  | 'success'
  | 'error';

interface SmartLoginRobotProps {
  mood: RobotMood;
  message: string;
  reactionKey: number;
}

const MOOD_META: Record<
  RobotMood,
  { label: string; accentClass: string; visorBorder: string; glowColor: string }
> = {
  idle: {
    label: 'Asisten Akses Mill',
    accentClass: 'text-brand-highlight',
    visorBorder: 'rgba(250, 204, 21, 0.45)',
    glowColor: 'rgba(16, 185, 129, 0.25)',
  },
  'typing-username': {
    label: 'Mengenali Pengguna',
    accentClass: 'text-sky-300',
    visorBorder: 'rgba(56, 189, 248, 0.55)',
    glowColor: 'rgba(56, 189, 248, 0.28)',
  },
  'typing-password': {
    label: 'Mode Privasi Aktif',
    accentClass: 'text-emerald-300',
    visorBorder: 'rgba(52, 211, 153, 0.55)',
    glowColor: 'rgba(16, 185, 129, 0.28)',
  },
  'peeking-password': {
    label: 'Password Terlihat',
    accentClass: 'text-amber-300',
    visorBorder: 'rgba(251, 191, 36, 0.6)',
    glowColor: 'rgba(251, 191, 36, 0.25)',
  },
  loading: {
    label: 'Memverifikasi Kredensial',
    accentClass: 'text-sky-300',
    visorBorder: 'rgba(56, 189, 248, 0.7)',
    glowColor: 'rgba(56, 189, 248, 0.35)',
  },
  success: {
    label: 'Login Berhasil',
    accentClass: 'text-emerald-300',
    visorBorder: 'rgba(52, 211, 153, 0.9)',
    glowColor: 'rgba(16, 185, 129, 0.48)',
  },
  error: {
    label: 'Autentikasi Ditolak',
    accentClass: 'text-rose-300',
    visorBorder: 'rgba(251, 113, 133, 0.85)',
    glowColor: 'rgba(244, 63, 94, 0.4)',
  },
};

export const SmartLoginRobot: React.FC<SmartLoginRobotProps> = ({
  mood,
  message,
  reactionKey,
}) => {
  const meta = MOOD_META[mood];

  const bodyAnimate =
    mood === 'error'
      ? {
          x: [0, -8, 8, -6, 6, -3, 0],
          rotate: [0, -5, 5, -3, 3, 0],
          y: [0, 2, 0],
        }
      : mood === 'success'
        ? {
            y: [0, -10, 0, -6, 0],
            scale: [1, 1.08, 1, 1.04, 1],
            rotate: [0, -3, 3, 0],
          }
        : mood === 'loading'
          ? {
              y: [0, -3, 0],
              rotate: [-1.5, 1.5, -1.5],
            }
          : mood === 'typing-username'
            ? {
                y: [0, -3, 0],
                rotate: 4,
              }
            : {
                y: [0, -4, 0],
                rotate: 0,
              };

  const bodyTransition =
    mood === 'error'
      ? { duration: 0.55, ease: 'easeInOut' as const }
      : mood === 'success'
        ? { duration: 0.8, ease: 'easeOut' as const }
        : mood === 'loading'
          ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' as const }
          : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <div
      data-testid="smart-login-robot"
      data-mood={mood}
      className="relative mt-5 rounded-xl border border-white/15 bg-slate-950/35 p-3.5 transition-colors duration-300"
      style={{
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px -10px ${meta.glowColor}`,
      }}
    >
      <div className="flex items-center gap-3.5">
        {/* Animated Smart Robot Avatar Stage */}
        <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
          {/* Ambient radial core glow synced with mood */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-1 rounded-full transition-all duration-300"
            style={{
              background: `radial-gradient(circle, ${meta.glowColor} 0%, transparent 72%)`,
            }}
          />

          {/* Celebratory starlight particles on login success */}
          <AnimatePresence>
            {mood === 'success' && (
              <motion.div
                key={`sparks-${reactionKey}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.15 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <span className="absolute -top-1 left-2 h-2 w-2 rounded-full bg-emerald-300" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="absolute bottom-2 left-0 h-1.5 w-1.5 rounded-full bg-amber-200" />
                <span className="absolute -bottom-0.5 right-2.5 h-2 w-2 rounded-full bg-emerald-400" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            key={`${mood === 'error' || mood === 'success' ? reactionKey : 'steady'}`}
            animate={bodyAnimate}
            transition={bodyTransition}
            className="relative z-10"
          >
            <svg
              width="74"
              height="74"
              viewBox="0 0 84 84"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="robotBodyGrad" x1="16" y1="18" x2="68" y2="74" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#F8FAFC" />
                  <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
                <linearGradient id="robotVisorGrad" x1="20" y1="26" x2="64" y2="52" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0F172A" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
              </defs>

              {/* Antenna Stem */}
              <path d="M42 18V9" stroke="#CBD5E1" strokeWidth="2.8" strokeLinecap="round" />

              {/* Antenna Signal Bulb */}
              <motion.circle
                cx="42"
                cy="7.5"
                r="4"
                animate={{
                  scale: mood === 'loading' || mood === 'error' ? [1, 1.35, 1] : [1, 1.15, 1],
                }}
                transition={{
                  duration: mood === 'loading' ? 0.6 : mood === 'error' ? 0.45 : 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                fill={
                  mood === 'error'
                    ? '#FB7185'
                    : mood === 'success'
                      ? '#34D399'
                      : mood === 'loading' || mood === 'typing-username'
                        ? '#38BDF8'
                        : '#FACC15'
                }
              />

              {/* Ear Audio Pods */}
              <rect x="9.5" y="31" width="6" height="16" rx="3" fill="#94A3B8" />
              <rect x="68.5" y="31" width="6" height="16" rx="3" fill="#94A3B8" />
              <circle
                cx="12.5"
                cy="39"
                r="1.6"
                fill={mood === 'error' ? '#FB7185' : mood === 'success' ? '#34D399' : '#38BDF8'}
              />
              <circle
                cx="71.5"
                cy="39"
                r="1.6"
                fill={mood === 'error' ? '#FB7185' : mood === 'success' ? '#34D399' : '#38BDF8'}
              />

              {/* Robot Head Chassis */}
              <rect
                x="15"
                y="18"
                width="54"
                height="43"
                rx="14"
                fill="url(#robotBodyGrad)"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.5"
              />

              {/* Visor Frame */}
              <rect
                x="21"
                y="24"
                width="42"
                height="28"
                rx="9"
                fill="url(#robotVisorGrad)"
                stroke={meta.visorBorder}
                strokeWidth="1.8"
              />

              {/* Expressive Eyes & Visor Graphics by Mood */}
              {mood === 'success' ? (
                <g>
                  {/* Happy curved ^ ^ eyes */}
                  <path
                    d="M28 38C29.5 34.5 33.5 34.5 35 38"
                    stroke="#34D399"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M49 38C50.5 34.5 54.5 34.5 56 38"
                    stroke="#34D399"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  {/* Cheerful smile */}
                  <path
                    d="M36 44C39 47.5 45 47.5 48 44"
                    stroke="#A7F3D0"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                  />
                </g>
              ) : mood === 'error' ? (
                <g>
                  {/* Alert > < eyes */}
                  <path
                    d="M29 33L34 36.5L29 40"
                    stroke="#FB7185"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M55 33L50 36.5L55 40"
                    stroke="#FB7185"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Frown */}
                  <path
                    d="M36 46C39 43 45 43 48 46"
                    stroke="#FDA4AF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>
              ) : mood === 'typing-password' ? (
                <g>
                  {/* Privacy shield closed eyes */}
                  <path
                    d="M27.5 37H35.5"
                    stroke="#34D399"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M48.5 37H56.5"
                    stroke="#34D399"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  {/* Small lock dot */}
                  <circle cx="42" cy="44.5" r="2" fill="#34D399" opacity="0.85" />
                </g>
              ) : mood === 'peeking-password' ? (
                <g>
                  {/* One closed, one peeking eye */}
                  <path
                    d="M27.5 37H35.5"
                    stroke="#FBBF24"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="52.5" cy="36.5" r="4.2" fill="#FBBF24" />
                  <circle cx="53.5" cy="36.5" r="1.7" fill="#0F172A" />
                  <path
                    d="M38 45H46"
                    stroke="#FDE68A"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              ) : mood === 'loading' ? (
                <g>
                  {/* Scanning animated eyes */}
                  <motion.rect
                    x="27"
                    y="33"
                    width="9"
                    height="7"
                    rx="3.5"
                    fill="#38BDF8"
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  />
                  <motion.rect
                    x="48"
                    y="33"
                    width="9"
                    height="7"
                    rx="3.5"
                    fill="#38BDF8"
                    animate={{ opacity: [1, 0.45, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  />
                  <motion.rect
                    x="35"
                    y="44"
                    width="14"
                    height="2.4"
                    rx="1.2"
                    fill="#7DD3FC"
                    animate={{ scaleX: [0.5, 1.1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    style={{ originX: '42px' }}
                  />
                </g>
              ) : (
                <g>
                  {/* Idle / Typing-username attentive blinking eyes */}
                  <motion.g
                    animate={{
                      x: mood === 'typing-username' ? 2 : 0,
                      scaleY: [1, 1, 0.12, 1, 1],
                    }}
                    transition={{
                      x: { duration: 0.25 },
                      scaleY: { duration: 4.2, repeat: Infinity, times: [0, 0.46, 0.49, 0.52, 1] },
                    }}
                    style={{ originY: '36.5px' }}
                  >
                    <rect x="28" y="32.5" width="7.5" height="8" rx="3.75" fill="#38BDF8" />
                    <circle cx="33" cy="34.5" r="1.2" fill="#E0F2FE" />
                    <rect x="48.5" y="32.5" width="7.5" height="8" rx="3.75" fill="#38BDF8" />
                    <circle cx="53.5" cy="34.5" r="1.2" fill="#E0F2FE" />
                  </motion.g>
                  <path
                    d="M36.5 44.5C39.2 46.8 44.8 46.8 47.5 44.5"
                    stroke="#94A3B8"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* Collar & Smart Core */}
              <rect x="27" y="63" width="30" height="12" rx="6" fill="#334155" />
              <circle
                cx="42"
                cy="69"
                r="3.2"
                fill={
                  mood === 'error'
                    ? '#FB7185'
                    : mood === 'success'
                      ? '#34D399'
                      : '#FACC15'
                }
              />

              {/* Articulated Robot Hands (Raise to cover visor when typing password, wave on success) */}
              <motion.g
                animate={
                  mood === 'typing-password'
                    ? { y: -22, x: 7, rotate: 12 }
                    : mood === 'success'
                      ? { y: -12, x: -4, rotate: -22 }
                      : { y: 0, x: 0, rotate: 0 }
                }
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ originX: '17px', originY: '66px' }}
              >
                <rect
                  x="11"
                  y="60"
                  width="11"
                  height="11"
                  rx="5.5"
                  fill="#E2E8F0"
                  stroke="#94A3B8"
                  strokeWidth="1.4"
                />
              </motion.g>

              <motion.g
                animate={
                  mood === 'typing-password'
                    ? { y: -22, x: -7, rotate: -12 }
                    : mood === 'success'
                      ? { y: -16, x: 4, rotate: 24 }
                      : { y: 0, x: 0, rotate: 0 }
                }
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ originX: '67px', originY: '66px' }}
              >
                <rect
                  x="62"
                  y="60"
                  width="11"
                  height="11"
                  rx="5.5"
                  fill="#E2E8F0"
                  stroke="#94A3B8"
                  strokeWidth="1.4"
                />
              </motion.g>
            </svg>
          </motion.div>
        </div>

        {/* Live Smart Robot Notification Speech Panel */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide">
            {mood === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            ) : mood === 'error' ? (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-300 shrink-0" />
            ) : mood === 'typing-password' ? (
              <Lock className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            ) : mood === 'peeking-password' ? (
              <Eye className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-brand-highlight shrink-0" />
            )}
            <span className={meta.accentClass}>{meta.label}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={`${mood}-${message}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mt-1 text-xs leading-relaxed text-slate-100/95"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
