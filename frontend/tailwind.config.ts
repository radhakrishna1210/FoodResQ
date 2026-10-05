import type { Config } from 'tailwindcss';

// Design tokens: WALKTHROUGH.md §5.1
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B70BE', 50: '#EAF2FB', 100: '#D3E4F5', 600: '#1B70BE', 700: '#165C9C' },
        teal: { DEFAULT: '#27B5C9', 50: '#E7F7FA', 100: '#C9EEF4', 700: '#1C8999' },
        purple: { DEFAULT: '#715BB0', 50: '#F1EEF8', 100: '#E0DAF0', 700: '#5A4790' },
        gold: { DEFAULT: '#B8860B', 50: '#FBF5E6', 100: '#F4E6C0', 700: '#8F6808' },
        red: { DEFAULT: '#D9534F', 50: '#FCEDEC', 100: '#F7D3D2', 700: '#B53B37' },
        green: { DEFAULT: '#2E9E6B', 50: '#EAF6F0', 100: '#CDEBDD', 700: '#237A53' },
        slate: { DEFAULT: '#657385', 50: '#F2F4F7', 100: '#E6E9EE', 700: '#4B5664', 900: '#1F2733' },
        ink: '#1F2733',
        bg: '#F7F9FC',
        line: '#E3E8EF',
        expired: '#4A5160',
        cancelled: '#9AA3AF',
      },
      fontFamily: {
        heading: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        lift: '0 4px 12px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04)',
        glow: '0 20px 50px -12px rgba(27, 112, 190, 0.35)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ken-burns': {
          from: { transform: 'scale(1.02) translate3d(0, 0, 0)' },
          to: { transform: 'scale(1.14) translate3d(-1.5%, -1%, 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        progress: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.6s ease-out both',
        'ken-burns': 'ken-burns 9s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        progress: 'progress 6s linear both',
        'ping-soft': 'ping-soft 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
