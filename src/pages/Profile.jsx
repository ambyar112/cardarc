import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { getCollection, getGachaLog, upsertProfile, getRealLeaderboard } from '../lib/supabase'
import CardItem from '../components/CardItem'
import ListModal from '../components/ListModal'

function shortAddr(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : '' }

const PER = 24
const TIER_FILTERS = ['all','legendary','epic','rare','common']
const GAME_FILTERS = [
  { key:'all',        label:'All',    cls:'bg-white/20 text-on-surface' },
  { key:'pokemon',    label:'⚡ PKM', cls:'bg-red-500/20 text-red-300' },
  { key:'yugioh',     label:'⚔️ YGO',cls:'bg-yellow-500/20 text-yellow-300' },
  { key:'dragonball', label:'🔥 DBS',cls:'bg-orange-500/20 text-orange-300' },
]

export default function Profile() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [tab, setTab]           = useState('collection') // 'collection' | 'overview'
  const [stats, setStats]       = useState(null)
  const [cards, setCards]       = useState([])
  const [log, setLog]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [username, setUsername] = useState('')
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [selected, setSelected] = useState(null)
  const [listingCard, setListingCard] = useState(null)

  // Collection filters
  const [page, setPage]             = useState(0)
  const [tierFilter, setTierFilter] = useState('all')
  const [gameFilter, setGameFilter] = useState('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    if (!isConnected || !address) { setLoading(false); return }
    let isMounted = true
    async function load() {
      if (isMounted) setLoading(true)
      try {
        const [collection, pullLog, board] = await Promise.all([
          walletClient ? api.getMyCollection(walletClient, address).then(r => r?.data || []).catch(() => getCollection(address)) : getCollection(address),
          getGachaLog(address, 10).catch(() => []),
          getRealLeaderboard().catch(() => []),
        ])
        if (!isMounted) return
        const profile = board.find(p => p.wallet?.toLowerCase() === address.toLowerCase())
        setUsername(profile?.username || '')
        setCards(collection.map(c => ({
          id: c.card_id, name: c.card_name, img: c.card_img, tier: c.tier,
          setId: c.set_id, localId: c.local_id, hp: c.hp, types: c.types,
          rarity: c.rarity, atk: c.atk, def: c.def, level: c.level,
          power: c.set_id === 'dragonball' ? c.hp : null,
          color: c.set_id === 'dragonball' ? c.types : null,
        })))
        setStats({
          total:     collection.length,
          legendary: collection.filter(c => c.tier === 'legendary').length,
          epic:      collection.filter(c => c.tier === 'epic').length,
          rare:      collection.filter(c => c.tier === 'rare').length,
          pokemon:   collection.filter(c => !['yugioh','dragonball'].includes(c.set_id)).length,
          yugioh:    collection.filter(c => c.set_id === 'yugioh').length,
          dbs:       collection.filter(c => c.set_id === 'dragonball').length,
          totalPulls: profile?.totalPulls || 0,
          rank:      board.findIndex(p => p.wallet?.toLowerCase() === address.toLowerCase()) + 1 || '—',
        })
        setLog(pullLog)
      } catch (e) {
        console.error('Profile load error:', e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [isConnected, address, walletClient])

  async function saveUsername() {
    // ✅ FIX VULN-07: Strict allowlist validation — only alphanumeric, underscore, dash
    const trimmed = username.trim()
    if (!trimmed || !address) return
    if (!/^[a-zA-Z0-9_\-]{1,20}$/.test(trimmed)) {
      setUsernameError('Hanya huruf, angka, _ dan - (maks 20 karakter)')
      return
    }
    setUsernameError('')
    setSaving(true)
    await upsertProfile(address, { username: trimmed })
    setSaving(false)
    setEditing(false)
  }

  // Filtered cards for collection tab
  const filtered = cards.filter(c => {
    const t = tierFilter === 'all' || c.tier === tierFilter
    const s = !search || c.name?.toLowerCase().includes(search.toLowerCase())
    const g = gameFilter === 'all'
      || (gameFilter === 'pokemon'    ? !['yugioh','dragonball'].includes(c.setId) : false)
      || (gameFilter === 'yugioh'     ? c.setId === 'yugioh' : false)
      || (gameFilter === 'dragonball' ? c.setId === 'dragonball' : false)
    return t && s && g
  })
  const totalPages = Math.ceil(filtered.length / PER)
  const pageCards  = filtered.slice(page * PER, (page + 1) * PER)

  if (!isConnected) return (
    <div className="pt-24 px-4 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-5xl">🔐</div>
      <h2 className="font-display text-xl font-bold text-on-surface">Connect Wallet</h2>
      <p className="font-body text-on-surface-variant text-sm text-center">Connect wallet untuk melihat profil dan koleksi kamu.</p>
    </div>
  )

  return (
    <div className="pt-24 px-4 lg:px-12 pb-12 max-w-[1200px] mx-auto flex flex-col gap-6">

      {/* Profile header */}
      <div className="glass rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-6"
        style={{ borderTop: '2px solid rgba(0,245,255,0.3)', boxShadow: '0 0 30px rgba(0,245,255,0.08)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: 'rgba(0,245,255,0.1)', border: '2px solid rgba(0,245,255,0.3)' }}>🎴</div>
        <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            {editing ? (
              <>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  className="bg-surface-container border border-white/20 rounded-lg px-3 py-1.5 font-body text-sm text-on-surface focus:outline-none focus:border-tertiary"
                  placeholder="Enter username..." maxLength={20} />
                <button onClick={saveUsername} disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-tertiary/20 text-tertiary font-mono text-xs border border-tertiary/30 disabled:opacity-50">
                  {saving ? '...' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setUsernameError?.('') }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-on-surface-variant font-mono text-xs border border-white/10">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-on-surface">{username || 'Anonymous Collector'}</h1>
                <button onClick={() => setEditing(true)} className="text-on-surface-variant hover:text-on-surface text-sm">✏️</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
            <span className="font-mono text-xs text-tertiary">{shortAddr(address)}</span>
            <button onClick={() => navigator.clipboard.writeText(address || '')}
              className="font-mono text-[9px] text-on-surface-variant hover:text-on-surface bg-white/5 px-2 py-0.5 rounded border border-white/10">COPY</button>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-secondary/30 bg-secondary/10 text-secondary">🏆 Season 1</span>
            {stats?.rank > 0 && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">📈 Rank #{stats.rank}</span>
            )}
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-tertiary/30 bg-tertiary/10 text-tertiary">📦 {stats?.totalPulls || 0} Total Cards</span>
          </div>
        </div>
        {/* Quick stats */}
        {stats && (
          <div className="flex gap-3 flex-shrink-0">
            {[
              { v: stats.legendary, c: '#f8bd45', l: '✦' },
              { v: stats.epic,      c: '#c6bfff', l: '⬡' },
              { v: stats.rare,      c: '#47d6ff', l: '◆' },
            ].map((s,i) => (
              <div key={i} className="glass rounded-lg px-3 py-2 text-center min-w-[52px]">
                <div className="font-display text-lg font-bold" style={{ color: s.c }}>{s.v}</div>
                <div className="font-mono text-[9px] text-on-surface-variant">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="glass p-1 rounded-xl flex items-center gap-1 w-fit">
        {[
          { key: 'collection', label: `📦 Collection${stats ? ` (${stats.total})` : ''}` },
          { key: 'overview',   label: '📊 Overview' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`font-body text-xs px-5 py-2.5 rounded-lg font-semibold transition-colors ${
              tab === t.key ? 'bg-surface-container-high text-primary border border-white/10' : 'text-on-surface-variant hover:text-on-surface'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined text-3xl animate-spin text-on-surface-variant">refresh</span>
        </div>
      )}

      {/* Overview tab */}
      {!loading && tab === 'overview' && stats && (
        <>
          {/* Game breakdown */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-on-surface mb-4">Collection by Game</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Pokémon TCG', value:stats.pokemon, color:'#E3350D', icon:'⚡', pct:stats.total?Math.round(stats.pokemon/stats.total*100):0 },
                { label:'Yu-Gi-Oh!',  value:stats.yugioh,  color:'#F4B942', icon:'⚔️', pct:stats.total?Math.round(stats.yugioh/stats.total*100):0 },
                { label:'Dragon Ball',value:stats.dbs,     color:'#FF6B00', icon:'🔥', pct:stats.total?Math.round(stats.dbs/stats.total*100):0 },
              ].map(g => (
                <div key={g.label} className="glass rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-on-surface-variant">{g.icon} {g.label}</span>
                    <span className="font-mono text-xs font-bold" style={{ color:g.color }}>{g.value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${g.pct}%`, background:g.color }} />
                  </div>
                  <span className="font-mono text-[9px] text-on-surface-variant">{g.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent pulls */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">history</span>
                Recent Pulls
              </h3>
              <button onClick={() => setTab('collection')}
                className="font-mono text-[10px] text-tertiary hover:text-on-surface transition-colors">
                View All →
              </button>
            </div>
            {log.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-on-surface-variant">No pulls yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {log.map((p, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/5">
                    <span className="text-lg flex-shrink-0">
                      {p.tier==='legendary'?'✦':p.tier==='epic'?'⬡':p.tier==='rare'?'◆':'○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-on-surface font-semibold truncate">{p.card_name}</p>
                      <p className="font-mono text-[9px] text-on-surface-variant uppercase">{p.tier} • qty {p.qty}</p>
                    </div>
                    <span className="font-mono text-[9px] text-on-surface-variant flex-shrink-0">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Collection tab */}
      {!loading && tab === 'collection' && (
        <div className="glass rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-surface/20">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 pr-2 border-r border-white/10">
                {GAME_FILTERS.map(g => (
                  <button key={g.key} onClick={() => { setGameFilter(g.key); setPage(0) }}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      gameFilter===g.key ? g.cls : 'bg-white/5 text-on-surface-variant hover:text-on-surface'
                    }`}>{g.label}</button>
                ))}
              </div>
              {TIER_FILTERS.map(f => (
                <button key={f} onClick={() => { setTierFilter(f); setPage(0) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                    tierFilter===f ? 'bg-primary-container text-on-primary-container' : 'bg-white/5 text-on-surface-variant hover:text-on-surface'
                  }`}>{f==='all'?'All Tiers':f}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Search card..."
                  className="bg-surface-container-lowest/40 border border-white/15 rounded-full text-on-surface pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-44" />
              </div>
              <span className="font-mono text-[10px] text-tertiary bg-tertiary/10 border border-tertiary/20 px-2 py-1 rounded-lg">
                {filtered.length} / {cards.length}
              </span>
            </div>
          </div>

          {/* Grid */}
          <div className="p-6 min-h-[300px]">
            {cards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="text-5xl">📦</div>
                <p className="font-body text-on-surface-variant text-sm">Belum ada kartu. Pergi ke Gacha!</p>
                <button onClick={() => navigate('/gacha')} className="btn-primary px-6 py-2.5 rounded-xl font-body text-sm">Start Summoning</button>
              </div>
            ) : pageCards.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant font-mono text-xs">No cards match the filter.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pageCards.map(card => (
                  <CardItem key={`${card.id}-${card.setId}`} card={card} onClick={setSelected} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {filtered.length > PER && (
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <span className="font-mono text-[11px] text-on-surface-variant">
                {Math.min(page*PER+1,filtered.length)}–{Math.min((page+1)*PER,filtered.length)} of <span className="text-primary font-bold">{filtered.length}</span>
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 disabled:opacity-30">← Prev</button>
                <span className="px-3 py-1.5 font-mono text-xs text-on-surface">{page+1}/{totalPages}</span>
                <button onClick={() => setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card detail modal — vertical on mobile, horizontal on sm+ */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelected(null)}>
          <div className="relative rounded-2xl overflow-hidden flex flex-col sm:flex-row w-full"
            style={{
              maxWidth: 640, maxHeight: '92vh',
              background: 'linear-gradient(135deg,#0d1424,#07080f)',
              border: `1px solid ${
                selected.tier==='legendary'?'rgba(245,200,76,.4)':
                selected.tier==='epic'?'rgba(167,139,250,.4)':
                selected.tier==='rare'?'rgba(22,230,255,.4)':'rgba(255,255,255,.15)'
              }`,
            }}
            onClick={e => e.stopPropagation()}>

            {/* Close button */}
            <button onClick={() => setSelected(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background:'rgba(255,255,255,.1)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.15)' }}>✕</button>

            {/* Top/Left — card image (top on mobile, left on sm+) */}
            <div className="flex-shrink-0 flex items-center justify-center p-4 sm:p-6"
              style={{ background: 'rgba(255,255,255,.02)' }}>
              <div className="rounded-xl overflow-hidden mx-auto"
                style={{ width:'min(160px,45vw)', height:'min(224px,63vw)', boxShadow:'0 16px 48px rgba(0,0,0,.7)' }}>
                {selected.img
                  ? <img src={selected.img} alt={selected.name} referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      style={{ background:'rgba(8,10,18,1)', padding:'3px' }} />
                  : <div className="w-full h-full flex items-center justify-center text-4xl"
                      style={{ background:'rgba(8,10,18,1)' }}>
                      {selected.setId==='yugioh'?'⚔️':selected.setId==='dragonball'?'🔥':'🃏'}
                    </div>
                }
              </div>
            </div>

            {/* Right — info */}
            <div className="flex-1 flex flex-col justify-center gap-4 py-6 pr-6 pl-2 overflow-y-auto">

              {/* Game + tier */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded"
                  style={{ background:'rgba(255,255,255,.07)', color:'#9aa3b2' }}>
                  {selected.setId==='yugioh'?'⚔️ YGO':selected.setId==='dragonball'?'🔥 DBS':'⚡ PKM'}
                </span>
                <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                  selected.tier==='legendary'?'bg-secondary/20 text-secondary border-secondary/30':
                  selected.tier==='epic'?'bg-primary/20 text-primary border-primary/30':
                  selected.tier==='rare'?'bg-tertiary/20 text-tertiary border-tertiary/30':
                  'bg-white/10 text-on-surface border-white/10'
                }`}>{selected.tier}</span>
              </div>

              {/* Name */}
              <h3 className="font-display font-bold text-on-surface leading-tight" style={{ fontSize:18 }}>
                {selected.name}
              </h3>

              {/* Stats */}
              {(() => {
                const items = []
                if (selected.setId === 'yugioh') {
                  const ct = (selected.rarity ?? selected.types ?? '').toLowerCase()
                  const isLink = ct.includes('link')
                  const atk = selected.atk ?? (selected.hp !== '—' ? selected.hp : null)
                  if (atk != null) items.push({ label:'ATK', value:atk, color:'text-secondary' })
                  if (isLink && selected.level != null)
                    items.push({ label:'LINK', value:`⬡${selected.level}`, color:'text-purple-400' })
                  else if (!isLink && selected.def != null)
                    items.push({ label:'DEF', value:selected.def, color:'text-tertiary' })
                  if (!isLink && selected.level != null)
                    items.push({ label:'LEVEL', value:`★${selected.level}`, color:'text-yellow-400' })
                  if (selected.rarity || selected.types)
                    items.push({ label:'TYPE', value:selected.rarity ?? selected.types, color:'text-on-surface', wide:true })
                } else if (selected.setId === 'dragonball') {
                  const pw = selected.power ?? selected.hp
                  const cl = selected.color ?? selected.types
                  if (pw && pw !== '—') items.push({ label:'Power', value:pw, color:'text-orange-400' })
                  if (cl && cl !== '—') items.push({ label:'Color', value:cl, color:'text-on-surface' })
                } else {
                  if (selected.hp && selected.hp !== '—')
                    items.push({ label:'HP', value:selected.hp, color:'text-red-400' })
                  if (selected.types && selected.types !== '—')
                    items.push({ label:'Type', value:selected.types, color:'text-on-surface' })
                }
                if (!items.length) return null
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {items.map(s => (
                      <div key={s.label} className={`glass rounded-lg p-2 text-center ${s.wide ? 'col-span-2' : ''}`}>
                        <p className="font-mono text-[8px] text-on-surface-variant uppercase">{s.label}</p>
                        <p className={`font-mono text-xs font-bold truncate ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* NFT */}
              <div className="rounded-lg p-2.5 flex items-center gap-2"
                style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
                <span className="text-base flex-shrink-0">🔗</span>
                <div className="min-w-0">
                  <p className="font-mono text-[8px] text-on-surface-variant">NFT · Arc Testnet</p>
                  <p className="font-mono text-[9px] text-tertiary truncate">{selected.id}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelected(null); setListingCard(selected) }}
                  className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all"
                  style={{ background:'rgba(245,200,76,.1)', color:'#f5c84c', borderColor:'rgba(245,200,76,.3)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(245,200,76,.2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(245,200,76,.1)'}>
                  🏷️ List for Sale
                </button>
                <button onClick={() => setSelected(null)}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-mono text-xs font-bold">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List For Sale Modal */}
      {listingCard && (
        <ListModal
          card={listingCard}
          walletAddress={address}
          walletClient={walletClient}
          onClose={() => setListingCard(null)}
          onListed={() => setListingCard(null)}
        />)}
    </div>
  )
}
