import { useEffect, useRef, useState } from 'react'
import CardItem from './CardItem'
import { tierBadge } from '../lib/tcgdex'

function tierColor(tier) {
  return { legendary:'#ffdb40', epic:'#e3b5ff', rare:'#00f5ff', common:'#928ea0' }[tier] || '#00f5ff'
}

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y
    this.vx = (Math.random() - 0.5) * 20
    this.vy = (Math.random() - 0.5) * 20
    this.size = Math.random() * 4 + 2
    this.color = color
    this.alpha = 1
    this.gravity = 0.05
  }
  update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.alpha -= 0.012 }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.alpha)
    ctx.fillStyle = this.color
    ctx.shadowBlur = 10; ctx.shadowColor = this.color
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  }
}

// Single card reveal overlay
export function SummonOverlay({ card, packAccent, onClose }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const [phase, setPhase]     = useState('idle')
  const [visible, setVisible] = useState(false)
  const accent = card ? tierColor(card.tier) : (packAccent || '#00f5ff')

  useEffect(() => {
    if (!card) return
    setPhase('spin'); setVisible(false)
    requestAnimationFrame(() => setVisible(true))
    const t1 = setTimeout(() => setPhase('reveal'), 2200)
    const t2 = setTimeout(() => setPhase('done'),   3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [card])

  useEffect(() => {
    if (phase !== 'reveal') return
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    let parts = []
    const cx = canvas.width / 2, cy = canvas.height / 2
    for (let i = 0; i < 150; i++) parts.push(new Particle(cx, cy, accent))
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      parts.forEach((p, i) => { p.update(); p.draw(ctx) })
      parts = parts.filter(p => p.alpha > 0)
      if (parts.length > 0) animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, accent])

  if (!card) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-700"
      style={{ background:'rgba(0,0,0,0.97)', backdropFilter:'blur(40px) brightness(0.2)',
               opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      {/* Ring glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="rounded-full transition-all duration-1000"
          style={{
            width:  phase !== 'spin' ? 'min(600px, 85vw)' : 'min(200px, 50vw)',
            height: phase !== 'spin' ? 'min(600px, 85vw)' : 'min(200px, 50vw)',
            background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
            boxShadow: phase !== 'spin' ? `0 0 120px ${accent}44` : 'none',
          }} />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 text-center px-4">
        {/* Status */}
        <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>
          {phase === 'spin' ? '⚡ Connecting to Arc Network...' : phase === 'reveal' ? '✦ Artifact Acquired ✦' : '— Minted on Arc Testnet —'}
        </p>
        {/* Card Stage */}
        <div className="relative flex items-center justify-center"
          style={{ width: 'min(224px, 60vw)', height: 'min(320px, 80vw)' }}>
          {/* Spin placeholder */}
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center transition-all duration-700"
            style={{ opacity: phase === 'spin' ? 1 : 0,
                     animation: phase === 'spin' ? 'summon-spin 2s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
                     background: `linear-gradient(135deg, ${accent}33, transparent)`,
                     border: `2px solid ${accent}60`, boxShadow: `0 0 40px ${accent}40` }}>
            <span className="text-7xl" style={{ filter: `drop-shadow(0 0 20px ${accent})` }}>
              {card.setId === 'yugioh' ? '⚔️' : card.setId === 'dragonball' ? '🔥' : card.setId === 'digimon' ? '🦕' : '⚡'}
            </span>
          </div>
          {/* Result card */}
          <div className="absolute inset-0 transition-all duration-700"
            style={{ opacity: phase !== 'spin' ? 1 : 0,
                     transform: phase !== 'spin' ? 'scale(1) rotateY(0deg)' : 'scale(0.6) rotateY(90deg)' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden"
              style={{ boxShadow: `0 0 60px ${accent}60, 0 0 20px ${accent}40` }}>
              {/* Holographic foil */}
              <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl"
                style={{ background: `linear-gradient(135deg, transparent 0%, ${accent}18 50%, transparent 100%)`,
                         backgroundSize: '200% 200%', animation: 'holo-move 3s ease-in-out infinite' }} />
              <CardItem card={card} />
            </div>
          </div>
          {/* Orbit ring */}
          {phase !== 'spin' && (
            <div className="absolute -inset-4 rounded-full border pointer-events-none"
              style={{ borderColor: `${accent}40`, boxShadow: `inset 0 0 30px ${accent}20`,
                       animation: 'orbit-spin 8s linear infinite' }} />
          )}
        </div>
        {/* Card info */}
        {phase !== 'spin' && (
          <div className="px-4">
            <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white mb-1">{card.name}</h3>
            <div className={`inline-block text-[9px] font-bold px-3 py-0.5 rounded-full border uppercase mb-1 ${tierBadge(card.tier)}`}>{card.tier}</div>
            <p className="font-mono text-[10px] sm:text-xs text-white/40">
              {card.setId === 'yugioh'
                ? `${card.types} • ATK ${card.atk ?? '—'}`
                : card.setId === 'dragonball'
                ? `${card.color || card.types} • ${card.cardType || 'BATTLE'} • PWR ${card.power ?? '—'}`
                : card.setId === 'digimon'
                ? `${card.color || card.types} • Lv${card.level ?? '—'} • DP ${card.dp ?? '—'}`
                : `${card.rarity || card.tier} • HP ${card.hp}`}
            </p>
          </div>
        )}
        {/* Close button */}
        <button onClick={onClose}
          className="px-8 sm:px-10 py-3 sm:py-3.5 rounded-xl font-mono font-bold text-sm transition-all duration-500"
          style={{ opacity: phase === 'done' ? 1 : 0, pointerEvents: phase === 'done' ? 'auto' : 'none',
                   transform: phase === 'done' ? 'translateY(0)' : 'translateY(20px)',
                   background: accent, color: '#07070F', boxShadow: `0 0 30px ${accent}60` }}>
          CLAIM &amp; ADD TO COLLECTION
        </button>
      </div>
      <style>{`
        @keyframes summon-spin { 0%{transform:rotateY(0deg) scale(0.5);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:rotateY(720deg) scale(1.2);opacity:0} }
        @keyframes holo-move { 0%{background-position:0% 0%} 50%{background-position:100% 100%} 100%{background-position:0% 0%} }
        @keyframes orbit-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

// Multi-card (10x) reveal overlay
export function SummonOverlay10({ cards, packAccent, onClose }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const [phase, setPhase]     = useState('idle')
  const [visible, setVisible] = useState(false)
  const [revealed, setRevealed] = useState([])

  useEffect(() => {
    if (!cards || !cards.length) return
    setPhase('spin'); setRevealed([]); setVisible(false)
    requestAnimationFrame(() => setVisible(true))

    // After spin → reveal cards one by one
    const t1 = setTimeout(() => {
      setPhase('reveal')
      cards.forEach((_, i) => {
        setTimeout(() => setRevealed(prev => [...prev, i]), i * 150)
      })
    }, 2000)
    const t2 = setTimeout(() => setPhase('done'), 2000 + cards.length * 150 + 600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [cards])

  // Particle burst
  useEffect(() => {
    if (phase !== 'reveal') return
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    const primaryAccent = cards?.[0] ? tierColor(cards[0].tier) : '#00f5ff'
    let parts = []
    const cx = canvas.width / 2, cy = canvas.height / 2
    for (let i = 0; i < 200; i++) parts.push(new Particle(cx, cy, i % 2 === 0 ? primaryAccent : '#ffffff'))
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      parts.forEach(p => { p.update(); p.draw(ctx) })
      parts = parts.filter(p => p.alpha > 0)
      if (parts.length > 0) animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase])

  if (!cards || !cards.length) return null

  // Count rarities
  const counts = cards.reduce((acc, c) => { acc[c.tier] = (acc[c.tier] || 0) + 1; return acc }, {})

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-start pt-16 sm:pt-20 p-3 sm:p-4 transition-all duration-700 overflow-y-auto"
      style={{ background:'rgba(0,0,0,0.97)', backdropFilter:'blur(40px) brightness(0.15)',
               opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40 mb-1">10x Summon Result</p>
          <h2 className="font-display text-3xl font-extrabold"
            style={{ color: phase === 'done' ? '#00f5ff' : 'white',
                     textShadow: phase === 'done' ? '0 0 20px rgba(0,245,255,0.5)' : 'none',
                     transition: 'all 0.5s' }}>
            {phase === 'spin' ? 'CHURNING REALITY...' : 'ARTIFACTS ACQUIRED'}
          </h2>
          {/* Rarity summary */}
          {phase === 'done' && (
            <div className="flex gap-3 justify-center mt-3 flex-wrap">
              {Object.entries(counts).map(([tier, count]) => (
                <span key={tier} className={`font-mono text-[10px] px-3 py-1 rounded-full border uppercase font-bold ${tierBadge(tier)}`}>
                  {count}× {tier}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Spin placeholder */}
        {phase === 'spin' && (
          <div className="w-64 h-80 rounded-2xl flex items-center justify-center"
            style={{ animation: 'summon-spin 2s cubic-bezier(0.4,0,0.2,1) forwards',
                     background: 'linear-gradient(135deg, #00f5ff33, transparent)',
                     border: '2px solid rgba(0,245,255,0.4)', boxShadow: '0 0 40px rgba(0,245,255,0.3)' }}>
            <span className="text-8xl" style={{ filter: 'drop-shadow(0 0 20px #00f5ff)' }}>✨</span>
          </div>
        )}

        {/* Cards grid — responsive columns */}
        {phase !== 'spin' && (
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3 md:gap-4 w-full">
            {cards.map((card, i) => {
              const acc = tierColor(card.tier)
              const isRevealed = revealed.includes(i)
              return (
                <div key={i} className="relative transition-all duration-500"
                  style={{ opacity: isRevealed ? 1 : 0, transform: isRevealed ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)' }}>
                  {/* Holographic foil overlay */}
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ boxShadow: isRevealed ? `0 0 20px ${acc}50` : 'none', transition: 'box-shadow 0.5s' }}>
                    <div className="absolute inset-0 z-10 pointer-events-none rounded-xl"
                      style={{ background: `linear-gradient(135deg, transparent 0%, ${acc}15 50%, transparent 100%)`,
                               backgroundSize: '200% 200%', animation: 'holo-move 3s ease-in-out infinite' }} />
                    <CardItem card={card} />
                  </div>
                  {/* Tier glow dot */}
                  {isRevealed && card.tier === 'legendary' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                      style={{ background: acc, boxShadow: `0 0 8px ${acc}` }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Close button */}
        {phase === 'done' && (
          <button onClick={onClose}
            className="px-12 py-4 rounded-xl font-mono font-bold text-sm mb-8 transition-all"
            style={{ background: '#00f5ff', color: '#07070F', boxShadow: '0 0 30px rgba(0,245,255,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            CLAIM ALL &amp; ADD TO COLLECTION
          </button>
        )}
      </div>

      <style>{`
        @keyframes summon-spin { 0%{transform:rotateY(0deg) scale(0.5);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:rotateY(720deg) scale(1.2);opacity:0} }
        @keyframes holo-move { 0%{background-position:0% 0%} 50%{background-position:100% 100%} 100%{background-position:0% 0%} }
        @keyframes orbit-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

export default SummonOverlay
