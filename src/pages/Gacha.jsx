import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { api } from '../lib/apiClient'
import CardItem from '../components/CardItem'
import { SummonOverlay, SummonOverlay10 } from '../components/SummonOverlay'
import { fetchSetCards, tierBadge } from '../lib/tcgdex'
import { fetchYugiohCards } from '../lib/yugioh'
import { fetchDragonBallCards } from '../lib/dragonball'
import { logPull, addToCollection } from '../lib/supabase'
import { mintCardNFT, mintCardBatchNFT } from '../lib/mint'

const PACKS = [
  {
    id: 'pokemon', game: 'pokemon', label: 'Pokémon TCG',
    sub: 'Sword & Shield · Scarlet & Violet',
    accent: '#16e6ff', accentRgb: '22,230,255',
    sets: ['swsh8','swsh12','sv02','sv04','sv08','swsh11'],
    img: 'https://assets.tcgdex.net/en/swsh/swsh8/74/high.webp',
    cost: 0,
    badge: 'PKM',
    dropRates: [
      { tier: 'legendary', pct: 3,  label: 'VMAX / Secret / Special Illustration', color: '#f5c84c' },
      { tier: 'epic',      pct: 12, label: 'VSTAR / V / ex / Full Art',            color: '#a78bfa' },
      { tier: 'rare',      pct: 28, label: 'Holo Rare',                            color: '#16e6ff' },
      { tier: 'common',   pct: 57, label: 'Common / Uncommon',                    color: '#9aa3b2' },
    ],
    highlights: ['Charizard VMAX','Charizard ex','Rayquaza VMAX','Umbreon VMAX','Miraidon ex','Koraidon ex','Gardevoir ex'],
  },
  {
    id: 'yugioh', game: 'yugioh', label: 'Yu-Gi-Oh!',
    sub: 'Dark · Dragon · Synchro · Fusion',
    accent: '#f5c84c', accentRgb: '245,200,76',
    ygoType: 'dark',
    img: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
    cost: 0,
    badge: 'YGO',
    dropRates: [
      { tier: 'legendary', pct: 5,  label: 'Boss Monster (ATK 3000+)', color: '#f5c84c' },
      { tier: 'epic',      pct: 15, label: 'Synchro / XYZ / Link',     color: '#a78bfa' },
      { tier: 'rare',      pct: 30, label: 'High-Level Monster',        color: '#16e6ff' },
      { tier: 'common',   pct: 50, label: 'Normal / Effect Monster',   color: '#9aa3b2' },
    ],
    highlights: ['Dark Magician','Blue-Eyes White Dragon','Exodia','Jinzo','Red-Eyes Black Dragon','Stardust Dragon'],
  },
  {
    id: 'dragonball', game: 'dragonball', label: 'Dragon Ball Super',
    sub: 'Fusion World · FB01–FB06',
    accent: '#ff5b22', accentRgb: '255,91,34',
    dbsColor: null,
    img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB01-001_f.webp',
    cost: 0,
    badge: 'DBS',
    dropRates: [
      { tier: 'legendary', pct: 3,  label: 'Special Rare (SPR)',       color: '#f5c84c' },
      { tier: 'epic',      pct: 12, label: 'Super Rare / Leader (SR)', color: '#a78bfa' },
      { tier: 'rare',      pct: 30, label: 'Rare / Uncommon',          color: '#16e6ff' },
      { tier: 'common',   pct: 55, label: 'Common',                   color: '#9aa3b2' },
    ],
    highlights: ['Son Goku','Vegeta','Beerus','Frieza','Gohan','Broly','Ultra Instinct Goku','Jiren'],
  },
]

const TIER_COLORS = { legendary:'#f5c84c', epic:'#a78bfa', rare:'#16e6ff', common:'#9aa3b2' }

