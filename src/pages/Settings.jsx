import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useNavigate } from 'react-router-dom'

const VERSION  = '1.0.0'
// ✅ FIX FRONT-04: Use only env var — no wrong hardcoded fallback address
const CONTRACT     = import.meta.env.VITE_CONTRACT_ADDRESS     || ''
const MARKETPLACE  = import.meta.env.VITE_MARKETPLACE_ADDRESS  || ''

export default function Settings() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()
  const navigate = useNavigate()
  const [cleared, setCleared] = useState(false)

  function clearCache() {
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('pkm_') || k.startsWith('ygo_') || k.startsWith('dbs_')
    )
    keys.forEach(k => localStorage.removeItem(k))
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  const network = {
    name:     'Arc Testnet',
    chainId:  '5042002',
    rpc:      'https://rpc.testnet.arc.network',
    explorer: 'https://testnet.arcscan.app',
    symbol:   'USDC',
  }

  return (
    <div className="pt-24 px-4 lg:px-12 pb-12 max-w-[700px] mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-on-surface">Settings</h1>
        <p className="font-body text-on-surface-variant text-sm mt-1">Konfigurasi akun dan aplikasi</p>
      </div>

      {/* Wallet */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-surface-container-low/40">
          <h3 className="font-display text-sm font-semibold text-on-surface">Wallet</h3>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {isConnected ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container">
                <div>
                  <p className="font-mono text-[10px] text-on-surface-variant mb-0.5">Connected Address</p>
                  <p className="font-mono text-xs text-tertiary break-all">{address}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => open()}
                  className="flex-1 py-2.5 rounded-lg font-body text-xs font-semibold border border-white/10 bg-white/5 text-on-surface hover:bg-white/10 transition-colors">
                  Switch Wallet
                </button>
                <button onClick={() => { disconnect(); navigate('/') }}
                  className="flex-1 py-2.5 rounded-lg font-body text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => open()}
              className="w-full py-3 rounded-lg font-body text-sm font-semibold btn-primary">
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Network Info */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-surface-container-low/40">
          <h3 className="font-display text-sm font-semibold text-on-surface">Network</h3>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {Object.entries(network).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-container">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase flex-shrink-0">{key}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] text-tertiary truncate max-w-[160px] sm:max-w-none">{val}</span>
                <button onClick={() => navigator.clipboard.writeText(val)}
                  className="font-mono text-[8px] text-on-surface-variant hover:text-on-surface bg-white/5 px-1.5 py-0.5 rounded border border-white/10 transition-colors flex-shrink-0">
                  COPY
                </button>
              </div>
            </div>
          ))}
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg font-body text-xs border border-tertiary/20 bg-tertiary/5 text-tertiary hover:bg-tertiary/10 transition-colors mt-1">
            🔗 Open Arc Explorer
          </a>
        </div>
      </div>

      {/* Smart Contract */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-surface-container-low/40">
          <h3 className="font-display text-sm font-semibold text-on-surface">Smart Contract</h3>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {[
            { label: 'ArcCards ERC-1155', value: CONTRACT },
            { label: 'ArcMarketplace',    value: MARKETPLACE },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-surface-container flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] text-on-surface-variant mb-0.5">{label}</p>
                <p className="font-mono text-[10px] text-tertiary break-all">
                  {value || <span className="text-red-400">Not configured</span>}
                </p>
              </div>
              {value && (
                <button
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="font-mono text-[8px] text-on-surface-variant hover:text-on-surface bg-white/5 px-2 py-1 rounded border border-white/10 transition-colors flex-shrink-0"
                >COPY</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cache */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-surface-container-low/40">
          <h3 className="font-display text-sm font-semibold text-on-surface">Cache & Performance</h3>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="font-body text-xs text-on-surface-variant">
            Card pool di-cache selama 6 jam untuk mempercepat loading. Klik tombol di bawah untuk refresh paksa.
          </p>
          <button onClick={clearCache}
            className={`w-full py-2.5 rounded-lg font-body text-xs font-semibold border transition-colors ${
              cleared
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-white/10 bg-white/5 text-on-surface hover:bg-white/10'
            }`}>
            {cleared ? '✓ Cache Cleared!' : '🗑 Clear Card Cache'}
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-on-surface-variant uppercase">ArcCards</p>
          <p className="font-mono text-xs text-on-surface">Version {VERSION}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-on-surface-variant">Built on</p>
          <p className="font-mono text-xs text-tertiary">Arc Testnet • Chain 5042002</p>
        </div>
      </div>
    </div>
  )
}
