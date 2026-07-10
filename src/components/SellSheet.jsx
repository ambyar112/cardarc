import { useState, useEffect } from 'react'
import { saveListingToSupabase } from '../lib/supabase'
import { getTokenId, isMarketplaceApproved, approveMarketplace, listCard, checkNFTBalance } from '../lib/marketplace'
import { mintCardNFT } from '../lib/mint'

const TIER_COLORS = { legendary: '#f5c84c', epic: '#a78bfa', rare: '#16e6ff', common: '#9aa3b2' }

export default function SellSheet({ card, walletAddress, walletClient, onClose, onListed }) {
  const [price, setPrice] = useState('')
  const [step, setStep] = useState('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')
  const tierColor = TIER_COLORS[card?.tier] || '#9aa3b2'

  // Mobile: lock scroll while sheet open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => { document.body.style.overflow = ''; document.body.style.touchAction = '' }
  }, [])

  async function handleList() {
    const p = parseFloat(price)
    if (!p || isNaN(p) || p <= 0) { setErrorMsg('Masukkan harga yang valid'); return }
    setErrorMsg('')
    try {
      setStep('minting')
      let tokenId = card.nft_token_id
      if (!tokenId && tokenId !== 0) {
        tokenId = await getTokenId(card.id)
        if (!tokenId || tokenId.toString() === '0') {
          setStep('error'); setErrorMsg(`Card "${card.name}" belum di-mint on-chain.`); return
        }
      }
      let balance = await checkNFTBalance(walletAddress, tokenId)
      if (balance === 0) {
        const newTokenId = await mintCardNFT(walletAddress, card, walletClient)
        balance = await checkNFTBalance(walletAddress, newTokenId)
        if (balance === 0) throw new Error('Mint gagal')
        tokenId = newTokenId
        await new Promise(r => setTimeout(r, 2000))
      }
      setStep('approving')
      const approved = await isMarketplaceApproved(walletAddress)
      if (!approved) {
        const res = await approveMarketplace()
        if (!res.success) { setStep('error'); setErrorMsg('Gagal approve marketplace: ' + res.error); return }
        await new Promise(r => setTimeout(r, 1500))
      }
      setStep('listing')
      const res = await listCard(tokenId, card.id, p)
      if (!res.success) { setStep('error'); setErrorMsg(res.error); return }
      setTxHash(res.hash)
      await saveListingToSupabase({ listingId: res.listingId ?? Date.now(), seller: walletAddress, cardId: card.id, cardName: card.name, cardImg: card.img, tier: card.tier, setId: card.setId, priceEth: p })
      setStep('done')
      onListed?.()
    } catch (e) {
      setStep('error')
      setErrorMsg(e.message || 'Terjadi error tidak terduga')
    }
  }

  if (!card || !card.id || !card.name) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative rounded-2xl overflow-hidden w-full max-w-md p-6" style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,.1)' }}>
          <p className="font-mono text-xs mb-2" style={{ color:'#ff6b6b' }}>Data kartu tidak valid untuk listing.</p>
          <p className="font-mono text-[10px] mb-4" style={{ color:'#6b7280' }}>{card ? JSON.stringify(card).slice(0,120) : 'null card'}</p>
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-mono text-xs" style={{ background:'rgba(255,255,255,.1)', color:'#eef2ff' }}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] bg-black/95 rounded-t-2xl border-t border-white/10" onClick={onClose}>
      <div className="p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto" style={{ background:'linear-gradient(180deg,#0f1420,#09101a)', borderTop:`1px solid ${tierColor}40` }} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-0.5" style={{ color: tierColor }}>List For Sale</p>
            <h3 className="font-mono font-bold text-base" style={{ color:'#eef2ff' }}>{card.name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background:'rgba(255,255,255,.08)', color:'#9aa3b2' }}>✕</button>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${tierColor}25` }}>
          {card.img && <img src={card.img} alt={card.name} referrerPolicy="no-referrer" className="w-12 h-16 object-contain rounded-lg flex-shrink-0" style={{ background:'rgba(0,0,0,.4)' }} />}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded w-fit" style={{ background:`${tierColor}20`, color: tierColor }}>{card.tier}</span>
            <p className="font-mono text-[10px]" style={{ color:'#9aa3b2' }}>{card.setId==='yugioh'?'⚔️ YGO':card.setId==='dragonball'?'🔥 DBS':'⚡ PKM'}</p>
          </div>
        </div>
        {step === 'form' && (
          <>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color:'#9aa3b2' }}>Harga (USDC)</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0.000001" max="1000000" step="0.001" placeholder="0.01" value={price} onChange={e=>{setPrice(e.target.value);setErrorMsg('')}} className="flex-1 bg-transparent border rounded-xl px-4 py-3 font-mono text-sm text-white focus:outline-none transition-colors" style={{ borderColor:'rgba(255,255,255,.15)' }} onFocus={e=>e.target.style.borderColor=tierColor} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.15)'} />
                <span className="font-mono text-sm font-bold" style={{ color:'#16e6ff' }}>USDC</span>
              </div>
            </div>
            {errorMsg && <p className="font-mono text-[10px]" style={{ color:'#ff6b6b' }}>{errorMsg}</p>}
            <button onClick={handleList} disabled={!price || parseFloat(price) <= 0} className="flex-1 py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-40" style={{ background: tierColor, color:'#07070F' }}>List for Sale</button>
          </>
        )}
        {step === 'minting' && <div className="flex flex-col items-center gap-3 py-6"><div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} /><p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Minting kartu...</p></div>}
        {step === 'approving' && <div className="flex flex-col items-center gap-3 py-6"><div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} /><p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Meminta approval...</p><p className="font-mono text-[10px] text-center" style={{ color:'#6b7280' }}>Konfirmasi di wallet kamu.</p></div>}
        {step === 'listing' && <div className="flex flex-col items-center gap-3 py-6"><div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} /><p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Membuat listing on-chain...</p></div>}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background:'rgba(74,222,128,.1)', border:'2px solid rgba(74,222,128,.3)' }}>✅</div>
            <div className="text-center">
              <p className="font-mono font-bold text-sm mb-1" style={{ color:'#4ade80' }}>Listing Berhasil!</p>
              <p className="font-mono text-[10px]" style={{ color:'#6b7280' }}>Kartu kamu sekarang tampil di Marketplace.</p>
            </div>
            {txHash && <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer noopener" className="font-mono text-[10px] flex items-center gap-1 underline" style={{ color:'#16e6ff' }}>View on ArcScan ↗</a>}
            <button onClick={onClose} className="px-10 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background: tierColor, color:'#07070F' }}>Done</button>
          </div>
        )}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background:'rgba(255,107,107,.1)', border:'2px solid rgba(255,107,107,.3)' }}>❌</div>
            <div className="text-center">
              <p className="font-mono font-bold text-sm mb-1" style={{ color:'#ff6b6b' }}>Gagal</p>
              <p className="font-mono text-[10px] max-w-xs" style={{ color:'#9aa3b2' }}>{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-mono text-xs" style={{ background:'rgba(255,255,255,.05)', color:'#9aa3b2', border:'1px solid rgba(255,255,255,.1)' }}>Close</button>
              <button onClick={()=>{setStep('form');setErrorMsg('')}} className="px-6 py-2.5 rounded-xl font-mono font-bold text-xs" style={{ background:'rgba(255,255,255,.1)', color:'#eef2ff' }}>Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
