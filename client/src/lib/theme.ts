/**
 * theme.ts — MemeRush Shared Design System
 * Import this in both homepage and trade page.
 * Zero external dependencies. Pure TypeScript constants.
 *
 * Usage:
 *   import { T, cls, btn, card } from '@/lib/theme';
 *   <button style={btn.primary}>Enter Arena</button>
 *   <div style={card.base}>...</div>
 */

// ── PALETTE ───────────────────────────────────────────────────────────────────
export const T = {
  // Background layers
  bg: {
    page:    '#040410',               // root page background
    header:  'rgba(5,3,1,.94)',       // sticky header
    card:    'rgba(10,10,22,.98)',    // default card
    cardWarm:'rgba(12,6,2,.98)',      // warm-tinted card (real battles)
    input:   'rgba(15,10,5,.85)',     // input fields
    modal:   'rgba(12,6,2,.98)',      // modal sheets
    overlay: 'rgba(0,0,0,.85)',       // modal backdrop
    ticker:  'rgba(8,4,2,.97)',       // status ticker bar
    nav:     'rgba(5,3,1,.97)',       // bottom nav
  },

  // Orange primary
  orange: {
    50:  'rgba(249,115,22,.05)',
    100: 'rgba(249,115,22,.10)',
    200: 'rgba(249,115,22,.20)',
    300: 'rgba(249,115,22,.30)',
    400: '#fb923c',                   // orange-400
    500: '#f97316',                   // orange-500 — primary
    600: '#ea580c',                   // orange-600 — dark
    700: '#c2410c',                   // orange-700 — darker
    glow:'rgba(249,115,22,.35)',
    glow2:'rgba(234,88,12,.2)',
  },

  // Amber/yellow accent
  amber: {
    400: '#fbbf24',
    500: '#f59e0b',
    dim: 'rgba(251,191,36,.15)',
    border: 'rgba(251,191,36,.25)',
  },

  // Emerald — wins / confirmed / success
  green: {
    400: '#4ade80',
    500: '#22c55e',
    dim: 'rgba(74,222,128,.08)',
    border: 'rgba(74,222,128,.25)',
    deep:  'rgba(6,78,59,.4)',
  },

  // Red — ending / loss / danger
  red: {
    400: '#f87171',
    500: '#ef4444',
    dim: 'rgba(239,68,68,.12)',
    border: 'rgba(239,68,68,.4)',
  },

  // Cyan — on-chain links / tx hashes
  cyan: {
    400: '#22d3ee',
    dim: 'rgba(34,211,238,.1)',
  },

  // Neutral slate
  slate: {
    border: 'rgba(30,41,59,.55)',
    borderSoft: 'rgba(255,255,255,.05)',
    borderHard: 'rgba(255,255,255,.10)',
    dim: 'rgba(71,85,105,.5)',
    text1: 'rgba(226,232,240,1)',     // slate-200
    text2: 'rgba(148,163,184,1)',     // slate-400
    text3: 'rgba(100,116,139,1)',     // slate-500
    text4: 'rgba(71,85,105,1)',       // slate-600 — muted
  },
} as const;

// ── GRADIENTS ─────────────────────────────────────────────────────────────────
export const G = {
  // Primary CTA gradient
  primary:   'linear-gradient(135deg,#ea580c,#f97316)',
  primarySoft:'linear-gradient(135deg,rgba(234,88,12,.6),rgba(249,115,22,.4))',

  // Brand gradient (logo / headings)
  brand:     'linear-gradient(90deg,#fb923c,#fbbf24)',

  // Battle progress bars
  barNormal: 'linear-gradient(90deg,#f97316,#fbbf24)',
  barUrgent: 'linear-gradient(90deg,#ef4444,#f97316)',
  barHigh:   'linear-gradient(90deg,#ef4444,#dc2626)',

  // Card top accent lines
  accentOrange: 'linear-gradient(90deg,transparent,#f97316,transparent)',
  accentRed:    'linear-gradient(90deg,transparent,#ef4444,transparent)',
  accentSlate:  'linear-gradient(90deg,transparent,rgba(71,85,105,.4),transparent)',

  // Battle leading side
  leadingBg: 'rgba(16,185,129,.07)',
} as const;

// ── SHADOWS / GLOWS ───────────────────────────────────────────────────────────
export const S = {
  primaryBtn: '0 0 0 1px rgba(255,255,255,.08), 0 8px 32px rgba(249,115,22,.5), 0 3px 14px rgba(234,88,12,.3)',
  primaryBtnSm: '0 0 14px rgba(249,115,22,.4)',
  realBattle:   '0 4px 24px rgba(249,115,22,.1)',
  hotBattle:    '0 2px 12px rgba(251,191,36,.06)',
  modal:        '0 24px 60px rgba(0,0,0,.6)',
} as const;

// ── INLINE STYLE OBJECTS (use with style={...}) ───────────────────────────────
export const btn = {
  /** Full orange CTA — hero / join / create */
  primary: {
    background: G.primary,
    boxShadow: S.primaryBtn,
  } as React.CSSProperties,

  /** Small orange — header buttons, compact CTAs */
  primarySm: {
    background: G.primary,
    boxShadow: S.primaryBtnSm,
  } as React.CSSProperties,

  /** Dim orange — disabled / secondary */
  ghost: {
    background: T.orange[200],
    border: `1px solid ${T.orange[300]}`,
  } as React.CSSProperties,

  /** Outline — secondary actions */
  outline: {
    background: 'transparent',
    border: `1px solid ${T.orange[300]}`,
    color: T.orange[500],
  } as React.CSSProperties,
} as const;

