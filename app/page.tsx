import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * VOXSOUTH LANDING PAGE
 * 
 * Design Philosophy:
 * - Jetsons: Floating elements, orbital shapes, space-age optimism
 * - Feng Shui: Clear flow, commanding position, balanced energy
 * - 1960s Playboy: Sophisticated, confident, aspirational copy
 * 
 * "For the executive who refuses to be tethered to yesterday's technology."
 */

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION (Fire Element - South - Energy & Vision)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20">
        {/* Decorative orbital rings */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-[#00CED1]/10 rounded-full animate-spin" style={{ animationDuration: '60s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-[#C5A045]/10 rounded-full animate-spin" style={{ animationDuration: '45s', animationDirection: 'reverse' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[#00CED1]/5 rounded-full animate-spin" style={{ animationDuration: '30s' }} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-12 animate-float">
            <Logo size="hero" />
          </div>

          {/* Headline - 1960s Playboy style */}
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="block" style={{
              background: 'linear-gradient(135deg, #FFF8E7 0%, #C5A045 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Voice Intelligence
            </span>
            <span className="block text-[#00CED1]">
              For the Modern Executive
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-[#FFF8E7]/80 mb-4 font-light tracking-wide">
            Tomorrow's communication technology, available today.
          </p>
          
          {/* Subtext - Playboy ad style */}
          <p className="text-lg text-[#C0C0C0]/60 mb-12 max-w-2xl mx-auto italic">
            "A gentleman doesn't just answer calls—he commands them. 
            Recording, transcription, translation, and AI analytics, 
            all at your fingertips."
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard"
              className="btn-jetsons btn-primary px-8 py-4 text-lg"
            >
              Enter Command Center
            </Link>
            <Link 
              href="/api/auth/signin"
              className="btn-jetsons btn-ghost px-8 py-4 text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-[#00CED1]/50 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-[#00CED1] rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES SECTION (Earth Element - Center - Stability)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 feng-earth">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-4xl text-center mb-4">
            The <span className="text-[#C5A045]">Discerning Executive's</span> Arsenal
          </h2>
          <p className="text-center text-[#C0C0C0] mb-16 max-w-2xl mx-auto">
            Each tool precisely engineered for those who demand excellence.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 - Recording */}
            <FeatureCard
              icon="🎙️"
              title="Crystal Recording"
              description="Every word captured with studio-quality precision. Because in business, details matter—and every syllable could be the one that seals the deal."
              accent="teal"
            />

            {/* Feature 2 - Transcription */}
            <FeatureCard
              icon="📝"
              title="Instant Transcription"
              description="AI-powered transcription that keeps pace with your thoughts. Review, search, and reference your conversations without missing a beat."
              accent="gold"
            />

            {/* Feature 3 - Translation */}
            <FeatureCard
              icon="🌐"
              title="Global Translation"
              description="Break language barriers with the confidence of a seasoned diplomat. Real-time translation for the executive whose reach spans continents."
              accent="coral"
            />

            {/* Feature 4 - Survey */}
            <FeatureCard
              icon="📊"
              title="AI Survey Bot"
              description="Post-call intelligence, automatically gathered. Your AI assistant conducts follow-up surveys while you move on to the next conquest."
              accent="teal"
            />

            {/* Feature 5 - Secret Shopper */}
            <FeatureCard
              icon="🕵️"
              title="Secret Shopper"
              description="Quality assurance, reimagined. Synthetic callers test your team's mettle with the discretion of a trusted colleague."
              accent="gold"
            />

            {/* Feature 6 - Scheduling */}
            <FeatureCard
              icon="📅"
              title="Intelligent Scheduling"
              description="Cal.com-style booking meets voice intelligence. Schedule calls that record, transcribe, and analyze—automatically."
              accent="coral"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SOCIAL PROOF (Metal Element - West - Credibility)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 feng-metal">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-2xl md:text-3xl text-[#FFF8E7] font-light italic mb-8 leading-relaxed">
            "In a world of noise, VoxSouth lets you hear what matters."
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C5A045] to-[#00CED1]" />
            <div className="text-left">
              <p className="font-semibold text-[#FFF8E7]">A Modern Executive</p>
              <p className="text-sm text-[#C0C0C0]">Who Demands the Best</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA SECTION (Water Element - North - Flow to Action)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 feng-water">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl mb-6">
            Ready to <span className="text-[#00CED1]">Elevate</span> Your Communications?
          </h2>
          <p className="text-[#C0C0C0] mb-8 text-lg">
            Join the ranks of executives who've discovered that the right technology 
            isn't just an advantage—it's a necessity.
          </p>
          <Link 
            href="/voice"
            className="btn-jetsons btn-gold px-12 py-5 text-xl inline-block"
          >
            Begin Your Journey
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER (Wood Element - East - Growth & New Beginnings)
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 border-t border-[#00CED1]/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div>
              <p className="font-display text-sm tracking-wider text-[#C5A045]">LATIMER + WOODS</p>
              <p className="text-xs text-[#C0C0C0]">Tech LLC</p>
            </div>
          </div>
          <p className="text-sm text-[#C0C0C0]/60">
            © {new Date().getFullYear()} • Crafted for the discerning executive
          </p>
        </div>
      </footer>
    </main>
  )
}

/**
 * Feature Card Component
 * Jetsons-style floating card with organic curves
 */
function FeatureCard({ 
  icon, 
  title, 
  description, 
  accent 
}: { 
  icon: string
  title: string
  description: string
  accent: 'teal' | 'gold' | 'coral'
}) {
  const accentColors = {
    teal: { 
      border: 'rgba(0, 206, 209, 0.3)',
      glow: 'rgba(0, 206, 209, 0.2)',
      text: '#00CED1'
    },
    gold: { 
      border: 'rgba(197, 160, 69, 0.3)',
      glow: 'rgba(197, 160, 69, 0.2)',
      text: '#C5A045'
    },
    coral: { 
      border: 'rgba(255, 107, 107, 0.3)',
      glow: 'rgba(255, 107, 107, 0.2)',
      text: '#FF6B6B'
    },
  }
  
  const colors = accentColors[accent]

  return (
    <div 
      className="card-jetsons group cursor-pointer"
      style={{ borderColor: colors.border }}
    >
      {/* Icon */}
      <div 
        className="text-4xl mb-4 transition-transform group-hover:scale-110 group-hover:animate-float"
        style={{ filter: `drop-shadow(0 0 10px ${colors.glow})` }}
      >
        {icon}
      </div>
      
      {/* Title */}
      <h3 className="font-display text-xl mb-3" style={{ color: colors.text }}>
        {title}
      </h3>
      
      {/* Description - Playboy ad style */}
      <p className="text-[#C0C0C0] text-sm leading-relaxed">
        {description}
      </p>
    </div>
  )
}
