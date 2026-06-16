import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { getActiveListingsFromSupabase, getMarketplaceHistory,
         markListingSold, markListingCancelled, saveListingToSupabase,
         getCollection } from '../lib/supabase'
import { fetchOnChainListings, purchaseListing, cancelListing,
         updateListingPrice, parseEther, formatEther } from '../lib/marketplace'
import ListModal from '../components/ListModal'
import BulkListModal from '../components/BulkListModal'
import CardItem from '../components/CardItem'
import PackCard from '../components/PackCard'

const TIER_COLORS = { legendary:'#f5c84c', epic:'#a78bfa', rare:'#16e6ff', common:'#9aa3b2' }
const TIER_BG     = { legendary:'rgba(245,200,76,.08)', epic:'rgba(167,139,250,.08)', rare:'rgba(22,230,255,.06)', common:'rgba(255,255,255,.03)' }
const TIER_FILTERS = ['all','legendary','epic','rare','common']

function shortAddr(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : '—' }
function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}
function gameLabel(cardId) {
  if (!cardId) return '⚡ PKM'
  if (cardId.startsWith('ygo-')) return '⚔️ YGO'
  if (cardId.startsWith('dbs-')) return '🔥 DBS'
  return '⚡ PKM'
}
function formatCardIdDisplay(cardId) {
  if (!cardId) return 'Unknown Card'
  if (cardId.startsWith('dbs-')) return cardId.replace('dbs-', '').toUpperCase()
  if (cardId.startsWith('ygo-')) return `Card #${cardId.replace('ygo-', '')}`
  const parts = cardId.split('-')
  if (parts.length >= 2) return `${parts[0].toUpperCase()} #${parts.slice(1).join('-')}`
  return cardId.toUpperCase()
}

