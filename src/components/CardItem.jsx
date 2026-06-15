import { useRef } from 'react'
import { tierBadge, tierToGlow } from '../lib/tcgdex'

export default function CardItem({ card, onClick }) {
  if (!card) return null

  const badge  = tierBadge(card.tier)
  const isYgo  = card.setId === 'yugioh'
  const isDbs  = card.setId === 'dragonball'
  const isDigi = card.setId === 'digimon'
  const BADGE  = isYgo ? 'YGO' : isDbs ? 'DBS' : isDigi ? 'DGM' : 'PKM'
  const ICON   = isYgo ? '⚔️' : isDbs ? '🔥' : isDigi ? '🦕' : '🃏'

  const containerRef = useRef(null)
  const glowRef      = useRef(null)

  // 3D tilt + glow on mouse move
  const handleMove = e => {
    const el   = containerRef.current
    const glow = glowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x    = e.clientX - rect.left
    const y    = e.clientY - rect.top
    const cx   = rect.width  / 2
    const cy   = rect.height / 2
    const rotX = ((y - cy) / cy) * -14  // max 14deg
    const rotY = ((x - cx) / cx) *  14
    el.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.04)`
    // Glow follows cursor
    if (glow) {
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.12) 0%, transparent 70%)`
      glow.style.opacity = '1'
    }
  }

  const handleLeave = () => {
    const el   = containerRef.current
    const glow = glowRef.current
    if (el) el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (glow) glow.style.opacity = '0'
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden cursor-pointer relative ${tierToGlow(card.tier)} bg-surface-container-low border border-white/5`}
      style={{ transition: 'transform 0.15s ease', transformStyle: 'preserve-3d', willChange: 'transform' }}
      onClick={() => onClick?.(card)}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onTouchStart={() => {
        if (containerRef.current) containerRef.current.style.transform = 'scale(0.97)'
      }}
      onTouchEnd={() => {
        if (containerRef.current) containerRef.current.style.transform = 'scale(1)'
      }}
    >
      {/* Moving glow overlay */}
      <div ref={glowRef} className="absolute inset-0 z-10 pointer-events-none rounded-xl transition-opacity duration-300"
        style={{ opacity: 0 }} />

      {/* Holographic foil for legendary */}
      {card.tier === 'legendary' && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(248,189,69,0.08) 25%, transparent 50%, rgba(198,191,255,0.08) 75%, transparent 100%)',
            backgroundSize: '200% 200%',
            animation: 'holoShift 4s ease-in-out infinite',
          }} />
      )}

      {/* Image */}
      <div className="aspect-[3/4] relative overflow-hidden bg-surface-bright">
        {card.img
          ? <img src={card.img} alt={card.name}
              width="100" height="133"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-1"
              style={{ transform: 'translateZ(20px)' }} />
          : <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
              <span className="text-4xl">{ICON}</span>
            </div>
        }
        {/* Tier badge */}
        <div className={`absolute top-2 right-2 text-[8px] font-bold px-2 py-0.5 rounded border uppercase ${badge}`}
          style={{ transform: 'translateZ(30px)' }}>
          {card.tier}
        </div>
        {/* Game badge */}
        <div className="absolute top-2 left-2 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white/60 font-mono"
          style={{ transform: 'translateZ(25px)' }}>
          {BADGE}
        </div>
        {/* Legendary shimmer */}
        {card.tier === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-transparent animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 bg-surface-container-highest/90" style={{ transform: 'translateZ(10px)' }}>
        <h4 className="font-body font-semibold text-xs text-on-surface truncate">{card.name}</h4>
        <div className="flex items-center justify-between mt-0.5">
          {isYgo ? (
            <>
              <span className="font-mono text-[9px] text-tertiary truncate">
                {card.types} {card.level ? `• Lv${card.level}` : ''}
              </span>
              <span className="font-mono text-[9px] text-secondary">
                {card.atk != null ? `ATK ${card.atk}` : ''}
              </span>
            </>
          ) : isDbs ? (
            <>
              <span className="font-mono text-[9px] text-tertiary truncate">
                {card.color || card.types} {card.cardType ? `• ${card.cardType}` : ''}
              </span>
              <span className="font-mono text-[9px] text-secondary">
                {card.power ? `PWR ${card.power}` : ''}
              </span>
            </>
          ) : isDigi ? (
            <>
              <span className="font-mono text-[9px] text-tertiary truncate">
                {card.color || card.types} {card.level ? `• Lv${card.level}` : ''}
              </span>
              <span className="font-mono text-[9px] text-secondary">
                {card.dp ? `DP ${card.dp}` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-[9px] text-tertiary">
                {card.types} • HP {card.hp}
              </span>
              <span className="font-mono text-[9px] text-on-surface-variant">#{card.localId}</span>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes holoShift {
          0%,100% { background-position: 0% 0%; }
          50%      { background-position: 100% 100%; }
        }
      `}</style>
    </div>
  )
}
