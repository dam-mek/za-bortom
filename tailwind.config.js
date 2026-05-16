/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === Заблокированная палитра (см. docs/design-roadmap.md §2) ===
        // Бумага / чернила — управляются CSS-переменными в theme.tsx.
        paper: 'var(--bg-paper, #f1e6cf)',
        'paper-deep': 'var(--bg-paper-deep, #d9c8a0)',
        ink: 'var(--ink, #1a2438)',
        'ink-faint': 'var(--ink-faint, #4a5572)',
        accent: '#F2C500',
        // Фон фазы.
        'sea-day': '#0EA5E9',
        'sea-morning': '#E8B873',
        'sea-evening': '#3F3DA8',
        'sea-night': '#0A0B14',
        // Карты — фиксированные цвета из макета.
        'card-supply': '#6B8EA8',
        'card-supply-shadow': '#3F5366',
        'card-character': '#C8C8C8',
        'card-character-deep': '#9a9a9a',
        'frame-wood': '#8B6F4E',
        'frame-wood-deep': '#5e4831',
        'card-nav': '#5BB5A8',
        'card-nav-shadow': '#2f6e64',
        'card-enemy': '#8C2C3D',
        'card-enemy-deep': '#5a1925',
        'card-friend': '#6E4878',
        'card-friend-deep': '#42284c',
        inventory: '#5E5E5E',
        'inventory-deep': '#3a3a3a',
        'slot-empty': '#7BB0D6',
        'slot-empty-deep': '#4e7a99',
        'frame-crimson': '#7C2424',
        'frame-crimson-deep': '#4f1313',
        'horizon-indigo': '#3F3DA8',
      },
      fontFamily: {
        // Marck Script — премиальный перо-скрипт (рукописные заголовки/имена)
        hand: ['"Marck Script"', '"Caveat"', 'cursive'],
        // Forum — классическая римская засечка, ощущение книжной гравировки (штампы, фазы)
        stamp: ['"Forum"', '"Cinzel"', 'Georgia', 'serif'],
        // Cormorant Garamond — книжная антиква для body (правила, описания, журнал)
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        // IBM Plex Mono — характерный моноширинный (статы, числа, ID)
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateX(0) translateY(0)' },
          '50%': { transform: 'translateX(-8px) translateY(-2px)' },
        },
        breath: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.005)', opacity: '0.97' },
        },
        'fog-drift': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '0.5' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'ink-drop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '40%': { opacity: '0.9' },
          '100%': { transform: 'scale(1)', opacity: '0.75' },
        },
        'gold-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(242, 197, 0, 0)',
            filter: 'brightness(1)',
          },
          '50%': {
            boxShadow: '0 0 18px 3px rgba(242, 197, 0, 0.55)',
            filter: 'brightness(1.05)',
          },
        },
        'page-flip': {
          '0%': { transform: 'rotateY(-90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0)', opacity: '1' },
        },
        'star-twinkle': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        wave: 'wave 7s ease-in-out infinite',
        breath: 'breath 4s ease-in-out infinite',
        'fog-drift': 'fog-drift 28s linear infinite',
        'ink-drop': 'ink-drop 600ms ease-out forwards',
        'gold-pulse': 'gold-pulse 2.4s ease-in-out infinite',
        'page-flip': 'page-flip 800ms ease-out backwards',
        'star-twinkle': 'star-twinkle 3.5s ease-in-out infinite',
      },
      boxShadow: {
        wood: 'inset 0 0 0 2px #8B6F4E, inset 0 0 0 4px #5e4831, 0 2px 6px rgba(20, 16, 8, 0.3)',
        emboss: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.18)',
        gold: '0 0 0 1px rgba(242,197,0,0.4), 0 0 18px rgba(242,197,0,0.35)',
        'fight-attacker': '0 -4px 24px rgba(140, 44, 61, 0.65), 0 0 0 2px rgba(140, 44, 61, 0.4)',
        'fight-defender': '0 4px 24px rgba(180, 195, 210, 0.5), 0 0 0 2px rgba(180, 195, 210, 0.35)',
        journal: '0 6px 24px rgba(20, 16, 8, 0.35), 0 1px 0 rgba(255,240,210,0.4) inset',
      },
      backgroundImage: {
        'paper-grain':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        'parchment-radial':
          'radial-gradient(ellipse at center, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 75%, #b8a279 100%)',
      },
      letterSpacing: {
        stamp: '0.18em',
      },
    },
  },
  plugins: [],
}
