import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { getGlobalStats } from '../lib/supabase'

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

const STAT_SCHEMA = [
  { key: 'cardsSummoned', label: 'Cards Summoned', icon: 'auto_awesome',      color: '#00f5ff' },
  { key: 'activeTraders', label: 'Active Traders',  icon: 'groups',            color: '#c6bfff' },
  { key: 'arcVolume',     label: 'ARC Volume',      icon: 'currency_exchange', color: '#f8bd45' },
  { key: 'legendaryPulls',label: 'Legendary Pulls', icon: 'workspace_premium', color: '#ff6b6b' },
]

const PACK_PREVIEWS = [
  {
    game: 'pokemon', label: 'Pokémon TCG', sub: 'Sword & Shield · Scarlet & Violet',
    accent: '#E3350D', accentRgb: '227,53,13', badge: '⚡ PKM',
    cards: [
      { name: 'Charizard VMAX',  tier: 'legendary', img: 'https://assets.tcgdex.net/en/swsh/swsh8/74/high.webp' },
      { name: 'Rayquaza VMAX',   tier: 'legendary', img: 'https://assets.tcgdex.net/en/swsh/swsh8/105/high.webp' },
      { name: 'Umbreon VMAX',    tier: 'epic',      img: 'https://assets.tcgdex.net/en/swsh/swsh12/215/high.webp' },
      { name: 'Miraidon ex',     tier: 'epic',      img: 'https://assets.tcgdex.net/en/sv/sv01/81/high.webp' },
      { name: 'Gardevoir ex',    tier: 'epic',      img: 'https://assets.tcgdex.net/en/sv/sv02/86/high.webp' },
    ],
  },
  {
    game: 'yugioh', label: 'Yu-Gi-Oh!', sub: 'Dark · Dragon · Synchro · Fusion',
    accent: '#F4B942', accentRgb: '244,185,66', badge: '⚔️ YGO',
    cards: [
      { name: 'Blue-Eyes White Dragon', tier: 'legendary', img: 'https://images.ygoprodeck.com/images/cards/89631139.jpg' },
      { name: 'Dark Magician',          tier: 'epic',      img: 'https://images.ygoprodeck.com/images/cards/46986414.jpg' },
      { name: 'Red-Eyes Black Dragon',  tier: 'legendary', img: 'https://images.ygoprodeck.com/images/cards/74677422.jpg' },
      { name: 'Exodia the Forbidden',   tier: 'epic',      img: 'https://images.ygoprodeck.com/images/cards/33396948.jpg' },
      { name: 'Stardust Dragon',        tier: 'rare',      img: 'https://images.ygoprodeck.com/images/cards/44508094.jpg' },
    ],
  },
  {
    game: 'dragonball', label: 'Dragon Ball Super', sub: 'Fusion World · FB01–FB06',
    accent: '#FF6B00', accentRgb: '255,107,0', badge: '🔥 DBS',
    cards: [
      { name: 'Son Goku',   tier: 'epic',      img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB01-001_f.webp' },
      { name: 'Beerus',     tier: 'epic',      img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB01-002_f.webp' },
      { name: 'Vegeta',     tier: 'epic',      img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB02-001_f.webp' },
      { name: 'Frieza',     tier: 'legendary', img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB03-001_f.webp' },
      { name: 'Ultra Goku', tier: 'legendary', img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB04-001_f.webp' },
    ],
  },
]

const TIER_COLOR = { legendary: '#f8bd45', epic: '#c6bfff', rare: '#47d6ff', common: '#928ea0' }

// ─── Pack Card ────────────────────────────────────────────────────────────────
function PackCard({ pack, onClick }) {
  const [idx, setIdx]     = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => { setIdx(i => (i + 1) % pack.cards.length); setFading(false) }, 300)
    }, 2800)
    return () => clearInterval(t)
  }, [pack.cards.length])

  const card = pack.cards[idx]

  return (
    <div onClick={onClick}
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{
        background: 'rgba(5,5,8,0.6)',
        border: `1px solid rgba(${pack.accentRgb},0.2)`,
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(20px)',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid rgba(${pack.accentRgb},0.6)`
        e.currentTarget.style.boxShadow = `0 0 40px rgba(${pack.accentRgb},0.25), inset 0 0 40px rgba(${pack.accentRgb},0.04)`
        e.currentTarget.style.transform = 'translateY(-6px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = `1px solid rgba(${pack.accentRgb},0.2)`
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onTouchStart={e => {
        e.currentTarget.style.transform = 'scale(0.97)'
        e.currentTarget.style.border = `1px solid rgba(${pack.accentRgb},0.5)`
      }}
      onTouchEnd={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.border = `1px solid rgba(${pack.accentRgb},0.2)`
      }}>

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${pack.accent}, transparent)` }} />

      {/* Holographic shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, transparent 0%, rgba(${pack.accentRgb},0.05) 50%, transparent 100%)` }} />

      {/* Card image */}
      <div className="relative h-56 overflow-hidden bg-[#05050a]">
        <img key={idx} src={card.img} alt={card.name} referrerPolicy="no-referrer"
          width="180" height="240"
          className="w-full h-full object-contain p-3"
          style={{
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.3s ease',
            filter: `drop-shadow(0 0 16px ${pack.accent}50)`,
          }}
          onError={e => { e.currentTarget.style.opacity = '0' }} />
        <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{ background: `linear-gradient(to top, rgba(5,5,8,0.95), transparent)` }} />
        {/* Game badge — contrast ratio fixed: white text on dark bg */}
        <div className="absolute top-3 right-3 font-mono text-[9px] font-bold px-2 py-1 rounded"
          style={{
            background: `rgba(0,0,0,0.7)`,
            color: pack.accent,
            border: `1px solid ${pack.accent}60`,
            backdropFilter: 'blur(10px)',
            letterSpacing: '0.1em',
          }}>
          {pack.badge}
        </div>
        {/* Card name + tier */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <span className="font-mono text-[10px] text-white/80 truncate">{card.name}</span>
          <span className="font-mono text-[9px] font-bold ml-2 flex-shrink-0 px-1.5 py-0.5 rounded"
            style={{ background: TIER_COLOR[card.tier] + '20', color: TIER_COLOR[card.tier],
                     border: `1px solid ${TIER_COLOR[card.tier]}40` }}>
            {card.tier.toUpperCase()}
          </span>
        </div>
        {/* Dot indicators — use opacity+scale instead of width (GPU composited) */}
        <div className="absolute top-3 left-3 flex gap-1 items-center">
          {pack.cards.map((_, i) => (
            <span key={i} className="rounded-full"
              style={{
                width: '5px',
                height: '5px',
                background: i === idx ? pack.accent : 'rgba(255,255,255,0.2)',
                transform: i === idx ? 'scale(2.2)' : 'scale(1)',
                opacity:   i === idx ? 1 : 0.5,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
              }} />
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="sora font-bold text-sm" style={{ color: '#e5e1e7' }}>{pack.label}</h3>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: pack.accent, opacity: 0.7 }}>{pack.sub}</p>
        </div>
        {/* Rarity bars */}
        <div className="flex gap-1">
          {[{ c:'#f8bd45',w:'8%'},{ c:'#c6bfff',w:'15%'},{ c:'#47d6ff',w:'28%'},{ c:'#928ea0',w:'49%'}]
            .map((b,i) => <div key={i} className="h-1 rounded-full" style={{ width:b.w, background:b.c, opacity:0.7 }} />)}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px]" style={{ color:'#849495' }}>
            {pack.game==='pokemon'?'5':pack.game==='yugioh'?'8':'7'} USDC / pull
          </span>
          <span className="font-mono text-[10px] flex items-center gap-1 group-hover:gap-2 transition-all duration-300"
            style={{ color: pack.accent }}>
            OPEN PACK →
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Glitch Text Effect ───────────────────────────────────────────────────────
function GlitchText({ text, style }) {
  const [glitching, setGlitching] = useState(false)
  useEffect(() => {
    const run = () => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 200)
    }
    const t = setInterval(run, 4000 + Math.random() * 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <span className="relative inline-block" style={style}>
      {text}
      {glitching && (
        <>
          <span className="absolute inset-0 text-[#00f5ff]" style={{ transform:'translateX(-2px)', clipPath:'polygon(0 20%,100% 20%,100% 40%,0 40%)', opacity:0.7 }}>{text}</span>
          <span className="absolute inset-0 text-[#ff6b6b]" style={{ transform:'translateX(2px)', clipPath:'polygon(0 60%,100% 60%,100% 80%,0 80%)', opacity:0.7 }}>{text}</span>
        </>
      )}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const nav = useNavigate()
  const [stats, setStats] = useState(null)

  // ✅ PERF FIX: defer stats fetch — don't block initial render/LCP
  useEffect(() => {
    // requestIdleCallback ensures stats load AFTER critical content renders
    const load = () => getGlobalStats().then(setStats)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(load, { timeout: 3000 })
    } else {
      setTimeout(load, 500)
    }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: '#e5e1e7' }}>

      {/* Ambient glows — tambahan per page */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: `
          radial-gradient(ellipse 60% 40% at 20% 20%, rgba(108,92,231,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 50% 60% at 80% 80%, rgba(0,245,255,0.09) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 50% 50%, rgba(244,185,66,0.04) 0%, transparent 70%)
        `,
      }} />

      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center px-6 lg:px-16 overflow-hidden max-w-7xl mx-auto pt-20">

        {/* Corner brackets */}
        <div className="absolute top-24 left-6 w-12 h-12 pointer-events-none"
          style={{ borderTop:'1px solid rgba(0,245,255,0.4)', borderLeft:'1px solid rgba(0,245,255,0.4)' }} />
        <div className="absolute top-24 right-6 w-12 h-12 pointer-events-none"
          style={{ borderTop:'1px solid rgba(0,245,255,0.4)', borderRight:'1px solid rgba(0,245,255,0.4)' }} />
        <div className="absolute bottom-8 left-6 w-12 h-12 pointer-events-none"
          style={{ borderBottom:'1px solid rgba(0,245,255,0.15)', borderLeft:'1px solid rgba(0,245,255,0.15)' }} />
        <div className="absolute bottom-8 right-6 w-12 h-12 pointer-events-none"
          style={{ borderBottom:'1px solid rgba(0,245,255,0.15)', borderRight:'1px solid rgba(0,245,255,0.15)' }} />

        <div className="relative z-10 w-full flex flex-col items-center text-center gap-8">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px]"
            style={{ background:'rgba(0,245,255,0.05)', border:'1px solid rgba(0,245,255,0.25)',
                     color:'#00f5ff', letterSpacing:'0.15em', backdropFilter:'blur(10px)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background:'#00f5ff', boxShadow:'0 0 8px #00f5ff' }} />
            SEASON 1 LIVE — PKM × YGO × DBS
          </div>

          {/* Headline with glitch effect */}
          <div className="flex flex-col items-center gap-3">
            <h1 className="sora font-extrabold leading-[1.05]"
              style={{ fontSize:'clamp(2.8rem, 8vw, 6rem)' }}>
              <span style={{ color:'#e9feff' }}>SUMMON THE </span>
              <br />
              <GlitchText text="RAREST CARDS"
                style={{
                  background: 'linear-gradient(90deg, #00f5ff 0%, #c6bfff 50%, #f8bd45 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 30px rgba(0,245,255,0.3))',
                }} />
            </h1>
            {/* Animated underline */}
            <div className="h-[2px] rounded-full underline-anim" style={{
              background: 'linear-gradient(90deg, transparent, #00f5ff, #c6bfff, transparent)',
              width: '200px',
            }} />
          </div>

          <p className="font-body max-w-lg leading-relaxed" style={{ color:'#849495', fontSize:15 }}>
            Gacha-pull ultra-rare TCG cards dari 3 universe berbeda.
            Build koleksi on-chain dan trade di Arc Testnet.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => nav('/gacha')}
              className="btn-primary flex items-center gap-2.5 px-8 py-4 rounded-xl sora font-semibold relative overflow-hidden group"
              style={{ fontSize:13, letterSpacing:'0.05em' }}>
              {/* Shine sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                style={{ background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
              <span className="material-symbols-outlined" style={{ fontSize:18 }}>auto_awesome</span>
              START SUMMONING
            </button>
            <button onClick={() => nav('/collection')}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl sora font-semibold transition-all duration-300"
              style={{ fontSize:13, letterSpacing:'0.05em', background:'rgba(0,245,255,0.05)',
                       border:'1px solid rgba(0,245,255,0.2)', color:'#00f5ff' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(0,245,255,0.1)'; e.currentTarget.style.borderColor='rgba(0,245,255,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(0,245,255,0.05)'; e.currentTarget.style.borderColor='rgba(0,245,255,0.2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize:18 }}>style</span>
              MY COLLECTION
            </button>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40"
            style={{ animation:'bounce 2s infinite' }}>
            <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Scroll</span>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize:16 }}>keyboard_arrow_down</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 lg:px-16 max-w-7xl mx-auto pb-12 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAT_SCHEMA.map(s => {
            const rawVal = stats?.[s.key]
            const display = stats === null
              ? '—'
              : s.key === 'arcVolume'
                ? formatNum(Math.round(rawVal)) + ' USDC'
                : formatNum(rawVal)
            return (
              <div key={s.label}
                className="relative overflow-hidden rounded-xl flex flex-col items-center gap-2 py-5 px-4 group cursor-default"
                style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)',
                         backdropFilter:'blur(10px)', transition:'all 0.3s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor=`${s.color}40` }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}>
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background:`linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                <span className="material-symbols-outlined" style={{ color:s.color, fontSize:20 }}>{s.icon}</span>
                {stats === null
                  ? <div className="h-6 w-16 rounded animate-pulse" style={{ background:'rgba(255,255,255,.08)' }} />
                  : <span className="sora font-extrabold" style={{ fontSize:24, color:'#e9feff', lineHeight:1 }}>{display}</span>
                }
                <span className="font-mono uppercase text-center" style={{ fontSize:9, color:'#849495', letterSpacing:'0.12em' }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pack Preview */}
      <section className="px-6 lg:px-16 pb-16 max-w-7xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] rounded-full" style={{ background:'#00f5ff' }} />
            <h2 className="sora font-bold" style={{ fontSize:20, color:'#e5e1e7', letterSpacing:'0.05em' }}>
              AVAILABLE PACKS
            </h2>
          </div>
          <div className="font-mono text-[10px] px-2.5 py-1 rounded"
            style={{ background:'rgba(0,245,255,0.08)', color:'#00f5ff',
                     border:'1px solid rgba(0,245,255,0.2)', letterSpacing:'0.1em' }}>
            3 GAMES · LIVE
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PACK_PREVIEWS.map(pack => (
            <PackCard key={pack.game} pack={pack} onClick={() => nav('/gacha')} />
          ))}
        </div>
      </section>

      {/* Ecosystem */}
      <section className="px-6 lg:px-16 pb-20 max-w-7xl mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-[2px] rounded-full" style={{ background:'#00f5ff' }} />
          <h2 className="sora font-bold" style={{ fontSize:20, color:'#e5e1e7', letterSpacing:'0.05em' }}>ECOSYSTEM</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon:'auto_awesome', title:'Gacha',       desc:'Pull kartu rare dari 3 TCG universe.', path:'/gacha',       accent:'#9400e4', rgb:'148,0,228',  tag:'PULL' },
            { icon:'style',        title:'Collection',  desc:'Lihat semua kartu yang kamu punya.',   path:'/collection',  accent:'#00f5ff', rgb:'0,245,255',  tag:'VIEW' },
            { icon:'storefront',   title:'Marketplace', desc:'Trade kartu dengan harga real TCG.',   path:'/marketplace', accent:'#f8bd45', rgb:'248,189,69', tag:'TRADE' },
          ].map(item => (
            <div key={item.title} onClick={() => nav(item.path)}
              className="relative overflow-hidden rounded-xl p-5 cursor-pointer flex items-center gap-4 group"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid rgba(${item.rgb},0.15)`,
                backdropFilter: 'blur(10px)',
                transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `rgba(${item.rgb},0.06)`
                e.currentTarget.style.borderColor = `rgba(${item.rgb},0.4)`
                e.currentTarget.style.boxShadow   = `0 4px 20px rgba(${item.rgb},0.15)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background   = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.borderColor  = `rgba(${item.rgb},0.15)`
                e.currentTarget.style.boxShadow    = 'none'
              }}>
              <div className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{ background:`linear-gradient(to bottom, transparent, ${item.accent}, transparent)` }} />
              <span className="material-symbols-outlined flex-shrink-0" style={{ color:item.accent, fontSize:28 }}>{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="sora font-bold text-sm" style={{ color:'#e5e1e7' }}>{item.title}</h3>
                  <span className="font-mono text-[8px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      background: `rgba(${item.rgb},0.25)`,
                      color: '#ffffff',
                      letterSpacing: '0.1em',
                    }}>{item.tag}</span>
                </div>
                <p className="font-body text-xs" style={{ color:'#849495' }}>{item.desc}</p>
              </div>
              <span className="material-symbols-outlined flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                style={{ color:item.accent, fontSize:18, opacity:0.6 }}>arrow_forward</span>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div style={{ borderTop:'1px solid rgba(0,245,255,0.08)', background:'rgba(0,0,0,0.3)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-8 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
          <div className="text-center md:text-left">
            <p className="sora font-bold text-sm" style={{ color:'#e5e1e7' }}>Need testnet USDC?</p>
            <p className="font-mono text-[11px] mt-0.5" style={{ color:'#849495' }}>Claim gratis dari Circle Faucet — sekali per 24 jam.</p>
          </div>
          <button onClick={() => nav('/faucet')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-mono text-xs transition-all duration-300"
            style={{ background:'rgba(71,214,255,0.08)', border:'1px solid rgba(71,214,255,0.2)', color:'#47d6ff' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(71,214,255,0.15)'; e.currentTarget.style.borderColor='rgba(71,214,255,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(71,214,255,0.08)'; e.currentTarget.style.borderColor='rgba(71,214,255,0.2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>water_drop</span>
            FAUCET →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes expandLine {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .underline-anim {
          transform-origin: left center;
          animation: expandLine 1.5s ease forwards;
          will-change: transform;
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  )
}