function CardDetailModal({ card, onClose, accentRgb }) {
  if (!card) return null
  const tierColor = TIER_COLORS[card.tier] || '#9aa3b2'

  // Collect stats that exist
  const stats = []
  if (card.hp != null && card.hp !== '—') stats.push({ label: card.setId === 'yugioh' ? 'ATK' : 'HP', value: card.hp, color: tierColor })
  if (card.def != null) stats.push({ label: 'DEF', value: card.def, color: '#9aa3b2' })
  if (card.level != null) stats.push({ label: 'LEVEL', value: `★${card.level}`, color: '#f5c84c' })
  if (card.types && card.types !== '—') stats.push({ label: 'TYPE', value: card.types, color: '#c5ccda' })

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="relative rounded-2xl overflow-hidden flex flex-col sm:flex-row gap-0"
        style={{
          background: 'linear-gradient(135deg,#0d1424,#07080f)',
          maxWidth: 680, width: '100%', maxHeight: '90vh',
          border: `1px solid ${tierColor}45`,
          boxShadow: `0 0 80px ${tierColor}25, 0 40px 80px rgba(0,0,0,.7)`,
        }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ background: 'rgba(255,255,255,.1)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,.15)' }}>✕</button>

        {/* Left/Top — card image */}
        <div className="flex-shrink-0 flex items-center justify-center p-6 sm:p-8"
          style={{ background: `linear-gradient(135deg, ${tierColor}08, transparent)`, minWidth: 0 }}>
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-2xl scale-95"
              style={{ background: `${tierColor}30` }} />
            <div className="relative rounded-2xl overflow-hidden mx-auto"
              style={{
                width: 'min(180px, 55vw)', height: 'min(252px, 77vw)',
                boxShadow: `0 20px 60px rgba(0,0,0,.7), 0 0 40px ${tierColor}35`,
                border: `2px solid ${tierColor}40`,
              }}>
              {card.img
                ? <img src={card.img} alt={card.name} referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                    style={{ background: 'rgba(8,10,18,1)', padding: '4px' }} />
                : <div className="w-full h-full flex items-center justify-center text-5xl"
                    style={{ background: 'rgba(8,10,18,1)' }}>
                    {card.setId === 'yugioh' ? '⚔️' : card.setId === 'dragonball' ? '🔥' : '🃏'}
                  </div>
              }
            </div>
          </div>
        </div>

        {/* Right — info */}
        <div className="flex-1 flex flex-col justify-center gap-5 py-8 pr-8 pl-2 overflow-y-auto">
          {/* Game + tier badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,.07)', color: '#9aa3b2' }}>
              {card.setId === 'yugioh' ? '⚔️ YU-GI-OH!' : card.setId === 'dragonball' ? '🔥 DBS' : '⚡ POKÉMON'}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
              {card.tier}
            </span>
          </div>

          {/* Name */}
          <div>
            <h4 style={{ margin: 0, fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 800,
                         color: '#eef2ff', lineHeight: 1.2, letterSpacing: '.03em' }}>
              {card.name}
            </h4>
            {card.rarity && (
              <p className="font-mono text-[11px] mt-1.5" style={{ color: '#6b7280' }}>{card.rarity}</p>
            )}
          </div>

          {/* Stats grid */}
          {stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {stats.map(s => (
                <div key={s.label} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <p className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>{s.label}</p>
                  <p className="font-mono text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {card.desc && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
              <p className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>DESCRIPTION</p>
              <p className="font-mono text-[11px] leading-relaxed" style={{ color: '#9aa3b2' }}>
                {card.desc.slice(0, 200)}{card.desc.length > 200 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Price */}
          {card.price && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px]" style={{ color: '#6b7280' }}>Market Price</span>
              <span className="font-mono text-sm font-bold" style={{ color: '#4ade80' }}>${card.price}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PackInfoModal({ packInfo, pools, onClose, onSelect }) {
  const [activeRarity, setActiveRarity] = useState('all')
  const [selectedCard, setSelectedCard] = useState(null)
  const pool = pools[packInfo.id] || []
  const filteredPool = activeRarity === 'all' ? pool : pool.filter(c => c.tier === activeRarity)

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="max-w-3xl w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ boxShadow:`0 0 50px rgba(${packInfo.accentRgb},.25)`,
                 border:`1px solid rgba(${packInfo.accentRgb},.3)`,
                 background:'linear-gradient(180deg,#0f1420,#09101a)',
                 maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom:`1px solid rgba(${packInfo.accentRgb},.15)`, background:`rgba(${packInfo.accentRgb},.06)` }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-16 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
              <img src={packInfo.img} alt={packInfo.label} className="w-full h-full object-contain"
                style={{ background:'rgba(10,12,20,.8)', padding:'2px' }}
                onError={e => e.target.style.display='none'} />
            </div>
            <div>
              <div className="font-mono text-[10px] mb-1 uppercase tracking-wider" style={{ color:packInfo.accent }}>
                {packInfo.game==='pokemon'?'⚡ POKÉMON TCG':packInfo.game==='dragonball'?'🔥 DRAGON BALL':'⚔️ YU-GI-OH!'}
              </div>
              <h3 style={{ margin:0, fontFamily:'Orbitron, Rajdhani, sans-serif', fontSize:20, fontWeight:800, color:'#eef2ff' }}>{packInfo.label}</h3>
              <p className="font-mono text-[10px]" style={{ color:'#9aa3b2' }}>{packInfo.sub}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2' }}>✕</button>
        </div>

        {/* Rarity tabs — clickable */}
        <div className="px-5 pt-4 flex-shrink-0">
          <div className="flex gap-2 flex-wrap">
            {/* All tab */}
            <button onClick={() => setActiveRarity('all')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[11px] font-bold uppercase transition-all"
              style={{
                background: activeRarity==='all' ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)',
                border: activeRarity==='all' ? '1px solid rgba(255,255,255,.3)' : '1px solid rgba(255,255,255,.08)',
                color: activeRarity==='all' ? '#eef2ff' : '#9aa3b2',
              }}>
              All
              <span className="font-mono text-[9px] opacity-60">{pool.length}</span>
            </button>
            {/* Rarity tabs */}
            {packInfo.dropRates.map(r => {
              const cnt = pool.filter(c => c.tier === r.tier).length
              const isActive = activeRarity === r.tier
              return (
                <button key={r.tier} onClick={() => setActiveRarity(r.tier)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[11px] font-bold uppercase transition-all"
                  style={{
                    background: isActive ? `rgba(${packInfo.accentRgb},.15)` : 'rgba(255,255,255,.04)',
                    border: isActive ? `1px solid ${r.color}60` : '1px solid rgba(255,255,255,.08)',
                    color: isActive ? r.color : '#9aa3b2',
                  }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  {r.tier}
                  <span className="font-mono text-[9px] opacity-60">{cnt}</span>
                  <span className="font-mono text-[9px] font-bold" style={{ color: isActive ? r.color : '#6b7280' }}>{r.pct}%</span>
                </button>
              )
            })}
          </div>
          {/* Active rarity description */}
          {activeRarity !== 'all' && (
            <p className="font-mono text-[10px] mt-2" style={{ color:'#6b7280' }}>
              {packInfo.dropRates.find(r => r.tier === activeRarity)?.label}
            </p>
          )}
        </div>

        {/* Pool grid — full, scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {pool.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <div className="w-4 h-4 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
              <span className="font-mono text-[11px]" style={{ color:'#9aa3b2' }}>Pool belum di-load — pilih pack ini dulu</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color:'#9aa3b2' }}>
                  {filteredPool.length} {activeRarity !== 'all' ? activeRarity : ''} cards
                </span>
              </div>
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2">
                {filteredPool.map((card, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden cursor-pointer group"
                    style={{ aspectRatio:'3/4', background:'rgba(255,255,255,.04)',
                             border:`1px solid ${TIER_COLORS[card.tier]}25`,
                             transition:'all .2s' }}
                    title={card.name}
                    onClick={() => setSelectedCard(card)}
                    onMouseEnter={e => { e.currentTarget.style.transform='scale(1.1)'; e.currentTarget.style.zIndex='10'; e.currentTarget.style.boxShadow=`0 0 16px ${TIER_COLORS[card.tier]}60` }}
                    onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.zIndex='1'; e.currentTarget.style.boxShadow='none' }}>
                    {card.img
                      ? <img src={card.img} alt={card.name} loading="lazy" decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-0.5" />
                      : <div className="w-full h-full flex items-center justify-center text-xs">
                          {card.setId==='yugioh'?'⚔️':card.setId==='dragonball'?'🔥':'🃏'}
                        </div>
                    }
                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: TIER_COLORS[card.tier] }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color:'#9aa3b2' }}>Cost per pull</p>
            <p className="font-mono text-xl font-bold" style={{ color:packInfo.accent, fontFamily:'Orbitron, monospace' }}>{packInfo.cost} USDC</p>
          </div>
          <button onClick={onSelect}
            className="px-6 py-2.5 rounded-xl font-bold text-xs hover:-translate-y-0.5 transition-all"
            style={{ background:packInfo.accent, color:'#07070F', fontFamily:'Orbitron, monospace',
                     letterSpacing:'.08em', textTransform:'uppercase' }}>
            SELECT PACK
          </button>
        </div>
      </div>
    </div>

    {/* Card Detail Modal */}
    {selectedCard && (
      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        accentRgb={packInfo.accentRgb}
      />
    )}
    </>
  )
}

export default function Gacha() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [selectedPack, setSelectedPack] = useState(PACKS[0])
  const [pools, setPools]       = useState({})
  const [loading, setLoading]   = useState(false)
  const [pulled, setPulled]     = useState(null)
  const [pulled10, setPulled10] = useState(null)
  const [log, setLog]           = useState([])
  const [pity, setPity]         = useState(0)
  const [packInfo, setPackInfo] = useState(null)
  const [mintStatus, setMintStatus] = useState(null)
  const [packImgIdx, setPackImgIdx] = useState(0)
  const [imgIdxMap, setImgIdxMap] = useState({})
  const [loadingPacks, setLoadingPacks] = useState({}) // per-pack loading state
  const [summoning, setSummoning]       = useState(false) // race-condition lock

  useEffect(() => {
    if (pools[selectedPack.id]) return
    if (loadingPacks[selectedPack.id]) return
    async function load() {
      setLoadingPacks(prev => ({ ...prev, [selectedPack.id]: true }))
      setLoading(true)
      let cards = []
      if (selectedPack.game === 'pokemon') {
        const lists = (await Promise.all(selectedPack.sets.map(fetchSetCards))).flat()
        cards = lists.filter(c => c.img).sort(() => Math.random() - 0.5).slice(0, 80)
      } else if (selectedPack.game === 'yugioh') {
        cards = await fetchYugiohCards(selectedPack.ygoType, 60)
      } else if (selectedPack.game === 'dragonball') {
        cards = await fetchDragonBallCards(selectedPack.dbsColor, 60)
      }
      setPools(prev => ({ ...prev, [selectedPack.id]: cards }))
      setLoadingPacks(prev => ({ ...prev, [selectedPack.id]: false }))
      setLoading(false)
    }
    load()
  }, [selectedPack])

  useEffect(() => { setPackImgIdx(0) }, [selectedPack.id])

  useEffect(() => {
    const pool = pools[selectedPack.id] || []
    const withImg = pool.filter(c => c.img)
    if (!withImg.length) return
    const interval = setInterval(() => {
      setPackImgIdx(i => (i + 1) % withImg.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [pools, selectedPack.id])

  // Per-pack image cycling
  useEffect(() => {
    const intervals = PACKS.map(pack => {
      const pool = pools[pack.id] || []
      const withImg = pool.filter(c => c.img)
      if (!withImg.length) return null
      return setInterval(() => {
        setImgIdxMap(prev => ({ ...prev, [pack.id]: ((prev[pack.id] || 0) + 1) % withImg.length }))
      }, 2500 + PACKS.indexOf(pack) * 400)
    })
    return () => intervals.forEach(i => i && clearInterval(i))
  }, [pools])

  function getPackImg(pack) {
    const pool = pools[pack.id] || []
    const withImg = pool.filter(c => c.img)
    if (!withImg.length) return pack.img
    return withImg[(imgIdxMap[pack.id] || 0) % withImg.length].img
  }

  const currentPool = pools[selectedPack.id] || []

  async function dismissWalletModal() {
    try {
      const closeBtn = document.querySelector('[data-w3m-modal] button, [aria-label="Close"], .w3m-modal-close, [data-testid="wallet-modal-close"], w3m-modal button[aria-label="Close"]')
      if (closeBtn) {
        closeBtn.click()
        await new Promise(r => setTimeout(r, 150))
        return true
      }
    } catch (e) {
      console.warn('dismiss modal failed:', e?.message || e)
    }
    return false
  }

  async function summon(qty) {
    if (summoning) return
    setSummoning(true) // Race condition fix: immediate lock after guard check

    let pool = pools[selectedPack.id] || []

    // Pool belum load — trigger load dan tunggu sebentar
    if (!pool.length) {
      setLoadingPacks(prev => ({ ...prev, [selectedPack.id]: true }))
      try {
        let cards = []
        if (selectedPack.game === 'pokemon') {
          const lists = (await Promise.all(selectedPack.sets.map(fetchSetCards))).flat()
          cards = lists.filter(c => c.img).sort(() => Math.random() - 0.5).slice(0, 80)
        } else if (selectedPack.game === 'yugioh') {
          cards = await fetchYugiohCards(selectedPack.ygoType, 60)
        } else if (selectedPack.game === 'dragonball') {
          cards = await fetchDragonBallCards(selectedPack.dbsColor, 60)
        }
        setPools(prev => ({ ...prev, [selectedPack.id]: cards }))
        pool = cards
      } catch (e) {
        console.error('Pool load failed:', e)
      }
      setLoadingPacks(prev => ({ ...prev, [selectedPack.id]: false }))
      if (!pool.length) {
        setSummoning(false) // Reset lock on early return
        return // masih kosong, tidak bisa summon
      }
    }

    // Clear any blocking wallet modal before minting
    await dismissWalletModal()

    try {
      if (qty === 1) {
        const card = pool[Math.floor(Math.random() * pool.length)]
        setPulled(card)
        setPulled10(null)
        setPity(p => Math.min(10, p + 1))
        setLog(prev => [{ ...card, qty: 1, packLabel: selectedPack.label }, ...prev].slice(0, 20))

        if (isConnected && address) {
          // Log pull first (non-blocking for UX)
          logPull(address, card, 1).catch(e => console.warn('logPull failed:', e.message))

          // Mint NFT on-chain immediately — await result to get tokenId
          let nftTokenId = null
          try {
            if (!walletClient) throw new Error('Wallet client not ready for signed mint')
            // If a wallet modal appeared after pool load, surface a clearer error on first failure
            await dismissWalletModal()
            nftTokenId = await mintCardNFT(address, card, walletClient)
            console.log('✅ Minted NFT tokenId:', nftTokenId)
          } catch (e) {
            console.warn('Mint failed, saving collection without tokenId:', e.message)
          }

          // Save to collection with authenticated API (prevents wallet impersonation)
          if (walletClient) {
            try {
              await api.addToCollection(walletClient, [{ ...card, nftTokenId }])
              console.log('✅ Collection saved via authenticated API')
            } catch (e) {
              console.warn('Authenticated addToCollection failed:', e.message)
            }
          }
        }
      } else {
        const cards = Array.from({ length: 10 }, () => pool[Math.floor(Math.random() * pool.length)])
        setPulled10(cards)
        setPulled(null)
        setPity(p => Math.min(10, p + 10))
        setLog(prev => [
          ...cards.map(c => ({ ...c, qty: 10, packLabel: selectedPack.label })),
          ...prev,
        ].slice(0, 20))

        if (isConnected && address) {
          // Log pulls (non-blocking)
          cards.forEach(c => logPull(address, c, 10).catch(e => console.warn('logPull failed:', e.message)))

          // Batch mint NFTs on-chain immediately — await tokenIds
          let tokenIds = []
          try {
            if (!walletClient) throw new Error('Wallet client not ready for signed mint')
            await dismissWalletModal()
            tokenIds = await mintCardBatchNFT(address, cards, walletClient)
            console.log('✅ Batch minted NFT tokenIds:', tokenIds)
          } catch (e) {
            console.warn('Batch mint failed, saving collections without tokenIds:', e.message)
          }

          // Save to collection with authenticated API (batch prevents wallet impersonation)
          if (walletClient) {
            try {
              const cardsWithTokens = cards.map((card, i) => ({
                ...card,
                nftTokenId: tokenIds[i] || null
              }))
              await api.addToCollection(walletClient, cardsWithTokens)
              console.log('✅ Batch collection saved via authenticated API')
            } catch (e) {
              console.warn('Authenticated batch addToCollection failed:', e.message)
            }
          }
        }
      }
    } catch (e) {
      console.error('summon error:', e)
    } finally {
      setSummoning(false)
    }
  }

  return (
    <div className="pt-16 px-4 lg:px-10 pb-12 max-w-[1400px] mx-auto">

      {/* Label */}
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#aeb6c7] mb-8 mt-6 text-center">
        Choose Your Pack &amp; Summon
      </p>

      <div className="grid grid-cols-1 gap-8">

        {/* Full width — 3 floating pack cards + pity bar */}
        <div className="flex flex-col gap-8">

          {/* Pack row — responsive: scroll horizontal di mobile, grid di desktop */}
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide
                          md:grid md:grid-cols-3 md:gap-8 lg:gap-16 md:overflow-visible
                          max-w-3xl mx-auto w-full">
            {PACKS.map(pack => {
              const isActive = selectedPack.id === pack.id
              const imgSrc = getPackImg(pack)
              return (
                <div key={pack.id}
                  className="flex flex-col items-center gap-4 relative flex-shrink-0 snap-center"
                  style={{ cursor: 'pointer', touchAction: 'manipulation', minWidth: 140, width: 'calc(33vw - 16px)', maxWidth: 200 }}
                  onClick={() => setSelectedPack(pack)}>

                  {/* Info button */}
                  <button
                    className="absolute top-0 right-0 z-20 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                    style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff' }}
                    onClick={e => { e.stopPropagation(); setPackInfo(pack) }}>
                    i
                  </button>

                  {/* Floating card image */}
                  <div className="relative"
                    style={{
                      animation: isActive ? 'floatCard 3s ease-in-out infinite' : 'floatCardSlow 5s ease-in-out infinite',
                      filter: isActive ? 'none' : 'brightness(0.65)',
                      transition: 'filter 0.4s ease',
                    }}>

                    {/* Glow under card */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full blur-xl transition-all duration-500"
                      style={{
                        width: isActive ? 120 : 60,
                        height: isActive ? 24 : 12,
                        background: `rgba(${pack.accentRgb}, ${isActive ? 0.6 : 0.2})`,
                      }} />

                    {/* Card — fluid size, no layout shift */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '3/4',
                      maxWidth: 148,
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: isActive
                        ? `0 24px 50px rgba(0,0,0,.65), 0 0 32px rgba(${pack.accentRgb},.35), 0 0 60px rgba(${pack.accentRgb},.12)`
                        : `0 12px 28px rgba(0,0,0,.4)`,
                      transition: 'box-shadow 0.4s ease, opacity 0.4s ease',
                      position: 'relative',
                      opacity: isActive ? 1 : 0.55,
                    }}>
                      <img src={imgSrc} alt={pack.label}
                        referrerPolicy="no-referrer"
                        width={148}
                        height={207}
                        loading="lazy" decoding="async"
                        className="w-full h-full object-contain transition-opacity duration-500"
                        style={{ background: 'rgba(10,12,20,.8)', padding: '4px' }}
                        onError={e => { e.target.src = pack.img; e.target.onerror = null }} />
                      {/* Shine sweep — only active */}
                      {isActive && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'linear-gradient(135deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%)',
                            animation: 'shineSweep 4s linear infinite',
                          }} />
                      )}
                    </div>

                    {/* Active indicator ring */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{
                          border: `2px solid rgba(${pack.accentRgb},.8)`,
                          boxShadow: `0 0 20px rgba(${pack.accentRgb},.4)`,
                          borderRadius: 16,
                        }} />
                    )}
                  </div>

                  {/* Pack info text */}
                  <div className="text-center flex flex-col gap-1.5 w-full">
                    <h3 style={{
                      margin: 0,
                      fontFamily: 'Orbitron, Rajdhani, sans-serif',
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '.05em',
                      color: isActive ? '#eef2ff' : '#9aa3b2',
                      transition: 'color 0.4s',
                    }}>{pack.label}</h3>
                    <p className="font-mono text-[10px]" style={{ color: isActive ? '#c5ccda' : '#6b7280' }}>{pack.sub}</p>
                    <p className="font-mono font-bold text-[12px] uppercase tracking-wider"
                      style={{ color: pack.accent, opacity: isActive ? 1 : 0.5, fontFamily: 'Orbitron, monospace' }}>
                      {pack.cost} USDC / pull
                    </p>

                    {/* Buttons — only show when active */}
                    {isActive && (
                      <div className="flex flex-col gap-2 mt-2" style={{ position: 'relative', zIndex: 30 }}>
                        <button
                          onClick={e => { e.stopPropagation(); e.preventDefault(); summon(1) }}
                          disabled={loadingPacks[selectedPack.id] || summoning}
                          className="w-full h-12 border-none rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-40 active:scale-95"
                          style={{
                            fontFamily: 'Orbitron, monospace', fontSize: 12, fontWeight: 800,
                            letterSpacing: '.08em', textTransform: 'uppercase', color: '#041016',
                            background: 'linear-gradient(180deg,#53f6ff,#11dff3)',
                            boxShadow: '0 8px 24px rgba(17,223,243,.35)',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                          }}>
                          {summoning ? 'SUMMONING...' : `OPEN 1×  ·  ${pack.cost} USDC`}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); e.preventDefault(); summon(10) }}
                          disabled={loadingPacks[selectedPack.id] || summoning}
                          className="w-full h-12 border-none rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-40 active:scale-95"
                          style={{
                            fontFamily: 'Orbitron, monospace', fontSize: 12, fontWeight: 800,
                            letterSpacing: '.08em', textTransform: 'uppercase', color: '#140703',
                            background: 'linear-gradient(180deg,#ff7a45,#ff4c12)',
                            boxShadow: '0 8px 24px rgba(255,76,18,.35)',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                          }}>
                          {summoning ? 'SUMMONING...' : `OPEN 10× ✦  ·  ${pack.cost * 10}`}
                        </button>
                        {loadingPacks[selectedPack.id] && (
                          <p className="font-mono text-[10px] text-center animate-pulse" style={{ color: '#16e6ff' }}>
                            Loading pool...
                          </p>
                        )}
                        {!isConnected && (
                          <p className="font-mono text-[10px] text-center" style={{ color: `rgba(${pack.accentRgb},.7)` }}>
                            Connect wallet to save
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pity bar */}
          <div className="glass rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex-grow">
              <div className="flex justify-between mb-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: '#9aa3b2' }}>Pity Counter</span>
                <span className="font-mono text-[11px] font-bold" style={{ color: selectedPack.accent }}>{pity}/10</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pity * 10, 100)}%`,
                    background: `linear-gradient(90deg, ${selectedPack.accent}, rgba(${selectedPack.accentRgb},.6))`,
                    boxShadow: `0 0 10px rgba(${selectedPack.accentRgb},.6)`,
                  }} />
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: '#9aa3b2' }}>Guaranteed</p>
              <p className="font-mono text-xs font-bold" style={{ color: selectedPack.accent }}>Rare+</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <SummonOverlay card={pulled} packAccent={selectedPack.accent} onClose={() => setPulled(null)} />
      <SummonOverlay10 cards={pulled10} packAccent={selectedPack.accent} onClose={() => setPulled10(null)} />

      {/* Pack Info Modal */}
      {packInfo && (
        <PackInfoModal
          packInfo={packInfo}
          pools={pools}
          onClose={() => setPackInfo(null)}
          onSelect={() => { setSelectedPack(packInfo); setPackInfo(null) }}
        />
      )}

      <style>{`
        @keyframes floatCard {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          33%      { transform: translateY(-12px) rotate(0.5deg); }
          66%      { transform: translateY(-6px) rotate(-0.5deg); }
        }
        @keyframes floatCardSlow {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes shineSweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  )
}
