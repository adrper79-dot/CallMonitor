/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════════════
      // CALLMONITOR PROFESSIONAL DESIGN SYSTEM v3.0
      // Philosophy: Trust, competence, simplicity
      // Target: SMBs who need professional-grade tools
      // ═══════════════════════════════════════════════════════════════════════
      colors: {
        // PRIMARY: Navy Blue (Trust, Authority, Competence)
        // Used by: Banks, law firms, enterprise software
        primary: {
          DEFAULT: '#1E3A5F',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#1E3A5F',  // Our primary
          700: '#15294A',  // Darker
          800: '#0F1D33',
          900: '#0A1221',
        },
        
        // SEMANTIC: Success (Growth, Money, Positive)
        success: {
          DEFAULT: '#059669',
          light: '#D1FAE5',
          dark: '#047857',
        },
        
        // SEMANTIC: Warning (Attention without alarm)
        warning: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
          dark: '#B45309',
        },
        
        // SEMANTIC: Error (Problems, used sparingly)
        error: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
          dark: '#B91C1C',
        },
        
        // SEMANTIC: Info (Neutral information)
        info: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
          dark: '#1D4ED8',
        },
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // TYPOGRAPHY
      // ═══════════════════════════════════════════════════════════════════════
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        'display': ['30px', { lineHeight: '1.2', fontWeight: '600' }],
        'heading-1': ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        'heading-2': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-3': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'tiny': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // SPACING (4px base unit)
      // ═══════════════════════════════════════════════════════════════════════
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // BORDER RADIUS (Subtle, professional)
      // ═══════════════════════════════════════════════════════════════════════
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // SHADOWS (Subtle, not dramatic)
      // ═══════════════════════════════════════════════════════════════════════
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'focus': '0 0 0 2px #1E3A5F',
        'focus-error': '0 0 0 2px #DC2626',
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // ANIMATIONS (Subtle, purposeful)
      // ═══════════════════════════════════════════════════════════════════════
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-down': 'slide-down 200ms ease-out',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // TRANSITIONS
      // ═══════════════════════════════════════════════════════════════════════
      transitionDuration: {
        'fast': '100ms',
        'DEFAULT': '150ms',
        'slow': '300ms',
      },
    },
  },
  plugins: [],
}
