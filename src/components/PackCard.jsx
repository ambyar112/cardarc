const PACK_THEMES = {
  pokemon: {
    name: 'Pokemon',
    label: 'POKEMON',
    subtitle: 'Electric Adventures',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(251,191,36,0.10) 50%, rgba(59,130,246,0.15) 100%)',
    accent: '#fbbf24',
    glow: 'rgba(251,191,36,0.4)',
    borderGlow: 'rgba(251,191,36,0.6)',
    bgPattern: 'radial-gradient(circle at 20% 30%, rgba(239,68,68,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.08) 0%, transparent 50%)',
    packGradient: 'linear-gradient(135deg, #dc2626 0%, #fbbf24 50%, #2563eb 100%)',
    packLabel: 'P',
  },
  yugioh: {
    name: 'Yugioh',
    label: 'YUGIOH',
    subtitle: 'Duel Masters',
    gradient: 'linear-gradient(135deg, rgba(202,138,4,0.15) 0%, rgba(245,200,76,0.10) 50%, rgba(120,53,15,0.15) 100%)',
    accent: '#f5c84c',
    glow: 'rgba(245,200,76,0.4)',
    borderGlow: 'rgba(245,200,76,0.6)',
    bgPattern: 'radial-gradient(circle at 30% 40%, rgba(245,200,76,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(120,53,15,0.08) 0%, transparent 50%)',
    packGradient: 'linear-gradient(135deg, #78350f 0%, #f5c84c 50%, #ca8a04 100%)',
    packLabel: 'Y',
  },
  dragonball: {
    name: 'Dragon Ball',
    label: 'DRAGON BALL',
    subtitle: 'Fusion Warriors',
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(239,68,68,0.10) 50%, rgba(220,38,38,0.15) 100%)',
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.4)',
    borderGlow: 'rgba(249,115,22,0.6)',
    bgPattern: 'radial-gradient(circle at 25% 35%, rgba(249,115,22,0.08) 0%, transparent 50%), radial-gradient(circle at 75% 65%, rgba(239,68,68,0.08) 0%, transparent 50%)',
    packGradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #b91c1c 100%)',
    packLabel: 'D',
  },
}

function PackArt({ game, accent, packGradient, packLabel }) {
  return (
    <div className="relative w-16 h-20 rounded-lg overflow-hidden shadow-2xl transition-transform duration-500 group-hover:rotate-3 group-hover:scale-110"
      style={{
        background: packGradient,
        boxShadow: `0 8px 24px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      {/* Foil shine effect */}
      <div className="absolute inset-0 opacity-60"
        style={{
          background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
          animation: 'packShine 3s ease-in-out infinite',
        }}
      />
      {/* Top foil line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
      />
      {/* Pack label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-black text-2xl text-white drop-shadow-lg" style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(255,255,255,0.3)'
        }}>
          {packLabel}
        </span>
      </div>
      {/* Bottom dark band */}
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-black/40 backdrop-blur-sm" />
      {/* Side highlight */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-white/30" />
    </div>
  )
}

export default function PackCard({ game, count, onClick, loading }) {
  const theme = PACK_THEMES[game]
  if (!theme) return null

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group relative rounded-3xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
      style={{
        background: theme.gradient,
        border: `2px solid ${theme.accent}30`,
        minHeight: '280px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = theme.borderGlow
        e.currentTarget.style.boxShadow = `0 0 40px ${theme.glow}, 0 0 80px ${theme.glow}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${theme.accent}30`
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <style>{`
        @keyframes packShine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>

      {/* Background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: theme.bgPattern }}
      />

      {/* Animated circles decoration */}
      <div
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 transition-transform duration-700 group-hover:scale-150"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-15 transition-transform duration-700 group-hover:scale-150"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
      />

      {/* Content */}
      <div className="relative h-full p-6 flex flex-col justify-between">
        {/* Top: Pack Art + Label */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <PackArt
              game={game}
              accent={theme.accent}
              packGradient={theme.packGradient}
              packLabel={theme.packLabel}
            />
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: theme.accent }}
              >
                {theme.label}
              </p>
              <p className="font-mono text-[9px] tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {theme.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Big number */}
        <div className="flex items-end gap-2">
          {loading ? (
            <div className="h-12 w-16 rounded-lg bg-white/5 animate-pulse" />
          ) : (
            <>
              <span
                className="font-mono font-bold text-5xl leading-none transition-all duration-300 group-hover:scale-110"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 20px ${theme.glow}`,
                }}
              >
                {count ?? 0}
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-widest pb-2"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                listings
              </span>
            </>
          )}
        </div>

        {/* Bottom: CTA */}
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[10px] uppercase tracking-widest font-bold"
            style={{ color: theme.accent }}
          >
            Browse Pack
          </span>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1"
            style={{
              background: `${theme.accent}20`,
              border: `1px solid ${theme.accent}50`,
            }}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: theme.accent }}
            >
              arrow_forward
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}