// Resolve both name and image from cardId
async function resolveCardMeta(cardId) {
  let name = null, img = null
  if (!cardId) return { name, img }
  try {
    if (cardId.startsWith('ygo-')) {
      const id = cardId.replace('ygo-', '')
      const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${id}`, { referrerPolicy:'no-referrer' })
      const d = await r.json()
      name = d.data?.[0]?.name || null
      img  = d.data?.[0]?.card_images?.[0]?.image_url || null
    } else if (cardId.startsWith('dbs-')) {
      const code = cardId.replace('dbs-', '')
      const setCode = code.split('-')[0].toLowerCase()
      try {
        const r = await fetch(`https://raw.githubusercontent.com/apitcg/dragon-ball-fusion-tcg-data/main/cards/en/${setCode}.json`)
        if (r.ok) {
          const cards = await r.json()
          const card = cards.find(c => (c.id || c.code) === code)
          name = card?.name || null
          // Prefer GitHub-hosted images (no CORS issues)
          img = card?.images?.large || card?.images?.small || null
        }
      } catch {}
      // Last resort: dbs-cardgame.com (may be blocked by CORS)
      if (!img) img = `https://www.dbs-cardgame.com/fw/images/cards/card/en/${code}_f.webp`
    } else if (cardId.includes('-')) {
      const parts = cardId.split('-')
      const set = parts[0], num = parts.slice(1).join('-')
      const series = set.replace(/[0-9]/g, '').toLowerCase() || set.slice(0,2)
      img = `https://assets.tcgdex.net/en/${series}/${set}/${num}/high.webp`
      try {
        const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${set}-${num}`)
        if (r.ok) { const d = await r.json(); name = d.name || null }
      } catch {}
    }
  } catch {}
  return { name, img }
}

// ── Purchase Modal ────────────────────────────────────────────────
function PurchaseModal({ listing, onClose, onSuccess }) {
  const [step, setStep] = useState('confirm')
  const [errMsg, setErrMsg] = useState('')
  const [txHash, setTxHash] = useState('')
  const { address } = useAccount()
  const tc = TIER_COLORS[listing.tier] || '#9aa3b2'

  async function handleBuy() {
    setStep('buying')
    const res = await purchaseListing(listing.listingId, listing.price)
    if (!res.success) { setStep('error'); setErrMsg(res.error); return }
    setTxHash(res.hash)
    await markListingSold(listing.listingId, address)
    setStep('done')
    onSuccess?.()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ background:'linear-gradient(180deg,#0f1420,#09101a)', border:`1px solid ${tc}40`, boxShadow:`0 0 60px ${tc}15` }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <h3 className="font-mono font-bold text-base" style={{ color:'#eef2ff' }}>Purchase Card</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2' }}>✕</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:`${tc}10`, border:`1px solid ${tc}25` }}>
            {listing.card_img && <img src={listing.card_img} alt={listing.card_name} referrerPolicy="no-referrer" className="w-12 h-16 object-contain rounded-lg flex-shrink-0" style={{ background:'rgba(0,0,0,.4)' }} />}
            <div className="flex-1">
              <p className="font-mono font-bold text-sm" style={{ color:'#eef2ff' }}>
                {listing.card_name && listing.card_name !== listing.cardId ? listing.card_name : formatCardIdDisplay(listing.cardId)}
              </p>
              <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded" style={{ background:`${tc}20`, color:tc }}>{listing.tier}</span>
              <p className="font-mono text-[10px] mt-1" style={{ color:'#6b7280' }}>Seller: {shortAddr(listing.seller)}</p>
            </div>
          </div>
          {step === 'confirm' && (<>
            <div className="p-3 rounded-xl" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
              <div className="flex justify-between mb-2">
                <span className="font-mono text-[10px]" style={{ color:'#6b7280' }}>Price</span>
                <span className="font-mono font-bold text-sm" style={{ color:tc }}>{parseFloat(formatEther(BigInt(listing.price))).toFixed(4)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px]" style={{ color:'#6b7280' }}>Fee (2.5%)</span>
                <span className="font-mono text-[10px]" style={{ color:'#9aa3b2' }}>{(parseFloat(formatEther(BigInt(listing.price))) * 0.025).toFixed(5)} USDC</span>
              </div>
            </div>
            <p className="font-mono text-[9px]" style={{ color:'#6b7280' }}>⚠️ Transaksi irreversible.</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-mono text-xs" style={{ background:'rgba(255,255,255,.05)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.1)' }}>Cancel</button>
              <button onClick={handleBuy} className="flex-1 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background:tc, color:'#07070F' }}>Confirm Purchase</button>
            </div>
          </>)}
          {step === 'buying' && <div className="flex items-center justify-center gap-2 py-4"><p className="font-mono text-sm" style={{ color:tc }}>Processing...</p></div>}
          {step === 'done' && <div className="flex flex-col items-center gap-3 py-4"><span className="text-4xl">🎉</span><p className="font-mono font-bold text-sm" style={{ color:'#4ade80' }}>Berhasil!</p>{txHash && <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] underline" style={{ color:'#16e6ff' }}>View on ArcScan ↗</a>}<button onClick={onClose} className="px-8 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background:tc, color:'#07070F' }}>Done</button></div>}
          {step === 'error' && <div className="flex flex-col items-center gap-3 py-4"><span className="text-4xl">❌</span><p className="font-mono text-[10px] text-center" style={{ color:'#9aa3b2' }}>{errMsg}</p><button onClick={() => setStep('confirm')} className="px-8 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background:'rgba(255,255,255,.1)', color:'#eef2ff' }}>Try Again</button></div>}
        </div>
      </div>
    </div>
  )
}

// ── Edit Price Modal ──────────────────────────────────────────────
function EditPriceModal({ listing, onClose, onSuccess }) {
  const [price, setPrice] = useState(parseFloat(formatEther(BigInt(listing.price))).toFixed(4))
  const [step, setStep]   = useState('form')
  const [err, setErr]     = useState('')
  const tc = TIER_COLORS[listing.tier] || '#9aa3b2'

  async function handleUpdate() {
    const p = parseFloat(price)
    if (!p || p <= 0) { setErr('Harga tidak valid'); return }
    setStep('loading')
    const res = await updateListingPrice(listing.listingId, p)
    if (!res.success) { setStep('form'); setErr(res.error); return }
    setStep('done')
    onSuccess?.()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-xs overflow-hidden" style={{ background:'linear-gradient(180deg,#0f1420,#09101a)', border:`1px solid ${tc}40` }} onClick={e=>e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <p className="font-mono font-bold text-sm" style={{ color:'#eef2ff' }}>Edit Price</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2' }}>✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] truncate" style={{ color:'#9aa3b2' }}>
            {listing.card_name && listing.card_name !== listing.cardId ? listing.card_name : formatCardIdDisplay(listing.cardId)}
          </p>
          {step === 'form' && (<>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.001" value={price} onChange={e=>{setPrice(e.target.value);setErr('')}}
                className="flex-1 bg-transparent border rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none"
                style={{ borderColor:'rgba(255,255,255,.15)' }}
                onFocus={e=>e.target.style.borderColor=tc} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.15)'} />
              <span className="font-mono text-sm font-bold" style={{ color:'#16e6ff' }}>USDC</span>
            </div>
            {err && <p className="font-mono text-[10px]" style={{ color:'#ff6b6b' }}>⚠️ {err}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded-xl font-mono text-xs" style={{ background:'rgba(255,255,255,.05)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.1)' }}>Cancel</button>
              <button onClick={handleUpdate} className="flex-1 py-2 rounded-xl font-mono font-bold text-xs" style={{ background:tc, color:'#07070F' }}>Update</button>
            </div>
          </>)}
          {step === 'loading' && <div className="flex items-center justify-center py-3"><p className="font-mono text-xs" style={{ color:tc }}>Loading...</p></div>}
          {step === 'done' && <div className="flex flex-col items-center gap-2 py-3"><span className="text-2xl">✅</span><p className="font-mono text-xs" style={{ color:'#4ade80' }}>Updated!</p><button onClick={onClose} className="px-6 py-1.5 rounded-xl font-mono font-bold text-xs" style={{ background:tc, color:'#07070F' }}>Done</button></div>}
        </div>
      </div>
    </div>
  )
}

// ── Listing Card ─────────────────────────────────────────────────
function ListingCard({ listing, address, onBuy, onCancel, onEdit, cancelingId }) {
  const tc = TIER_COLORS[listing.tier] || '#9aa3b2'
  const isOwn = address && listing.seller.toLowerCase() === address.toLowerCase()
  const priceEth = parseFloat(formatEther(BigInt(listing.price))).toFixed(4)
  const displayName = listing.card_name && listing.card_name !== listing.cardId
    ? listing.card_name : formatCardIdDisplay(listing.cardId)
  const isCanceling = cancelingId === listing.listingId

  // Construct fallback image from cardId
  const cid = listing.cardId || ''
  const fallbackImg = listing.card_img
    ? listing.card_img
    : cid.includes('-') && !cid.startsWith('ygo-') && !cid.startsWith('dbs-')
      ? (() => {
          const p = cid.split('-')
          const set = p[0] // e.g. "swsh8", "sv02"
          const num = p.slice(1).join('-')
          // TCGDex URL format: /en/{series}/{set}/{num}/high.webp
          // Series = first 4 chars: swsh8→swsh, sv02→sv
          const series = set.replace(/[0-9]/g, '').toLowerCase() || set.slice(0,4)
          return `https://assets.tcgdex.net/en/${series}/${set}/${num}/high.webp`
        })()
      : null

  // Determine game from cardId OR set_id
  const gameTag = cid.startsWith('ygo-') ? '⚔️ YGO'
    : cid.startsWith('dbs-') ? '🔥 DBS'
    : listing.set_id === 'yugioh' ? '⚔️ YGO'
    : listing.set_id === 'dragonball' ? '🔥 DBS'
    : '⚡ PKM'

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background:TIER_BG[listing.tier]||'rgba(255,255,255,.02)',
        border:`1px solid ${tc}25`,
        opacity: isCanceling ? 0.4 : 1,
        transition: 'opacity .15s',
      }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=`${tc}60`}
      onMouseLeave={e=>e.currentTarget.style.borderColor=`${tc}25`}>

      {/* Image */}
      <div className="relative aspect-[3/4] bg-black/40 flex items-center justify-center overflow-hidden">
        {fallbackImg
          ? <img src={fallbackImg} alt={displayName} referrerPolicy="no-referrer"
              width="200" height="280"
              className="w-full h-full object-contain p-2"
              onError={e => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.style.setProperty('display', 'flex')
              }} />
          : null
        }
        {(!fallbackImg) && (
          <span className="text-4xl" aria-hidden="true">🃏</span>
        )}
        {/* Tier badge — dark bg for contrast */}
        <div className="absolute top-2 left-2 font-mono text-[8px] font-bold uppercase px-2 py-0.5 rounded"
          style={{ background:'rgba(0,0,0,0.75)', color:'#ffffff', border:`1px solid ${tc}60` }}>
          {listing.tier}
        </div>
        {/* Game badge — high contrast */}
        <div className="absolute top-2 right-2 font-mono text-[9px] font-bold"
          style={{ background:'rgba(0,0,0,0.7)', color:'#ffffff', padding:'1px 5px', borderRadius:4 }}>
          {gameTag}
        </div>
        {isOwn && (
          <div className="absolute bottom-2 left-2 font-mono text-[8px] font-bold px-2 py-0.5 rounded"
            style={{ background:'rgba(0,245,255,.9)', color:'#003739', border:'none' }}>
            YOURS
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="font-mono text-[11px] font-bold truncate" style={{ color:'#eef2ff' }}>{displayName}</p>
        <p className="font-mono text-[9px]" style={{ color:'#6b7280' }}>
          {isOwn ? 'Your listing' : `Seller: ${shortAddr(listing.seller)}`}
        </p>
        <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop:'1px solid rgba(255,255,255,.05)' }}>
          <div>
            <p className="font-mono text-[8px]" style={{ color:'#6b7280' }}>Price</p>
            <p className="font-mono font-bold text-sm" style={{ color:tc }}>{priceEth} USDC</p>
          </div>
          {isOwn ? (
            <div className="flex gap-1">
              <button onClick={() => onEdit(listing)} className="px-2.5 py-1.5 rounded-lg font-mono text-[9px] font-bold"
                style={{ background:'rgba(22,230,255,.1)', color:'#16e6ff', border:'1px solid rgba(22,230,255,.25)' }}>Edit</button>
              <button onClick={() => onCancel(listing)} disabled={cancelingId === listing.listingId}
                className="px-2.5 py-1.5 rounded-lg font-mono text-[9px] font-bold disabled:opacity-50"
                style={{ background:'rgba(255,107,107,.1)', color:'#ff6b6b', border:'1px solid rgba(255,107,107,.25)' }}>
                {cancelingId === listing.listingId ? '...' : 'Cancel'}
              </button>
            </div>
          ) : (
            <button onClick={() => onBuy(listing)} className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold"
              style={{ background:tc, color:'#07070F' }}>Buy</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function Marketplace() {
  const { address, isConnected } = useAccount()
  const [tab, setTab]               = useState('packs')
  const [listings, setListings]     = useState([])
  const [loadingL, setLoadingL]     = useState(true)
  const [trades, setTrades]         = useState([])
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeSearch, setTradeSearch]   = useState('')
  const [selectedPack, setSelectedPack] = useState(null)
  const [buyTarget, setBuyTarget]   = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [cancelingId, setCancelingId] = useState(null)
  const [myCards, setMyCards]           = useState([])
  const [myCardsLoading, setMyCardsLoading] = useState(false)
  const [sellSearch, setSellSearch]     = useState('')
  const [sellTierFilter, setSellTierFilter] = useState('all')
  const [sellGameFilter, setSellGameFilter] = useState('all')
  const [listingCard, setListingCard]   = useState(null)
  const [bulkSelected, setBulkSelected] = useState(new Set())
  const [bulkModal, setBulkModal]       = useState(false)
  const [selectMode, setSelectMode]     = useState(false)

  const loadListings = useCallback(async () => {
    setLoadingL(true)
    const onChain = await fetchOnChainListings(50)
    if (onChain.length > 0) {
      const sbData = await getActiveListingsFromSupabase(50)
      const sbMap = {}
      sbData.forEach(s => {
        if (s.on_chain_listing_id != null) sbMap[Number(s.on_chain_listing_id)] = s
        if (s.id) sbMap[s.id] = s
      })
      const merged = onChain.map(l => {
        const sb = sbMap[l.listingId] || sbMap[String(l.listingId)] || {}
        return { ...l, card_name:sb.card_name||l.cardId, card_img:sb.card_img||null, tier:sb.tier||'common', set_id:sb.set_id||null }
      })

      // Resolve missing name/image in background
      const needsMeta = merged.filter(l => !l.card_img || l.card_name === l.cardId)
      setListings(merged)
      setLoadingL(false)
      if (needsMeta.length > 0) {
        const resolved = [...merged]
        await Promise.all(needsMeta.map(async l => {
          const { name, img } = await resolveCardMeta(l.cardId)
          const idx = resolved.findIndex(r => r.listingId === l.listingId)
          if (idx !== -1) {
            const newName = (name && name !== l.cardId) ? name : l.card_name
            const newImg  = img || l.card_img
            if (newName !== resolved[idx].card_name || newImg !== resolved[idx].card_img) {
              resolved[idx] = { ...resolved[idx], card_name:newName, card_img:newImg }
              saveListingToSupabase({
                listingId: l.listingId, seller: l.seller, cardId: l.cardId,
                cardName: newName, cardImg: newImg, tier: l.tier,
                setId: l.set_id, priceEth: parseFloat(formatEther(BigInt(l.price))),
              }).catch(()=>{})
            }
          }
        }))
        setListings([...resolved])
      }
    } else {
      setListings([])
      setLoadingL(false)
    }
  }, [])

  useEffect(() => { loadListings() }, [loadListings])

  useEffect(() => {
    if (tab !== 'history') return
    setTradeLoading(true)
    getMarketplaceHistory(50).then(d => { setTrades(d); setTradeLoading(false) })
  }, [tab])

  useEffect(() => {
    if (tab !== 'sell' || !isConnected || !address) return
    setMyCardsLoading(true)
    getCollection(address).then(saved => {
      setMyCards(saved.map(c => ({
        id:c.card_id, name:c.card_name, img:c.card_img, tier:c.tier, setId:c.set_id,
        localId:c.local_id, hp:c.hp, types:c.types, rarity:c.rarity, atk:c.atk, def:c.def, level:c.level,
        power:c.set_id==='dragonball'?c.hp:null, color:c.set_id==='dragonball'?c.types:null, cardType:c.set_id==='dragonball'?c.rarity:null,
      })))
      setMyCardsLoading(false)
    })
  }, [tab, isConnected, address])

  async function handleCancel(listing) {
    setCancelingId(listing.listingId)
    const res = await cancelListing(listing.listingId)
    if (res.success) {
      await markListingCancelled(listing.listingId)
      // Remove from local state immediately - no reload flash
      setListings(prev => prev.filter(l => l.listingId !== listing.listingId))
    }
    setCancelingId(null)
  }

  function toggleSelectMode() { setSelectMode(v => { if (v) setBulkSelected(new Set()); return !v }) }
  function toggleCard(card) { setBulkSelected(prev => { const n=new Set(prev); n.has(card.id)?n.delete(card.id):n.add(card.id); return n }) }

  const filteredListings = listings.filter(l => {
    if (!selectedPack) return true
    const g=gameLabel(l.cardId)
    return selectedPack==='pokemon'?g==='⚡ PKM':selectedPack==='yugioh'?g==='⚔️ YGO':selectedPack==='dragonball'?g==='🔥 DBS':true
  })
  const myListings = listings.filter(l => address && l.seller.toLowerCase() === address.toLowerCase())
  const filteredSellCards = myCards.filter(c => {
    const t=sellTierFilter==='all'||c.tier===sellTierFilter
    const s=!sellSearch||c.name.toLowerCase().includes(sellSearch.toLowerCase())
    const g=sellGameFilter==='all'||(sellGameFilter==='pokemon'?!['yugioh','dragonball'].includes(c.setId):sellGameFilter==='yugioh'?c.setId==='yugioh':sellGameFilter==='dragonball'?c.setId==='dragonball':true)
    return t&&s&&g
  })
  const bulkCards = myCards.filter(c => bulkSelected.has(c.id))
  const filteredTrades = trades.filter(t => {
    const searchMatch = !tradeSearch||t.card_name?.toLowerCase().includes(tradeSearch.toLowerCase())||t.seller?.includes(tradeSearch)||t.buyer?.includes(tradeSearch)
    if (!selectedPack) return searchMatch
    const g=gameLabel(t.card_id)
    const packMatch = selectedPack==='pokemon'?g==='⚡ PKM':selectedPack==='yugioh'?g==='⚔️ YGO':selectedPack==='dragonball'?g==='🔥 DBS':true
    return searchMatch && packMatch
  })

  // Pack counts
  const pokemonCount = listings.filter(l => gameLabel(l.cardId) === '⚡ PKM').length
  const yugiohCount = listings.filter(l => gameLabel(l.cardId) === '⚔️ YGO').length
  const dragonballCount = listings.filter(l => gameLabel(l.cardId) === '🔥 DBS').length

  function handlePackSelect(pack) {
    setSelectedPack(pack)
    setTab('listings')
  }

  return (
    <div className="pt-24 px-4 lg:px-12 pb-12 max-w-[1400px] mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {tab !== 'packs' && (
            <button
              onClick={() => { setTab('packs'); setSelectedPack(null) }}
              className="glass p-2 rounded-xl border border-white/10 hover:border-primary/40 transition-colors"
              title="Back to Packs"
            >
              <span className="material-symbols-outlined text-base text-on-surface-variant">arrow_back</span>
            </button>
          )}
          <div className="glass p-1 rounded-xl flex items-center gap-1">
            {[
              { id:'packs',    label:'Packs',          count:null },
              { id:'listings', label:'Active Listings', count:filteredListings.length },
              { id:'my',       label:'My Listings',     count:myListings.length },
              { id:'history',  label:'Trade History',   count:null },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`font-body text-xs px-4 py-2.5 rounded-lg font-semibold transition-colors ${
                  tab===t.id ? 'bg-surface-container-high text-primary border border-white/10' : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {t.label}
                {t.count!=null && t.count>0 && <span className="ml-1.5 font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{t.count}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setTab('sell')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-body text-xs font-bold transition-all"
            style={{
              background: tab==='sell' ? 'linear-gradient(135deg,#f5c84c,#ff9900)' : 'rgba(245,200,76,.1)',
              border: tab==='sell' ? '1px solid #f5c84c' : '1px solid rgba(245,200,76,.4)',
              color: tab==='sell' ? '#07070F' : '#f5c84c',
              boxShadow: tab==='sell' ? '0 0 20px rgba(245,200,76,.4)' : 'none',
            }}>
            <span style={{ fontSize:14 }}>🏷️</span> Sell Cards
          </button>
        </div>
        <div className="flex items-center gap-2">
          {selectedPack && (
            <div className="glass px-3 py-2 rounded-full border border-primary/20 text-xs flex items-center gap-2">
              <span className="font-mono text-primary">
                {selectedPack === 'pokemon' ? '⚡ Pokemon' : selectedPack === 'yugioh' ? '⚔️ Yugioh' : '🔥 Dragon Ball'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-full border border-green-500/20 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="font-mono text-green-400">On-chain • Arc Test</span>
          </div>
          <button onClick={loadListings} className="w-8 h-8 flex items-center justify-center rounded-full glass border border-white/10" style={{ color:'#9aa3b2' }}
            onMouseEnter={e=>e.currentTarget.style.color='#eef2ff'} onMouseLeave={e=>e.currentTarget.style.color='#9aa3b2'}>
            <span className="material-symbols-outlined" style={{ fontSize:15 }}>refresh</span>
          </button>
        </div>
      </div>

      {/* ── PACK SELECTION ── */}
      {tab === 'packs' && (
        <div className="flex flex-col gap-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Choose Your Pack</h2>
            <p className="font-body text-sm text-on-surface-variant">Browse cards by game collection</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            <PackCard game="pokemon" count={pokemonCount} onClick={() => handlePackSelect('pokemon')} loading={loadingL} />
            <PackCard game="yugioh" count={yugiohCount} onClick={() => handlePackSelect('yugioh')} loading={loadingL} />
            <PackCard game="dragonball" count={dragonballCount} onClick={() => handlePackSelect('dragonball')} loading={loadingL} />
          </div>
        </div>
      )}

      {/* ── ACTIVE LISTINGS ── */}
      {tab === 'listings' && (<>
        {loadingL ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <span className="font-mono text-xs text-on-surface-variant">Loading...</span>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)' }}>
              <span className="material-symbols-outlined" style={{ fontSize:44, color:'#9aa3b2' }}>storefront</span>
            </div>
            <div className="text-center flex flex-col gap-2 max-w-sm">
              <h2 className="font-mono font-bold uppercase tracking-widest" style={{ fontSize:16, color:'#eef2ff' }}>Belum Ada Listing</h2>
              <p className="font-mono text-[12px]" style={{ color:'#6b7280' }}>Jadilah yang pertama! Pergi ke <strong style={{ color:'#f5c84c' }}>🏷️ Sell Cards</strong></p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredListings.map(l => (
              <ListingCard key={l.listingId} listing={l} address={address}
                onBuy={isConnected ? setBuyTarget : ()=>{}} onCancel={handleCancel} onEdit={setEditTarget} cancelingId={cancelingId} />
            ))}
          </div>
        )}
      </>)}

      {/* ── MY LISTINGS ── */}
      {tab === 'my' && (!isConnected ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-5xl">🔐</span>
          <p className="font-mono text-sm" style={{ color:'#9aa3b2' }}>Connect wallet dulu</p>
        </div>
      ) : myListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-5xl">📋</span>
          <p className="font-mono font-bold text-sm" style={{ color:'#eef2ff' }}>Belum ada listing aktif</p>
          <button onClick={() => setTab('sell')} className="px-6 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background:'#f5c84c', color:'#07070F' }}>🏷️ Sell Cards</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {myListings.map(l => (
            <ListingCard key={l.listingId} listing={l} address={address}
              onBuy={setBuyTarget} onCancel={handleCancel} onEdit={setEditTarget} cancelingId={cancelingId} />
          ))}
        </div>
      ))}

      {/* ── SELL ── */}
      {tab === 'sell' && (!isConnected ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-5xl">🔐</span>
          <p className="font-mono text-sm" style={{ color:'#9aa3b2' }}>Connect wallet untuk listing kartu</p>
        </div>
      ) : (<>
        <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 pr-2 border-r border-white/10">
              {[{k:'all',l:'All',c:'bg-white/20 text-on-surface'},{k:'pokemon',l:'⚡ PKM',c:'bg-red-500/20 text-red-300'},{k:'yugioh',l:'⚔️ YGO',c:'bg-yellow-500/20 text-yellow-300'},{k:'dragonball',l:'🔥 DBS',c:'bg-orange-500/20 text-orange-300'}].map(g => (
                <button key={g.k} onClick={()=>setSellGameFilter(g.k)} className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${sellGameFilter===g.k?g.c:'bg-white/5 text-on-surface-variant hover:text-on-surface'}`}>{g.l}</button>
              ))}
            </div>
            {TIER_FILTERS.map(f => (
              <button key={f} onClick={()=>setSellTierFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${sellTierFilter===f?'bg-primary-container text-on-primary-container':'bg-white/5 text-on-surface-variant hover:text-on-surface'}`}>{f==='all'?'All':f}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input value={sellSearch} onChange={e=>setSellSearch(e.target.value)} placeholder="Search..."
                className="bg-surface-container-lowest/40 border border-white/15 rounded-full text-on-surface pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-36" />
            </div>
            <button onClick={toggleSelectMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-mono uppercase transition-all"
              style={{ background:selectMode?'rgba(245,200,76,.15)':'rgba(255,255,255,.05)', border:selectMode?'1px solid rgba(245,200,76,.4)':'1px solid rgba(255,255,255,.1)', color:selectMode?'#f5c84c':'#9aa3b2' }}>
              {selectMode ? '✕ Cancel' : '☑ Multi-Select'}
            </button>
          </div>
        </div>

        {selectMode && (
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap rounded-xl" style={{ background:'rgba(245,200,76,.06)', border:'1px solid rgba(245,200,76,.2)' }}>
            <span className="font-mono text-[11px] font-bold" style={{ color:'#f5c84c' }}>{bulkSelected.size} dipilih</span>
            <button onClick={()=>setBulkSelected(new Set(filteredSellCards.map(c=>c.id)))} className="font-mono text-[10px] px-3 py-1 rounded-full" style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.12)' }}>Pilih Semua ({filteredSellCards.length})</button>
            {bulkSelected.size>0 && <button onClick={()=>setBulkSelected(new Set())} className="font-mono text-[10px] px-3 py-1 rounded-full" style={{ background:'rgba(255,255,255,.04)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.08)' }}>Clear</button>}
            <div className="ml-auto">
              <button disabled={bulkSelected.size===0} onClick={()=>bulkSelected.size>0&&setBulkModal(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-40" style={{ background:'#f5c84c', color:'#07070F' }}>
                🏷️ List {bulkSelected.size} Kartu
              </button>
            </div>
          </div>
        )}

        {myCardsLoading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <span className="font-mono text-xs text-on-surface-variant">Loading...</span>
          </div>
        ) : myCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="text-5xl">📦</span>
            <p className="font-mono font-bold text-sm" style={{ color:'#eef2ff' }}>Koleksi Kosong</p>
            <p className="font-mono text-[12px]" style={{ color:'#6b7280' }}>Pull kartu dari Gacha dulu!</p>
          </div>
        ) : filteredSellCards.length === 0 ? (
          <div className="text-center py-12 font-mono text-xs text-on-surface-variant">No cards match.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredSellCards.map(card => {
              const isChecked = bulkSelected.has(card.id)
              return (
                <div key={`${card.id}-${card.setId}`} className="relative cursor-pointer" onClick={() => selectMode ? toggleCard(card) : setListingCard(card)}>
                  {selectMode && (
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <div className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ background:isChecked?'#f5c84c':'rgba(0,0,0,.6)', border:isChecked?'2px solid #f5c84c':'2px solid rgba(255,255,255,.4)', transition:'all .15s' }}>
                        {isChecked && <span style={{ fontSize:11, color:'#07070F', fontWeight:900 }}>✓</span>}
                      </div>
                    </div>
                  )}
                  {selectMode && isChecked && <div className="absolute inset-0 z-10 rounded-xl pointer-events-none" style={{ border:'2px solid #f5c84c', boxShadow:'0 0 16px rgba(245,200,76,.4)' }} />}
                  <div style={{ opacity:selectMode&&!isChecked?0.55:1, transition:'opacity .15s' }}>
                    <CardItem card={card} onClick={()=>{}} />
                  </div>
                  {!selectMode && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 hover:opacity-100 transition-opacity" style={{ background:'linear-gradient(to top, rgba(0,0,0,.9), transparent)' }}>
                      <button onClick={e=>{e.stopPropagation();setListingCard(card)}} className="w-full py-1.5 rounded-lg font-mono text-[10px] font-bold" style={{ background:'#f5c84c', color:'#07070F' }}>🏷️ Sell</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>))}

      {/* ── TRADE HISTORY ── */}
      {tab === 'history' && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-surface-container-low/40">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-base">swap_horiz</span>
              <h3 className="font-display text-sm font-semibold text-on-surface">Trade History</h3>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">{tradeLoading?'...':filteredTrades.length} trades</span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">● LIVE</span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input value={tradeSearch} onChange={e=>setTradeSearch(e.target.value)} placeholder="Search card, wallet..."
                className="bg-surface-container-lowest/40 border border-white/15 rounded-full text-on-surface pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-52" />
            </div>
          </div>
          {tradeLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant"><span className="font-mono text-xs">Loading...</span></div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant"><span className="text-3xl">📭</span><p className="font-mono text-xs">Belum ada transaksi.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-surface-container-lowest/30">
                    {['Card','Game','Seller','Buyer','Price','Status','Time'].map(h=>(
                      <th key={h} className="px-4 py-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTrades.map((t,i)=>{
                    const isSeller=address&&t.seller?.toLowerCase()===address.toLowerCase()
                    const isBuyer=address&&t.buyer?.toLowerCase()===address.toLowerCase()
                    const tc=TIER_COLORS[t.tier]||'#9aa3b2'
                    const isSold=t.status==='sold'
                    return (
                      <tr key={t.id||i} className={`transition-colors hover:bg-white/5 ${isSeller||isBuyer?'bg-primary/5 border-l-2 border-primary':''}`}>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:tc }} /><span className="font-body text-xs text-on-surface font-semibold truncate max-w-[120px]">{t.card_name||formatCardIdDisplay(t.card_id)}</span></div></td>
                        <td className="px-4 py-3"><span className="font-mono text-[10px] text-on-surface-variant">{gameLabel(t.card_id)}</span></td>
                        <td className="px-4 py-3"><span className={`font-mono text-[10px] ${isSeller?'text-primary font-bold':'text-tertiary'}`}>{isSeller?'YOU':shortAddr(t.seller)}</span></td>
                        <td className="px-4 py-3"><span className={`font-mono text-[10px] ${isBuyer?'text-primary font-bold':'text-on-surface-variant'}`}>{isSold?(isBuyer?'YOU':shortAddr(t.buyer)):'—'}</span></td>
                        <td className="px-4 py-3"><span className="font-mono text-xs font-bold" style={{ color:tc }}>{t.price_usdc} USDC</span></td>
                        <td className="px-4 py-3"><span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase ${isSold?'bg-green-500/15 text-green-400 border border-green-500/25':'bg-white/5 text-on-surface-variant border border-white/10'}`}>{isSold?'✓ Sold':'✕ Cancelled'}</span></td>
                        <td className="px-4 py-3"><span className="font-mono text-[10px] text-on-surface-variant">{timeAgo(t.created_at)}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between bg-surface-container-lowest/20">
            <span className="font-mono text-[10px] text-on-surface-variant">{tradeLoading?'—':`${filteredTrades.length} of ${trades.length} trades`}</span>
            <span className="font-mono text-[10px] text-on-surface-variant">Arc Testnet • Chain 5042002</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {buyTarget && <PurchaseModal listing={buyTarget} onClose={()=>setBuyTarget(null)} onSuccess={()=>{setBuyTarget(null);loadListings()}} />}
      {editTarget && <EditPriceModal listing={editTarget} onClose={()=>setEditTarget(null)} onSuccess={()=>{setEditTarget(null);loadListings()}} />}
      {listingCard && <ListModal card={listingCard} walletAddress={address} onClose={()=>setListingCard(null)} onListed={()=>{setListingCard(null);loadListings()}} />}
      {bulkModal && bulkCards.length>0 && <BulkListModal cards={bulkCards} walletAddress={address} onClose={()=>setBulkModal(false)} onDone={()=>{setBulkModal(false);setSelectMode(false);setBulkSelected(new Set());loadListings()}} />}
    </div>
  )
}
