import { useEffect, useRef, useCallback, useMemo, useState } from 'react'

// ─── Ripple Canvas ────────────────────────────────────────────────────────────
function RippleCanvas() {
  const canvasRef  = useRef(null)
  const ripplesRef = useRef([])
  const animRef    = useRef(null)

  const addRipple = useCallback((x, y) => {
    ripplesRef.current.push({
      x, y, r: 0, alpha: 0.6,
      color: `hsl(${Math.random() * 60 + 170},100%,60%)`,
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Auto spawn — lebih jarang, tidak di mobile
    const isMobile = window.innerWidth < 768
    const auto = setInterval(() => {
      if (document.hidden) return
      addRipple(Math.random() * window.innerWidth, Math.random() * window.innerHeight * 0.8)
    }, isMobile ? 3000 : 1800)

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ripplesRef.current = ripplesRef.current.filter(rp => rp.alpha > 0)
      ripplesRef.current.forEach(rp => {
        rp.r     += 2
        rp.alpha -= 0.008
        ctx.strokeStyle = rp.color
        ctx.lineWidth   = 1
        // Outer ring only — lebih subtle
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.globalAlpha = Math.max(0, rp.alpha * 0.5); ctx.stroke()
        ctx.globalAlpha = 1
      })
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)

    // Klik TIDAK trigger ripple — hanya auto spawn dan mousemove sangat pelan
    const onMove = e => { if (Math.random() > 0.98) addRipple(e.clientX, e.clientY) }
    window.addEventListener('mousemove', onMove)

    return () => {
      cancelAnimationFrame(animRef.current)
      clearInterval(auto)
      window.removeEventListener('resize',    resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [addRipple])

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.25 }} />
  )
}

// ─── Floating Particles ───────────────────────────────────────────────────────
function FloatingParticles() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const COLORS = ['#00f5ff','#c6bfff','#f8bd45','#ff6b6b','#00ff88']
  const count = isMobile ? 8 : 28

  // useMemo — only recreate when count changes (orientation change)
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id:    i,
      x:     Math.random() * 100,
      delay: Math.random() * 10,
      dur:   5 + Math.random() * 7,
      size:  isMobile ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
  , [count]) // eslint-disable-line

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full"
          style={{
            left: `${p.x}%`, bottom: '-10px',
            width:  p.size * 2,
            height: p.size * 2,
            background: p.color,
            boxShadow: `0 0 ${p.size * 6}px ${p.color}, 0 0 ${p.size * 12}px ${p.color}`,
            animation: `particleFloat ${p.dur}s ${p.delay}s infinite linear`,
            opacity: 0.85,
          }} />
      ))}
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function AppLayout({ children }) {
  return (
    <div style={{ background: '#050508', minHeight: '100vh', position: 'relative' }}>

      {/* Ripple background */}
      <RippleCanvas />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Subtle grid */}
      <div className="grid-bg fixed inset-0 pointer-events-none z-0 opacity-[0.05]" />

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: `
          radial-gradient(ellipse 60% 40% at 15% 20%, rgba(108,92,231,0.1) 0%, transparent 55%),
          radial-gradient(ellipse 50% 60% at 85% 80%, rgba(0,245,255,0.08) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 0%, rgba(0,245,255,0.06) 0%, transparent 50%)
        `,
      }} />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      <style>{`
        @keyframes particleFloat {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 0.85; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
