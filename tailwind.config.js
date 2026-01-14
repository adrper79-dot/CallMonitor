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
      // JETSONS COLOR THEORY PALETTE
      // Based on: Space Age Optimism + Mid-Century Modern + Atomic Age
      // ═══════════════════════════════════════════════════════════════════════
      colors: {
        // PRIMARY: Deep Space Teal (Trust, Future, Calm)
        // Evokes: The infinite horizon, technological promise
        jetsons: {
          teal: '#00CED1',       // Primary accent - vibrant future
          'teal-dark': '#008B8B', // Darker variant
          'teal-glow': '#40E0D0', // Highlight/glow effect
        },
        
        // SECONDARY: Atomic Gold (Energy, Optimism, Warmth)
        // From the Latimer + Woods logo - connects brand identity
        atomic: {
          gold: '#C5A045',       // Brand gold
          amber: '#FFB347',      // Warm amber
          sunrise: '#FF8C42',    // Energetic orange
          cream: '#FFF8E7',      // Vintage paper cream
        },
        
        // ACCENT: Cosmic Coral (Human Touch, Approachability)
        // The "human" element in the machine age
        cosmic: {
          coral: '#FF6B6B',      // Warm accent
          rose: '#FFB5B5',       // Soft rose
          blush: '#FFE4E4',      // Gentle blush
        },
        
        // SPACE: Deep Void (Sophistication, Mystery, Depth)
        // Background colors for that "floating in space" feel
        space: {
          void: '#0A0A1A',       // Deep space black
          night: '#0F172A',      // Slate night sky
          nebula: '#1E1E3F',     // Purple-tinged space
          stardust: '#2D2D5A',   // Lighter nebula
        },
        
        // CHROME: Metallic Accents (Precision, Quality, Future)
        // The Jetsons loved their chrome
        chrome: {
          silver: '#C0C0C0',
          steel: '#71797E',
          platinum: '#E5E4E2',
        },
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // JETSONS TYPOGRAPHY
      // ═══════════════════════════════════════════════════════════════════════
      fontFamily: {
        'display': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // ORGANIC CURVES (Jetsons loved curves)
      // ═══════════════════════════════════════════════════════════════════════
      borderRadius: {
        'bubble': '2rem',
        'capsule': '100px',
        'orbit': '50%',
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // SPACE-AGE ANIMATIONS
      // ═══════════════════════════════════════════════════════════════════════
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'typewriter': 'typewriter 3s steps(40) 1s forwards',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(0, 206, 209, 0.5), 0 0 20px rgba(0, 206, 209, 0.3)' 
          },
          '50%': { 
            boxShadow: '0 0 20px rgba(0, 206, 209, 0.8), 0 0 40px rgba(0, 206, 209, 0.5)' 
          },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // SPACE-AGE SHADOWS & EFFECTS
      // ═══════════════════════════════════════════════════════════════════════
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 206, 209, 0.4)',
        'glow-gold': '0 0 20px rgba(197, 160, 69, 0.4)',
        'glow-coral': '0 0 20px rgba(255, 107, 107, 0.4)',
        'hover-lift': '0 10px 40px rgba(0, 0, 0, 0.3)',
        'card-float': '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 206, 209, 0.1)',
      },
      
      // ═══════════════════════════════════════════════════════════════════════
      // GRADIENTS
      // ═══════════════════════════════════════════════════════════════════════
      backgroundImage: {
        'gradient-space': 'linear-gradient(135deg, #0A0A1A 0%, #1E1E3F 50%, #0F172A 100%)',
        'gradient-sunrise': 'linear-gradient(135deg, #C5A045 0%, #FF8C42 50%, #FF6B6B 100%)',
        'gradient-chrome': 'linear-gradient(135deg, #E5E4E2 0%, #C0C0C0 50%, #71797E 100%)',
        'gradient-teal': 'linear-gradient(135deg, #008B8B 0%, #00CED1 50%, #40E0D0 100%)',
      },
    },
  },
  plugins: [],
}
