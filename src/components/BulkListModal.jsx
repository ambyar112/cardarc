// BulkListModal — list multiple cards at once
// Supports: single price for all, or per-tier pricing
import { useState } from 'react'
import { saveListingToSupabase } from '../lib/supabase'
import { getTokenId, isMarketplaceApproved, approveMarketplace, listCard } from '../lib/marketplace'
import { mintCardNFT } from '../lib/mint'

const TIER_COLORS = { legendary:'#f5c84c', epic:'#a78bfa', rare:'#16e6ff', common:'#9aa3b2' }
const TIERS = ['legendary','epic','rare','common']

function shortName(name) {
  return name.length > 20 ? name.slice(0,18) + '…' : name
}

export default function BulkListModal({ cards, walletAddress, onClose, onDone }) {
  const [priceMode, setPriceMode] = useState('single') // 'single' | 'tier'
  const [singlePrice, setSinglePrice] = useState('')
  const [tierPrices, setTierPrices] = useState({ legendary:'', epic:'', rare:'', common:'' })
  const [step, setStep] = useState('form') // form | processing | done | error
  const [progress, setProgress] = useState({ current:0, total:0, cardName:'' })
  const [results, setResults] = useState([]) // { card, success, error }
  const [globalError, setGlobalError] = useState('')

  function getPrice(card) {
    if (priceMode === 'single') return parseFloat(singlePrice)
    return parseFloat(tierPrices[card.tier] || '0')
  }

  function validate() {
    if (priceMode === 'single') {
      const p = parseFloat(singlePrice)
      if (!p || p <= 0) return 'Masukkan harga yang valid'
      if (p > 1000000) return 'Harga terlalu tinggi'
    } else {
      const tiers = [...new Set(cards.map(c => c.tier))]
      for (const t of tiers) {
        const p = parseFloat(tierPrices[t])
        if (!p || p <= 0) return `Masukkan harga untuk tier "${t}"`
      }
    }
    return null
  }

  async function handleBulkList() {
    const err = validate()
    if (err) { setGlobalError(err); return }
    setGlobalError('')
    setStep('processing')
    setProgress({ current:0, total:cards.length, cardName:'' })

    const res = []

    // 1. Approve marketplace once
    try {
      const approved = await isMarketplaceApproved(walletAddress)
      if (!approved) {
        setProgress(p => ({ ...p, cardName: 'Approving marketplace...' }))
        const appr = await approveMarketplace()
        if (!appr.success) throw new Error('Approve gagal: ' + appr.error)
      }
    } catch (e) {
      setGlobalError(e.message)
      setStep('error')
      return
    }

    // 2. Process each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const price = getPrice(card)
      setProgress({ current: i + 1, total: cards.length, cardName: card.name })

      try {
        // Check / mint
        let tokenId = await getTokenId(card.id)
        if (!tokenId) {
          const mintRes = await mintCardNFT(walletAddress, card)
          if (!mintRes.success) throw new Error('Mint gagal: ' + mintRes.error)
          tokenId = await getTokenId(card.id)
          if (!tokenId) throw new Error('TokenId tidak ditemukan setelah mint')
        }

        // List on-chain
        const listRes = await listCard(tokenId, price)
        if (!listRes.success) throw new Error(listRes.error)

        // Sync Supabase
        await saveListingToSupabase({
          listingId: listRes.listingId ?? Date.now() + i,
          seller:    walletAddress,
          cardId:    card.id,
          cardName:  card.name,
          cardImg:   card.img,
          tier:      card.tier,
          setId:     card.setId,
          priceEth:  price,
        })

        res.push({ card, success:true, hash:listRes.hash })
      } catch (e) {
        res.push({ card, success:false, error:e.message })
      }
    }

    setResults(res)
    setStep('done')
  }

  const successCount = results.filter(r => r.success).length
  const failCount    = results.filter(r => !r.success).length
  const usedTiers    = [...new Set(cards.map(c => c.tier))]

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={step === 'processing' ? undefined : onClose}>
      <div className="relative rounded-2xl overflow-hidden w-full flex flex-col"
        style={{ maxWidth:520, maxHeight:'90vh', background:'linear-gradient(180deg,#0f1420,#09101a)',
                 border:'1px solid rgba(245,200,76,.35)', boxShadow:'0 0 60px rgba(245,200,76,.15)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-0.5" style={{ color:'#f5c84c' }}>
              Bulk List for Sale
            </p>
            <h3 className="font-mono font-bold text-base" style={{ color:'#eef2ff' }}>
              {cards.length} Kartu Dipilih
            </h3>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2' }}>✕</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* ── FORM ── */}
          {step === 'form' && (
            <>
              {/* Card summary */}
              <div className="rounded-xl p-3 flex flex-wrap gap-2"
                style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)' }}>
                {usedTiers.map(t => {
                  const count = cards.filter(c => c.tier === t).length
                  return (
                    <div key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background:`${TIER_COLORS[t]}15`, border:`1px solid ${TIER_COLORS[t]}30` }}>
                      <span className="w-2 h-2 rounded-full" style={{ background:TIER_COLORS[t] }} />
                      <span className="font-mono text-[10px] font-bold" style={{ color:TIER_COLORS[t] }}>
                        {count}× {t}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Price mode toggle */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color:'#9aa3b2' }}>
                  Mode Harga
                </p>
                <div className="flex gap-2">
                  {[
                    { id:'single', label:'Satu Harga' },
                    { id:'tier',   label:'Per Tier' },
                  ].map(m => (
                    <button key={m.id} onClick={() => { setPriceMode(m.id); setGlobalError('') }}
                      className="flex-1 py-2 rounded-xl font-mono text-xs font-bold uppercase transition-all"
                      style={{
                        background: priceMode===m.id ? 'rgba(245,200,76,.15)' : 'rgba(255,255,255,.04)',
                        border: priceMode===m.id ? '1px solid rgba(245,200,76,.5)' : '1px solid rgba(255,255,255,.08)',
                        color: priceMode===m.id ? '#f5c84c' : '#9aa3b2',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single price */}
              {priceMode === 'single' && (
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color:'#9aa3b2' }}>
                    Harga Semua Kartu (USDC)
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="0.001" placeholder="0.01"
                      value={singlePrice} onChange={e => { setSinglePrice(e.target.value); setGlobalError('') }}
                      className="flex-1 bg-transparent border rounded-xl px-4 py-3 font-mono text-sm text-white focus:outline-none"
                      style={{ borderColor:'rgba(255,255,255,.15)' }}
                      onFocus={e=>e.target.style.borderColor='#f5c84c'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.15)'} />
                    <span className="font-mono text-sm font-bold" style={{ color:'#16e6ff' }}>USDC</span>
                  </div>
                </div>
              )}

              {/* Per-tier prices */}
              {priceMode === 'tier' && (
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color:'#9aa3b2' }}>
                    Harga Per Tier (USDC)
                  </p>
                  {usedTiers.map(t => (
                    <div key={t} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-28 flex-shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:TIER_COLORS[t] }} />
                        <span className="font-mono text-[11px] capitalize font-bold" style={{ color:TIER_COLORS[t] }}>{t}</span>
                        <span className="font-mono text-[9px]" style={{ color:'#6b7280' }}>
                          ({cards.filter(c=>c.tier===t).length}×)
                        </span>
                      </div>
                      <input type="number" min="0" step="0.001" placeholder="0.01"
                        value={tierPrices[t]}
                        onChange={e => { setTierPrices(prev => ({ ...prev, [t]:e.target.value })); setGlobalError('') }}
                        className="flex-1 bg-transparent border rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none"
                        style={{ borderColor:'rgba(255,255,255,.12)' }}
                        onFocus={e=>e.target.style.borderColor=TIER_COLORS[t]}
                        onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'} />
                      <span className="font-mono text-[11px] font-bold" style={{ color:'#16e6ff' }}>USDC</span>
                    </div>
                  ))}
                </div>
              )}

              {globalError && (
                <p className="font-mono text-[10px] flex items-center gap-1" style={{ color:'#ff6b6b' }}>
                  ⚠️ {globalError}
                </p>
              )}

              {/* Fee notice */}
              <div className="p-3 rounded-xl flex gap-2"
                style={{ background:'rgba(245,200,76,.05)', border:'1px solid rgba(245,200,76,.15)' }}>
                <span className="text-sm flex-shrink-0">🔒</span>
                <p className="font-mono text-[9px] leading-relaxed" style={{ color:'#9aa3b2' }}>
                  Platform fee 2.5% per transaksi. Setiap kartu dikonfirmasi satu per satu di wallet.
                  Approval marketplace hanya 1x.
                </p>
              </div>

              {/* Cards preview */}
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {cards.map(c => (
                  <div key={c.id} className="rounded-lg overflow-hidden relative"
                    style={{ aspectRatio:'3/4', background:'rgba(255,255,255,.04)',
                             border:`1px solid ${TIER_COLORS[c.tier]}30` }}>
                    {c.img
                      ? <img src={c.img} alt={c.name} referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-0.5" />
                      : <div className="w-full h-full flex items-center justify-center text-lg">
                          {c.setId==='yugioh'?'⚔️':c.setId==='dragonball'?'🔥':'🃏'}
                        </div>
                    }
                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{ background:TIER_COLORS[c.tier] }} />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-mono text-xs transition-all"
                  style={{ background:'rgba(255,255,255,.05)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.1)' }}>
                  Cancel
                </button>
                <button onClick={handleBulkList}
                  className="flex-1 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider"
                  style={{ background:'#f5c84c', color:'#07070F' }}>
                  List {cards.length} Kartu
                </button>
              </div>
            </>
          )}

          {/* ── PROCESSING ── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-spin"
                style={{ borderTopColor:'#f5c84c' }} />
              <div className="text-center">
                <p className="font-mono font-bold text-sm mb-1" style={{ color:'#f5c84c' }}>
                  Memproses {progress.current} / {progress.total}
                </p>
                <p className="font-mono text-[11px]" style={{ color:'#9aa3b2' }}>
                  {progress.cardName}
                </p>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.08)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total * 100) : 0}%`,
                    background:'linear-gradient(90deg,#f5c84c,#ff9900)',
                  }} />
              </div>
              <p className="font-mono text-[10px] text-center" style={{ color:'#6b7280' }}>
                Konfirmasi setiap transaksi di wallet kamu. Jangan tutup halaman ini.
              </p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: failCount === 0 ? 'rgba(74,222,128,.08)' : 'rgba(255,107,107,.08)',
                         border: `1px solid ${failCount === 0 ? 'rgba(74,222,128,.3)' : 'rgba(255,107,107,.2)'}` }}>
                <span className="text-3xl">{failCount === 0 ? '✅' : '⚠️'}</span>
                <div>
                  <p className="font-mono font-bold text-sm" style={{ color: failCount === 0 ? '#4ade80' : '#f5c84c' }}>
                    {failCount === 0 ? 'Semua berhasil!' : `${successCount} berhasil, ${failCount} gagal`}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color:'#9aa3b2' }}>
                    {successCount} kartu sekarang tampil di Marketplace
                  </p>
                </div>
              </div>

              {/* Result list */}
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background:`rgba(255,255,255,.03)`, border:`1px solid rgba(255,255,255,.06)` }}>
                    <span className="text-sm flex-shrink-0">{r.success ? '✅' : '❌'}</span>
                    <span className="font-mono text-[10px] flex-1 truncate" style={{ color: r.success ? '#9aa3b2' : '#ff6b6b' }}>
                      {shortName(r.card.name)}
                    </span>
                    {r.success
                      ? <span className="font-mono text-[9px]" style={{ color:'#4ade80' }}>Listed</span>
                      : <span className="font-mono text-[9px] truncate max-w-[120px]" style={{ color:'#ff6b6b' }}>{r.error}</span>
                    }
                  </div>
                ))}
              </div>

              <button onClick={onDone}
                className="w-full py-2.5 rounded-xl font-mono font-bold text-xs"
                style={{ background:'#f5c84c', color:'#07070F' }}>
                Done
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="text-4xl">❌</span>
              <p className="font-mono font-bold text-sm" style={{ color:'#ff6b6b' }}>Error</p>
              <p className="font-mono text-[10px] text-center max-w-xs" style={{ color:'#9aa3b2' }}>{globalError}</p>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-mono text-xs"
                  style={{ background:'rgba(255,255,255,.05)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.1)' }}>
                  Close
                </button>
                <button onClick={() => { setStep('form'); setGlobalError('') }}
                  className="px-6 py-2.5 rounded-xl font-mono font-bold text-xs"
                  style={{ background:'rgba(255,255,255,.1)', color:'#eef2ff' }}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
