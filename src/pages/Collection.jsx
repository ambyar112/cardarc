import { useState, useEffect } from 'react'
import { getCollection, getGachaLog, upsertProfile, getRealLeaderboard, getMyCollection, getMyProfile } from '../lib/supabase'
import { useAccount, useWalletClient } from 'wagmi'
import CardItem from '../components/CardItem'
import ListModal from '../components/ListModal'
import BulkListModal from '../components/BulkListModal'
import { useNavigate } from 'react-router-dom'

const PER     = 24
const FILTERS = ['all','legendary','epic','rare','common']
const TIER_COLORS = { legendary:'#f5c84c', epic:'#a78bfa', rare:'#16e6ff', common:'#9aa3b2' }

export default function Collection() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const navigate = useNavigate()
  const [cards, setCards]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(0)
  const [filter, setFilter]           = useState('all')
  const [gameFilter, setGameFilter]   = useState('all')
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(null)      // single detail modal
  const [listingCard, setListingCard] = useState(null)      // single list modal
  // ── Bulk select ──
  const [selectMode, setSelectMode]   = useState(false)
  const [bulkSelected, setBulkSelected] = useState(new Set())
  const [bulkModal, setBulkModal]     = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let collection = []
      try {
        const result = await getMyCollection(null, address)
        if (result?.success && Array.isArray(result.data)) {
          collection = result.data
        }
      } catch (e) {
        try {
          const r = await fetch('/api/public/collection').then(x => x.json()).catch(() => ({ data: [] }))
          collection = r?.data || []
        } catch {
          collection = []
        }
      }

      if (collection.length > 0) {
        setCards(collection.map(c => ({
          id:       c.card_id,
          name:     c.card_name,
          img:      c.card_img,
          tier:     c.tier,
          setId:    c.set_id,
          localId:  c.local_id,
          hp:       c.hp,
          types:    c.types,
          rarity:   c.rarity,
          atk:      c.atk,
          def:      c.def,
          level:    c.level,
          power:    c.set_id === 'dragonball' ? c.hp    : null,
          color:    c.set_id === 'dragonball' ? c.types : null,
          cardType: c.set_id === 'dragonball' ? c.rarity: null,
        })))
      } else {
        setCards([])
      }
      setLoading(false)
    }
    load()
  }, [isConnected, address, walletClient])

  // Exit select mode clears selection
  function toggleSelectMode() {
    setSelectMode(v => { if (v) setBulkSelected(new Set()); return !v })
  }

  function toggleCardSelect(card) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(card.id)) next.delete(card.id)
      else next.add(card.id)
      return next
    })
  }

  function selectAll() {
    setBulkSelected(new Set(pageCards.map(c => c.id)))
  }

  function clearSelection() {
    setBulkSelected(new Set())
  }

  const filtered = cards.filter(c => {
    const t = filter === 'all' || c.tier === filter
    const s = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const g = gameFilter === 'all'
      || (gameFilter === 'pokemon'    ? !['yugioh','dragonball'].includes(c.setId) : false)
      || (gameFilter === 'yugioh'     ? c.setId === 'yugioh' : false)
      || (gameFilter === 'dragonball' ? c.setId === 'dragonball' : false)
    return t && s && g
  })

  const totalPages  = Math.ceil(filtered.length / PER)
  const pageCards   = filtered.slice(page * PER, (page + 1) * PER)
  const bulkCards   = cards.filter(c => bulkSelected.has(c.id))

  const stats = {
    total:     cards.length,
    legendary: cards.filter(c => c.tier === 'legendary').length,
    pokemon:   cards.filter(c => !['yugioh','dragonball'].includes(c.setId)).length,
    yugioh:    cards.filter(c => c.setId === 'yugioh').length,
    dbs:       cards.filter(c => c.setId === 'dragonball').length,
  }

  return (
    <div className="pt-24 px-4 lg:px-12 pb-12 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">My Collection</h1>
          <p className="font-body text-on-surface-variant text-sm mt-1">
            {isConnected ? 'Cards pulled on Arc Testnet' : 'Connect wallet to see your collection'}
          </p>
        </div>
        {cards.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[
              { label:'Total',    value:stats.total,     color:'text-on-surface' },
              { label:'✦ Legend',value:stats.legendary, color:'text-secondary' },
              { label:'⚡ PKM',  value:stats.pokemon,   color:'text-red-400' },
              { label:'⚔️ YGO', value:stats.yugioh,    color:'text-yellow-400' },
              { label:'🔥 DBS', value:stats.dbs,       color:'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl px-3 py-2 text-center min-w-[60px]">
                <div className={`font-display text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="font-mono text-[9px] text-on-surface-variant uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4">
          <div className="text-5xl">🔐</div>
          <h3 className="font-display text-xl font-bold text-on-surface">Wallet Not Connected</h3>
          <p className="font-body text-on-surface-variant text-sm max-w-sm">Connect wallet untuk melihat koleksi kartu kamu.</p>
          <button onClick={() => navigate('/gacha')} className="btn-primary px-8 py-3 rounded-xl font-body text-sm mt-2">Go Summon Cards</button>
        </div>
      )}

      {isConnected && !loading && cards.length === 0 && (
        <div className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4">
          <div className="text-5xl">📦</div>
          <h3 className="font-display text-xl font-bold text-on-surface">Koleksi Masih Kosong</h3>
          <p className="font-body text-on-surface-variant text-sm max-w-sm">Pergi ke Gacha dan mulai summon!</p>
          <button onClick={() => navigate('/gacha')} className="btn-primary px-8 py-3 rounded-xl font-body text-sm mt-2">Start Summoning</button>
        </div>
      )}

      {isConnected && (loading || cards.length > 0) && (
        <div className="glass rounded-xl overflow-hidden">

          {/* Toolbar */}
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-surface/20">
            <div className="flex gap-2 flex-wrap items-center">
              {/* Game filter */}
              <div className="flex gap-1 pr-2 border-r border-white/10">
                {[
                  { key:'all',        label:'All',    cls:'bg-white/20 text-on-surface' },
                  { key:'pokemon',    label:'⚡ PKM', cls:'bg-red-500/20 text-red-300' },
                  { key:'yugioh',     label:'⚔️ YGO',cls:'bg-yellow-500/20 text-yellow-300' },
                  { key:'dragonball', label:'🔥 DBS', cls:'bg-orange-500/20 text-orange-300' },
                ].map(g => (
                  <button key={g.key} onClick={() => { setGameFilter(g.key); setPage(0) }}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      gameFilter===g.key ? g.cls : 'bg-white/5 text-on-surface-variant hover:text-on-surface'
                    }`}>{g.label}</button>
                ))}
              </div>
              {/* Tier filter */}
              {FILTERS.map(f => (
                <button key={f} onClick={() => { setFilter(f); setPage(0) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                    filter===f ? 'bg-primary-container text-on-primary-container' : 'bg-white/5 text-on-surface-variant hover:text-on-surface'
                  }`}>{f==='all'?'All Tiers':f}</button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Search card..."
                  className="bg-surface-container-lowest/40 border border-white/15 rounded-full text-on-surface pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-44" />
              </div>
              <span className="font-mono text-[10px] text-tertiary bg-tertiary/10 border border-tertiary/20 px-2 py-1 rounded-lg">
                {filtered.length} / {cards.length}
              </span>
              {/* Select mode toggle */}
              <button onClick={toggleSelectMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-mono uppercase transition-all"
                style={{
                  background: selectMode ? 'rgba(245,200,76,.15)' : 'rgba(255,255,255,.05)',
                  border: selectMode ? '1px solid rgba(245,200,76,.4)' : '1px solid rgba(255,255,255,.1)',
                  color: selectMode ? '#f5c84c' : '#9aa3b2',
                }}>
                {selectMode ? '✕ Cancel' : '🏷️ Bulk List'}
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectMode && (
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
              style={{ background:'rgba(245,200,76,.06)', borderBottom:'1px solid rgba(245,200,76,.15)' }}>
              <span className="font-mono text-[11px] font-bold" style={{ color:'#f5c84c' }}>
                {bulkSelected.size} kartu dipilih
              </span>
              <button onClick={selectAll}
                className="font-mono text-[10px] px-3 py-1 rounded-full transition-all"
                style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.12)' }}>
                Select All ({pageCards.length})
              </button>
              {bulkSelected.size > 0 && (
                <button onClick={clearSelection}
                  className="font-mono text-[10px] px-3 py-1 rounded-full transition-all"
                  style={{ background:'rgba(255,255,255,.04)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.08)' }}>
                  Clear
                </button>
              )}
              <div className="ml-auto">
                <button
                  onClick={() => bulkSelected.size > 0 && setBulkModal(true)}
                  disabled={bulkSelected.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                  style={{ background:'#f5c84c', color:'#07070F' }}>
                  🏷️ List {bulkSelected.size} Kartu
                </button>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="p-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl animate-spin">refresh</span>
                <p className="font-mono text-xs">Loading collection...</p>
              </div>
            ) : pageCards.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant font-mono text-xs">No cards match the filter.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pageCards.map(card => {
                  const isChecked = bulkSelected.has(card.id)
                  return (
                    <div key={`${card.id}-${card.setId}`} className="relative"
                      onClick={() => selectMode ? toggleCardSelect(card) : setSelected(card)}>
                      {/* Checkbox overlay in select mode */}
                      {selectMode && (
                        <div className="absolute top-2 left-2 z-20 pointer-events-none">
                          <div className="w-5 h-5 rounded flex items-center justify-center"
                            style={{
                              background: isChecked ? '#f5c84c' : 'rgba(0,0,0,.6)',
                              border: isChecked ? '2px solid #f5c84c' : '2px solid rgba(255,255,255,.4)',
                              transition: 'all .15s',
                            }}>
                            {isChecked && <span style={{ fontSize:11, color:'#07070F', fontWeight:900 }}>✓</span>}
                          </div>
                        </div>
                      )}
                      {/* Highlight ring when selected */}
                      {selectMode && isChecked && (
                        <div className="absolute inset-0 z-10 rounded-xl pointer-events-none"
                          style={{ border:'2px solid #f5c84c', boxShadow:'0 0 16px rgba(245,200,76,.4)' }} />
                      )}
                      {/* Dim unselected in select mode */}
                      <div style={{ opacity: selectMode && !isChecked ? 0.55 : 1, transition:'opacity .15s' }}>
                        <CardItem card={card} onClick={() => {}} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && filtered.length > PER && (
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <span className="font-mono text-[11px] text-on-surface-variant">
                {Math.min(page*PER+1,filtered.length)}–{Math.min((page+1)*PER,filtered.length)} of{' '}
                <span className="text-primary font-bold">{filtered.length}</span>
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

      {/* Single Card Detail Modal — vertical on mobile, horizontal on sm+ */}
      {selected && !selectMode && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelected(null)}>
          <div className="relative rounded-2xl overflow-hidden flex flex-col sm:flex-row w-full"
            style={{
              maxWidth:640, maxHeight:'92vh',
              background:'linear-gradient(135deg,#0d1424,#07080f)',
              border:`1px solid ${
                selected.tier==='legendary'?'rgba(245,200,76,.4)':
                selected.tier==='epic'?'rgba(167,139,250,.4)':
                selected.tier==='rare'?'rgba(22,230,255,.4)':'rgba(255,255,255,.15)'
              }`,
            }}
            onClick={e => e.stopPropagation()}>

            <button onClick={() => setSelected(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background:'rgba(255,255,255,.1)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.15)' }}>✕</button>

            {/* Image — top on mobile, left on sm+ */}
            <div className="flex-shrink-0 flex items-center justify-center p-4 sm:p-6"
              style={{ background:'rgba(255,255,255,.02)' }}>
              <div className="rounded-xl overflow-hidden mx-auto"
                style={{ width:'min(140px,42vw)', height:'min(196px,58vw)', boxShadow:'0 16px 48px rgba(0,0,0,.7)' }}>
                {selected.img
                  ? <img src={selected.img} alt={selected.name} referrerPolicy="no-referrer"
                      className="w-full h-full object-contain" style={{ background:'rgba(8,10,18,1)', padding:'3px' }} />
                  : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background:'rgba(8,10,18,1)' }}>
                      {selected.setId==='yugioh'?'⚔️':selected.setId==='dragonball'?'🔥':'🃏'}
                    </div>
                }
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-3 py-6 pr-6 pl-2 overflow-y-auto">
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
              <h3 className="font-display font-bold text-on-surface leading-tight" style={{ fontSize:17 }}>{selected.name}</h3>

              {(() => {
                const items = []
                if (selected.setId === 'yugioh') {
                  const ct = (selected.rarity ?? selected.types ?? '').toLowerCase()
                  const isLink = ct.includes('link')
                  const atk = selected.atk ?? (selected.hp !== '—' ? selected.hp : null)
                  if (atk != null) items.push({ label:'ATK', value:atk, color:'text-secondary' })
                  if (isLink && selected.level != null) items.push({ label:'LINK', value:`⬡${selected.level}`, color:'text-purple-400' })
                  else if (!isLink && selected.def != null) items.push({ label:'DEF', value:selected.def, color:'text-tertiary' })
                  if (!isLink && selected.level != null) items.push({ label:'LEVEL', value:`★${selected.level}`, color:'text-yellow-400' })
                  if (selected.rarity || selected.types) items.push({ label:'TYPE', value:selected.rarity??selected.types, color:'text-on-surface', wide:true })
                } else if (selected.setId === 'dragonball') {
                  const pw = selected.power ?? selected.hp
                  const cl = selected.color ?? selected.types
                  if (pw && pw !== '—') items.push({ label:'Power', value:pw, color:'text-orange-400' })
                  if (cl && cl !== '—') items.push({ label:'Color', value:cl, color:'text-on-surface' })
                } else {
                  if (selected.hp && selected.hp !== '—') items.push({ label:'HP', value:selected.hp, color:'text-red-400' })
                  if (selected.types && selected.types !== '—') items.push({ label:'Type', value:selected.types, color:'text-on-surface' })
                }
                if (!items.length) return null
                return (
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(s => (
                      <div key={s.label} className={`glass rounded-lg p-2 text-center ${s.wide?'col-span-2':''}`}>
                        <p className="font-mono text-[8px] text-on-surface-variant uppercase">{s.label}</p>
                        <p className={`font-mono text-xs font-bold truncate ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="rounded-lg p-2 flex items-center gap-2"
                style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
                <span className="text-sm flex-shrink-0">🔗</span>
                <p className="font-mono text-[9px] text-tertiary truncate">{selected.id}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setSelected(null); setListingCard(selected) }}
                  className="flex-1 py-2 rounded-xl font-mono text-xs font-bold border transition-all"
                  style={{ background:'rgba(245,200,76,.1)', color:'#f5c84c', borderColor:'rgba(245,200,76,.3)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(245,200,76,.2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(245,200,76,.1)'}>
                  🏷️ List for Sale
                </button>
                <button onClick={() => setSelected(null)} className="flex-1 btn-primary py-2 rounded-xl font-mono text-xs font-bold">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single ListModal */}
      {listingCard && (
        <ListModal card={listingCard} walletAddress={address} walletClient={walletClient}
          onClose={() => setListingCard(null)} onListed={() => setListingCard(null)} />
      )}

      {/* Bulk List Modal */}
      {bulkModal && bulkCards.length > 0 && (
        <BulkListModal
          cards={bulkCards}
          walletAddress={address}
          onClose={() => setBulkModal(false)}
          onDone={() => { setBulkModal(false); setSelectMode(false); setBulkSelected(new Set()) }}
        />
      )}
    </div>
  )
}
