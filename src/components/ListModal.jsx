// Shared ListModal — dipakai di Collection dan Profile
// SECURITY FIX: Removed selfMintCard (contract no longer has selfMint).
//               Cards must be minted via mintCardNFT (approved minter flow).
//               Wallet address normalized to lowercase before DB writes.
import { useState } from 'react'
import { saveListingToSupabase } from '../lib/supabase'
import { getTokenId, isMarketplaceApproved, approveMarketplace, listCard } from '../lib/marketplace'
import { mintCardNFT } from '../lib/mint'

const TIER_COLORS = { legendary: '#f5c84c', epic: '#a78bfa', rare: '#16e6ff', common: '#9aa3b2' }

export default function ListModal({ card, walletAddress, onClose, onListed }) {
  const [price, setPrice]   = useState('')
  const [step, setStep]     = useState('form') // form | minting | approving | listing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')

  const tierColor = TIER_COLORS[card?.tier] || '#9aa3b2'

  // Validate price input — reject negative, zero, and absurdly large values
  function validatePrice(val) {
    const p = parseFloat(val)
    if (!p || isNaN(p) || p <= 0)       return 'Masukkan harga yang valid'
    if (p > 1_000_000)                  return 'Harga terlalu tinggi'
    if (!/^\d*\.?\d{0,6}$/.test(val))   return 'Maksimal 6 angka desimal'
    return null
  }

  async function handleList() {
    const priceError = validatePrice(price)
    if (priceError) { setErrorMsg(priceError); return }
    setErrorMsg('')

    const p = parseFloat(price)

    try {
      // Use real tokenId from collection (set during gacha mint)
      // If missing (legacy card), mint on-chain first
      let tokenId = card.nft_token_id

      if (!tokenId) {
        // Legacy card without on-chain mint — mint it now
        setStep('minting')
        tokenId = await mintCardNFT(walletAddress, card)
        if (!tokenId && tokenId !== 0) {
          setStep('error')
          setErrorMsg('Gagal mint kartu ke blockchain')
          return
        }
      }

      // Approve marketplace if not yet approved
      setStep('approving')
      const approved = await isMarketplaceApproved(walletAddress)
      if (!approved) {
        const res = await approveMarketplace()
        if (!res.success) {
          setStep('error')
          setErrorMsg('Gagal approve marketplace: ' + res.error)
          return
        }
      }

      // 3. List on-chain
      setStep('listing')
      const res = await listCard(tokenId, card.id, p)
      if (!res.success) {
        setStep('error')
        setErrorMsg(res.error)
        return
      }
      setTxHash(res.hash)

      // 4. Sync metadata to Supabase (cache only — on-chain is source of truth)
      // on_chain_listing_id will be null here since we don't parse the event log yet.
      // That's acceptable — marketplace still works via on-chain primary query.
      await saveListingToSupabase({
        listingId: res.listingId ?? Date.now(),
        seller:    walletAddress,
        cardId:    card.id,
        cardName:  card.name,
        cardImg:   card.img,
        tier:      card.tier,
        setId:     card.setId,
        priceEth:  p,
      })

      setStep('done')
      onListed?.()
    } catch (e) {
      setStep('error')
      setErrorMsg(e.message || 'Terjadi error tidak terduga')
    }
  }

  if (!card) return null

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden w-full max-w-md flex flex-col"
        style={{
          background: 'linear-gradient(180deg,#0f1420,#09101a)',
          border: `1px solid ${tierColor}40`,
          boxShadow: `0 0 60px ${tierColor}20`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-0.5" style={{ color: tierColor }}>
              List For Sale
            </p>
            <h3 className="font-mono font-bold text-base" style={{ color: '#eef2ff' }}>{card.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(255,255,255,.08)', color: '#9aa3b2' }}
          >✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Card preview */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${tierColor}25` }}
          >
            {card.img && (
              <img
                src={card.img}
                alt={card.name}
                referrerPolicy="no-referrer"
                className="w-12 h-16 object-contain rounded-lg flex-shrink-0"
                style={{ background: 'rgba(0,0,0,.4)' }}
              />
            )}
            <div className="flex flex-col gap-1">
              <span
                className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded w-fit"
                style={{ background: `${tierColor}20`, color: tierColor }}
              >{card.tier}</span>
              <p className="font-mono text-[10px]" style={{ color: '#9aa3b2' }}>
                {card.setId === 'yugioh' ? '⚔️ YGO' : card.setId === 'dragonball' ? '🔥 DBS' : '⚡ PKM'}
              </p>
            </div>
          </div>

          {/* ── FORM ── */}
          {step === 'form' && (
            <>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: '#9aa3b2' }}>
                  Harga (USDC)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.000001"
                    max="1000000"
                    step="0.001"
                    placeholder="0.01"
                    value={price}
                    onChange={e => { setPrice(e.target.value); setErrorMsg('') }}
                    className="flex-1 bg-transparent border rounded-xl px-4 py-3 font-mono text-sm text-white focus:outline-none transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,.15)' }}
                    onFocus={e => e.target.style.borderColor = tierColor}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.15)'}
                  />
                  <span className="font-mono text-sm font-bold" style={{ color: '#16e6ff' }}>USDC</span>
                </div>
                {errorMsg && (
                  <p className="font-mono text-[10px] mt-2 flex items-center gap-1" style={{ color: '#ff6b6b' }}>
                    ⚠️ {errorMsg}
                  </p>
                )}
              </div>

              {/* Fee breakdown */}
              <div
                className="p-3 rounded-xl font-mono text-[10px]"
                style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}
              >
                <div className="flex justify-between mb-1.5">
                  <span style={{ color: '#6b7280' }}>Listing price</span>
                  <span style={{ color: '#eef2ff' }}>{price || '—'} USDC</span>
                </div>
                <div className="flex justify-between mb-1.5">
                  <span style={{ color: '#6b7280' }}>Platform fee (2.5%)</span>
                  <span style={{ color: '#9aa3b2' }}>
                    {price && !isNaN(parseFloat(price)) ? (parseFloat(price) * 0.025).toFixed(5) + ' USDC' : '—'}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  <span style={{ color: '#6b7280' }}>Kamu terima</span>
                  <span className="font-bold" style={{ color: '#16e6ff' }}>
                    {price && !isNaN(parseFloat(price)) ? (parseFloat(price) * 0.975).toFixed(4) + ' USDC' : '—'}
                  </span>
                </div>
              </div>

              {/* Security notice */}
              <div
                className="p-3 rounded-xl flex gap-2"
                style={{ background: 'rgba(245,200,76,.05)', border: '1px solid rgba(245,200,76,.15)' }}
              >
                <span className="text-sm flex-shrink-0">🔒</span>
                <p className="font-mono text-[9px] leading-relaxed" style={{ color: '#9aa3b2' }}>
                  Kartu akan di-lock di{' '}
                  <strong style={{ color: '#f5c84c' }}>ArcMarketplace smart contract</strong>{' '}
                  sampai terjual atau kamu cancel. Hanya kamu yang bisa cancel listing ini.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-mono text-xs transition-all"
                  style={{ background: 'rgba(255,255,255,.05)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,.1)' }}
                >Cancel</button>
                <button
                  onClick={handleList}
                  disabled={!price || parseFloat(price) <= 0}
                  className="flex-1 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                  style={{ background: tierColor, color: '#07070F' }}
                >List for Sale</button>
              </div>
            </>
          )}

          {/* ── MINTING ── */}
          {step === 'minting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} />
              <p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Minting kartu ke blockchain...</p>
              <p className="font-mono text-[10px] text-center" style={{ color: '#6b7280' }}>Konfirmasi di wallet kamu.</p>
            </div>
          )}

          {/* ── APPROVING ── */}
          {step === 'approving' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} />
              <p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Meminta approval...</p>
              <p className="font-mono text-[10px] text-center" style={{ color: '#6b7280' }}>
                Ini dilakukan 1x saja. Konfirmasi di wallet kamu.
              </p>
            </div>
          )}

          {/* ── LISTING ── */}
          {step === 'listing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: tierColor }} />
              <p className="font-mono text-sm font-bold" style={{ color: tierColor }}>Membuat listing on-chain...</p>
              <p className="font-mono text-[10px] text-center" style={{ color: '#6b7280' }}>Tunggu konfirmasi.</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'rgba(74,222,128,.1)', border: '2px solid rgba(74,222,128,.3)' }}
              >✅</div>
              <div className="text-center">
                <p className="font-mono font-bold text-sm mb-1" style={{ color: '#4ade80' }}>Listing Berhasil!</p>
                <p className="font-mono text-[10px]" style={{ color: '#6b7280' }}>Kartu kamu sekarang tampil di Marketplace.</p>
              </div>
              {txHash && (
                <a
                  href={`https://testnet.arcscan.app/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono text-[10px] flex items-center gap-1 underline"
                  style={{ color: '#16e6ff' }}
                >View on ArcScan ↗</a>
              )}
              <button
                onClick={onClose}
                className="px-10 py-2.5 rounded-xl font-mono font-bold text-xs"
                style={{ background: tierColor, color: '#07070F' }}
              >Done</button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'rgba(255,107,107,.1)', border: '2px solid rgba(255,107,107,.3)' }}
              >❌</div>
              <div className="text-center">
                <p className="font-mono font-bold text-sm mb-1" style={{ color: '#ff6b6b' }}>Gagal</p>
                <p className="font-mono text-[10px] max-w-xs" style={{ color: '#9aa3b2' }}>{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-mono text-xs"
                  style={{ background: 'rgba(255,255,255,.05)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,.1)' }}
                >Close</button>
                <button
                  onClick={() => { setStep('form'); setErrorMsg('') }}
                  className="px-6 py-2.5 rounded-xl font-mono font-bold text-xs"
                  style={{ background: 'rgba(255,255,255,.1)', color: '#eef2ff' }}
                >Try Again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