export const card = {
  /** Default dark card */
  base: {
    background: T.bg.card,
    border: `1px solid ${T.slate.borderSoft}`,
    borderRadius: '1rem',
  } as React.CSSProperties,

  /** Warm card for real / live battles */
  warm: {
    background: T.bg.cardWarm,
    border: `1px solid ${T.orange[200]}`,
    borderRadius: '1rem',
    boxShadow: S.realBattle,
  } as React.CSSProperties,

  /** Highlighted orange card */
  glow: {
    background: T.bg.cardWarm,
    border: `1px solid ${T.orange[300]}`,
    borderRadius: '1rem',
    boxShadow: S.primaryBtnSm,
  } as React.CSSProperties,
} as const;

// ── CSS CLASSES (Tailwind) ─────────────────────────────────────────────────────
/** Combine class strings, filtering falsy values */
export const cls = (...args: (string | false | undefined | null)[]): string =>
  args.filter(Boolean).join(' ');

// ── TYPOGRAPHY TOKENS ─────────────────────────────────────────────────────────
export const TXT = {
  heading:  'font-black text-white tracking-tight',
  label:    'text-[10px] font-black tracking-[.16em] uppercase',
  mono:     'font-mono tabular-nums',
  muted:    'text-slate-600',
  value:    'font-black tabular-nums',
  orange:   'text-orange-400',
  amber:    'text-amber-400',
  green:    'text-emerald-400',
  red:      'text-red-400',
} as const;

// ── ANIMATION CLASSES ─────────────────────────────────────────────────────────
export const ANIM = {
  pulse:  'animate-pulse',
  ping:   'animate-ping',
  spin:   'animate-spin',
  bounce: 'animate-bounce',
} as const;

// ── BADGE STYLES ──────────────────────────────────────────────────────────────
export const badge = {
  live: {
    background: 'rgba(16,185,129,.08)',
    border: '1px solid rgba(16,185,129,.2)',
    color: '#4ade80',
    borderRadius: '9999px',
    padding: '2px 10px',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '.12em',
  } as React.CSSProperties,

  real: {
    background: 'rgba(120,53,15,.55)',
    border: '1px solid rgba(251,191,36,.25)',
    color: '#fbbf24',
    borderRadius: '9999px',
    padding: '2px 8px',
    fontSize: '8px',
    fontWeight: 900,
  } as React.CSSProperties,

  hot: {
    background: 'rgba(154,52,18,.5)',
    border: '1px solid rgba(249,115,22,.35)',
    color: '#f97316',
    borderRadius: '9999px',
    padding: '2px 8px',
    fontSize: '8px',
    fontWeight: 900,
  } as React.CSSProperties,

  auto: {
    background: 'rgba(30,41,59,.5)',
    color: 'rgba(71,85,105,1)',
    borderRadius: '9999px',
    padding: '2px 8px',
    fontSize: '8px',
  } as React.CSSProperties,

  orange: {
    background: T.orange[100],
    border: `1px solid ${T.orange[200]}`,
    color: T.orange[500],
    borderRadius: '9999px',
    padding: '2px 10px',
    fontSize: '9px',
    fontWeight: 700,
  } as React.CSSProperties,
} as const;

// ── GLOBAL CSS STRING (inject into <style jsx global> or globals.css) ─────────
export const GLOBAL_CSS = `
  /* MemeRush Design System — global styles */
  :root {
    --mr-orange: #f97316;
    --mr-orange-dark: #ea580c;
    --mr-amber: #fbbf24;
    --mr-bg: #040410;
    --mr-card: rgba(10,10,22,.98);
    --mr-card-warm: rgba(12,6,2,.98);
    --mr-glow: 0 0 14px rgba(249,115,22,.4);
  }

  html, body {
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    background: #040410;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 2px; height: 2px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(249,115,22,.25); border-radius: 2px; }
  * { scrollbar-width: thin; scrollbar-color: rgba(249,115,22,.2) transparent; }

  /* Remove number input spinners */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { opacity: 0.4; }

  /* Tap highlight */
  * { -webkit-tap-highlight-color: transparent; }

  /* Details/summary */
  details > summary { -webkit-user-select: none; user-select: none; }

  /* Scrollbar-none utility */
  .scrollbar-none { scrollbar-width: none; }
  .scrollbar-none::-webkit-scrollbar { display: none; }

  /* Animations */
  @keyframes mr-fade-up {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes mr-glow-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(249,115,22,.25); }
    50%       { box-shadow: 0 0 24px rgba(249,115,22,.55); }
  }
  @keyframes mr-slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }

  .mr-fade-up   { animation: mr-fade-up .2s ease-out; }
  .mr-slide-up  { animation: mr-slide-up .25s ease-out; }
  .mr-glow-btn:hover { animation: mr-glow-pulse 1.5s ease-in-out infinite; }

  /* Wallet adapter override — orange theme */
  .wallet-adapter-button {
    background: linear-gradient(135deg,#ea580c,#f97316) !important;
    border-radius: 0.75rem !important;
    font-weight: 900 !important;
    font-size: 12px !important;
    padding: 8px 12px !important;
    height: auto !important;
    box-shadow: 0 0 14px rgba(249,115,22,.35) !important;
  }
  .wallet-adapter-button:hover {
    background: linear-gradient(135deg,#f97316,#fbbf24) !important;
    box-shadow: 0 0 22px rgba(249,115,22,.55) !important;
  }
  .wallet-adapter-modal-wrapper {
    background: rgba(12,6,2,.98) !important;
    border: 1px solid rgba(249,115,22,.3) !important;
  }
`;
