import React from 'react';
import { motion } from 'motion/react';

export type WeighbridgePhase = 'entering' | 'weighing' | 'verified';

interface MillWeighbridgeSceneProps {
  phase: WeighbridgePhase;
  weightKg: number;
}

const Wheel: React.FC<{ cx: number; cy: number; spinning: boolean }> = ({
  cx,
  cy,
  spinning,
}) => (
  <g transform={`translate(${cx}, ${cy})`}>
    <g className={spinning ? 'truck-wheel-spin' : undefined}>
      <circle r="17" fill="#0F172A" stroke="#334155" strokeWidth="2.5" />
      <circle r="10.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.6" />
      <line x1="-8" y1="0" x2="8" y2="0" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="0" y1="-8" x2="0" y2="8" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
      <circle r="3.4" fill="#FACC15" />
    </g>
  </g>
);

export const MillWeighbridgeScene: React.FC<MillWeighbridgeSceneProps> = ({
  phase,
  weightKg,
}) => {
  const isMoving = phase === 'entering' || phase === 'verified';
  const gateOpen = phase === 'entering' || phase === 'weighing' || phase === 'verified';
  const formattedWeight = weightKg.toLocaleString('id-ID');

  return (
    <div
      data-testid="mill-weighbridge-scene"
      data-phase={phase}
      className="w-full max-w-5xl mx-auto px-2 sm:px-6 select-none"
    >
      <svg
        viewBox="0 0 960 330"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Animasi truk pengangkutan TBS sawit menimbang di jembatan timbang pabrik"
      >
        <defs>
          <linearGradient id="headlightBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="millBodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="tankGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="45%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="truckCabGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="cargoBedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="roadSurface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.96" />
          </linearGradient>
        </defs>

        {/* Distant Oil Palm Plantation Hills Silhouette */}
        <path
          d="M0 264 Q155 214 340 242 T690 226 T960 236 V264 H0 Z"
          fill="rgba(15, 23, 42, 0.45)"
        />

        {/* Stylized Background Oil Palm Trees */}
        {[
          { x: 68, y: 264, s: 0.9 },
          { x: 146, y: 264, s: 0.72 },
          { x: 912, y: 264, s: 0.85 },
        ].map((tree, idx) => (
          <g
            key={idx}
            transform={`translate(${tree.x}, ${tree.y}) scale(${tree.s})`}
            opacity="0.65"
          >
            <path d="M0 0 Q3 -28 1 -56" stroke="#1E293B" strokeWidth="5.5" strokeLinecap="round" />
            <path
              d="M1 -56 Q-22 -66 -32 -48 M1 -56 Q-18 -76 -28 -68 M1 -56 Q4 -82 14 -72 M1 -56 Q24 -70 34 -50 M1 -56 Q22 -52 26 -38"
              stroke="#065F46"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Active Palm Oil Mill Complex (Right Background) */}
        <g>
          {/* Boiler Chimneys with Rising Animated Steam Puffs */}
          <rect x="652" y="88" width="13" height="86" rx="2" fill="#334155" />
          <rect x="650" y="86" width="17" height="5" rx="1.5" fill="#F59E0B" />
          <rect x="682" y="102" width="11" height="72" rx="2" fill="#334155" />
          <rect x="680" y="100" width="15" height="4.5" rx="1.5" fill="#F59E0B" />

          {/* Animated Rising Steam Plumes */}
          <g transform="translate(658, 78)">
            <circle cx="0" cy="0" r="8" fill="#E2E8F0" className="mill-steam-puff-1" />
            <circle cx="4" cy="-4" r="10" fill="#F8FAFC" className="mill-steam-puff-2" />
            <circle cx="-2" cy="-2" r="7" fill="#CBD5E1" className="mill-steam-puff-3" />
          </g>
          <g transform="translate(687, 94)">
            <circle cx="0" cy="0" r="6.5" fill="#E2E8F0" className="mill-steam-puff-2" />
            <circle cx="3" cy="-3" r="8.5" fill="#F8FAFC" className="mill-steam-puff-3" />
          </g>

          {/* Main Mill Structure & Sawtooth Roof */}
          <path
            d="M610 174 L638 148 L638 164 L672 142 L672 162 L710 142 L788 162 V264 H610 Z"
            fill="url(#millBodyGrad)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1.4"
          />
          {/* Loading Bay Canopy */}
          <path d="M594 202 L614 190 H646 V264 H610 V206 Z" fill="#1E293B" />

          {/* Glowing Warm Factory Windows */}
          {[628, 654, 680, 706, 732, 758].map((wx, i) => (
            <rect
              key={wx}
              x={wx}
              y={178}
              width="14"
              height="16"
              rx="2"
              fill={i % 2 === 0 ? '#FACC15' : '#F59E0B'}
              opacity="0.82"
            />
          ))}
          {[654, 680, 706, 732].map((wx) => (
            <rect
              key={`row2-${wx}`}
              x={wx}
              y={208}
              width="14"
              height="12"
              rx="2"
              fill="#38BDF8"
              opacity="0.32"
            />
          ))}

          {/* Mill Signage */}
          <rect
            x="644"
            y="234"
            width="112"
            height="18"
            rx="4"
            fill="rgba(2, 6, 23, 0.68)"
            stroke="rgba(250, 204, 21, 0.35)"
          />
          <text
            x="700"
            y="246"
            textAnchor="middle"
            fill="#FACC15"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.2"
          >
            SEBAWI PALM MILL
          </text>

          {/* Cylindrical CPO Storage Tanks */}
          {[804, 838, 872].map((tx, idx) => (
            <g key={tx}>
              <rect
                x={tx}
                y={184 + (idx === 2 ? 12 : 0)}
                width="26"
                height={80 - (idx === 2 ? 12 : 0)}
                rx="3"
                fill="url(#tankGrad)"
                stroke="rgba(255,255,255,0.18)"
              />
              <ellipse
                cx={tx + 13}
                cy={184 + (idx === 2 ? 12 : 0)}
                rx="13"
                ry="4.5"
                fill="#94A3B8"
              />
            </g>
          ))}
        </g>

        {/* Secondary Queued TBS Truck behind Entry Gate */}
        <motion.g
          initial={{ x: -34, opacity: 0.72 }}
          animate={{
            x: phase === 'entering' ? -14 : phase === 'weighing' ? 0 : 12,
            opacity: 0.86,
          }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Compact Queued Dump Truck */}
          <rect x="38" y="210" width="76" height="32" rx="4" fill="#1E293B" stroke="#475569" strokeWidth="1.2" />
          {/* TBS Heap on Queued Truck */}
          <path d="M44 210 Q60 192 80 198 Q98 188 110 210 Z" fill="#D97706" />
          <circle cx="62" cy="203" r="5" fill="#F59E0B" />
          <circle cx="82" cy="201" r="5.5" fill="#EA580C" />
          <circle cx="96" cy="204" r="4.5" fill="#FACC15" />
          {/* Queued Truck Cab */}
          <path d="M116 214 H142 L150 227 V244 H116 Z" fill="#0F766E" />
          <path d="M126 218 H139 L145 227 H126 Z" fill="#BAE6FD" opacity="0.85" />
          {/* Queued Truck Wheels */}
          <circle cx="58" cy="249" r="10.5" fill="#0F172A" stroke="#64748B" strokeWidth="2" />
          <circle cx="98" cy="249" r="10.5" fill="#0F172A" stroke="#64748B" strokeWidth="2" />
          <circle cx="136" cy="249" r="10.5" fill="#0F172A" stroke="#64748B" strokeWidth="2" />
        </motion.g>

        {/* Entry Security Booth & Animated Lifting Barrier Gate */}
        <g>
          <rect x="184" y="206" width="32" height="58" rx="4" fill="#1E293B" stroke="rgba(255,255,255,0.2)" />
          <rect x="190" y="214" width="20" height="16" rx="2" fill="#38BDF8" opacity="0.7" />
          <rect x="220" y="228" width="12" height="36" rx="2" fill="#475569" />
          {/* Animated Boom Barrier Arm */}
          <g transform="translate(226, 234)">
            <motion.g
              initial={{ rotate: 0 }}
              animate={{ rotate: gateOpen ? -68 : 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: '0px 0px' }}
            >
              <rect x="0" y="-3.5" width="66" height="6.5" rx="3" fill="#F8FAFC" />
              <rect x="12" y="-3.5" width="11" height="6.5" fill="#EF4444" />
              <rect x="34" y="-3.5" width="11" height="6.5" fill="#EF4444" />
              <circle cx="0" cy="0" r="5" fill="#FACC15" />
            </motion.g>
          </g>
        </g>

        {/* Live Digital Weighbridge Indicator Tower */}
        <g>
          {/* Steel Support Pole */}
          <rect x="526" y="122" width="7" height="142" fill="#475569" />
          {/* Scoreboard Housing positioned cleanly above truck & heaped TBS */}
          <rect
            x="436"
            y="54"
            width="174"
            height="72"
            rx="10"
            fill="#0F172A"
            stroke={phase === 'verified' ? '#34D399' : '#FACC15'}
            strokeWidth="2"
          />
          <text
            x="449"
            y="73"
            fill="#94A3B8"
            fontSize="9.5"
            fontWeight="700"
            letterSpacing="0.5"
          >
            TIMBANGAN BRUTO TBS
          </text>
          {/* Status Indicator Dot on Board */}
          <circle
            cx="596"
            cy="70"
            r="4"
            fill={phase === 'verified' ? '#34D399' : '#FACC15'}
          />
          {/* Digital Weight Readout */}
          <text
            x="523"
            y="103"
            textAnchor="middle"
            fill={phase === 'verified' ? '#34D399' : '#FACC15'}
            fontSize="24"
            fontWeight="700"
            className="font-mono-num"
          >
            {formattedWeight} KG
          </text>
          <text
            x="523"
            y="117"
            textAnchor="middle"
            fill={phase === 'verified' ? '#A7F3D0' : '#CBD5E1'}
            fontSize="8.5"
            fontWeight="600"
          >
            {phase === 'entering'
              ? 'TRUK MEMASUKI PLATFORM'
              : phase === 'weighing'
                ? 'MENGHITUNG BERAT MUATAN...'
                : 'BERAT TERVERIFIKASI'}
          </text>
        </g>

        {/* Exit Traffic Signal Post */}
        <g>
          <rect x="556" y="196" width="5" height="68" fill="#475569" />
          <rect x="550" y="182" width="17" height="34" rx="4" fill="#0F172A" stroke="#334155" />
          <circle
            cx="558.5"
            cy="192"
            r="4.2"
            fill={phase === 'verified' ? '#334155' : '#F59E0B'}
          />
          <circle
            cx="558.5"
            cy="206"
            r="4.2"
            fill={phase === 'verified' ? '#34D399' : '#1E293B'}
          />
        </g>

        {/* Road & Weighbridge Platform Base */}
        <rect x="0" y="264" width="960" height="52" rx="8" fill="url(#roadSurface)" />
        {/* Road Lane Dashes */}
        {[40, 120, 200, 620, 700, 780, 860].map((lx) => (
          <rect key={lx} x={lx} y="288" width="42" height="3" rx="1.5" fill="rgba(255,255,255,0.22)" />
        ))}

        {/* Weighbridge Steel Deck & Load Cells */}
        <g>
          <rect
            x="278"
            y="258"
            width="256"
            height="12"
            rx="3"
            fill="#334155"
            stroke={phase === 'verified' ? '#34D399' : '#FACC15'}
            strokeWidth="1.6"
          />
          {/* Glowing Load-Cell Sensors Underneath Deck */}
          {[312, 376, 440, 502].map((sx) => (
            <rect
              key={sx}
              x={sx}
              y="270"
              width="16"
              height="4"
              rx="2"
              fill={phase === 'verified' ? '#34D399' : phase === 'weighing' ? '#FACC15' : '#64748B'}
            />
          ))}
          <text
            x="406"
            y="293"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="9"
            fontWeight="700"
            letterSpacing="2"
          >
            JEMBATAN TIMBANG DIGITAL
          </text>
        </g>

        {/* MAIN MOVING TBS SAWIT DUMP TRUCK */}
        <motion.g
          initial={{ x: -245, y: 0 }}
          animate={{
            x: phase === 'entering' ? -10 : phase === 'weighing' ? 0 : 78,
            y: phase === 'weighing' ? [0, 3.5, 1.5] : 0,
          }}
          transition={{
            x: { duration: phase === 'entering' ? 0.95 : 0.85, ease: [0.16, 1, 0.3, 1] },
            y: { duration: 0.45, ease: 'easeOut' },
          }}
        >
          {/* Warm Headlight Cone */}
          <polygon points="496,216 575,198 575,244 496,232" fill="url(#headlightBeam)" />

          {/* Truck Chassis Frame */}
          <rect x="298" y="224" width="194" height="11" rx="3" fill="#0F172A" />

          {/* Heavy-Duty Cargo Bed */}
          <path
            d="M294 170 H434 V224 H294 Z"
            fill="url(#cargoBedGrad)"
            stroke="#64748B"
            strokeWidth="1.6"
          />
          {/* Bed Ribs */}
          {[322, 352, 382, 412].map((rx) => (
            <line key={rx} x1={rx} y1="173" x2={rx} y2="221" stroke="#475569" strokeWidth="2.5" />
          ))}

          {/* Heaped Fresh Palm Fruit Bunches (TBS Kelapa Sawit) */}
          <g>
            <path
              d="M298 170 Q320 142 350 148 Q380 132 410 148 Q426 146 431 170 Z"
              fill="#B45309"
            />
            {[
              { cx: 318, cy: 162, r: 9, c: '#D97706' },
              { cx: 336, cy: 155, r: 10.5, c: '#EA580C' },
              { cx: 356, cy: 158, r: 10, c: '#F59E0B' },
              { cx: 375, cy: 148, r: 11, c: '#D97706' },
              { cx: 394, cy: 155, r: 10, c: '#EA580C' },
              { cx: 414, cy: 161, r: 9, c: '#F59E0B' },
              { cx: 348, cy: 165, r: 8, c: '#FACC15' },
              { cx: 384, cy: 163, r: 8.5, c: '#FACC15' },
            ].map((tbs, i) => (
              <g key={i}>
                <circle cx={tbs.cx} cy={tbs.cy} r={tbs.r} fill={tbs.c} />
                <circle cx={tbs.cx - 2} cy={tbs.cy - 2} r={tbs.r * 0.35} fill="#FEF08A" opacity="0.55" />
              </g>
            ))}
          </g>

          {/* Truck Exhaust Stack */}
          <rect x="436" y="156" width="5" height="62" rx="2" fill="#64748B" />

          {/* Main Truck Cab */}
          <path
            d="M442 174 H478 L496 198 V226 H442 Z"
            fill="url(#truckCabGrad)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.4"
          />
          {/* Cab Windshield & Window */}
          <path d="M454 180 H475 L488 197 H454 Z" fill="#E0F2FE" opacity="0.92" />
          {/* Cab Door Accent & Company Stripe */}
          <rect x="444" y="205" width="46" height="4" rx="2" fill="#FACC15" />
          {/* Headlight & Bumper */}
          <rect x="490" y="212" width="7" height="7" rx="2" fill="#FEF08A" />
          <rect x="488" y="222" width="12" height="7" rx="2" fill="#94A3B8" />

          {/* Rotating Wheels */}
          <Wheel cx={326} cy={243} spinning={isMoving} />
          <Wheel cx={372} cy={243} spinning={isMoving} />
          <Wheel cx={470} cy={243} spinning={isMoving} />
        </motion.g>
      </svg>
    </div>
  );
};
