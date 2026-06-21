import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'

// ═══════════════════════════════════════════════════════════════════════
// CHAIN CONFIGURATION - ARC NETWORK ONLY
// ═══════════════════════════════════════════════════════════════════════

// Arc Testnet - Primary network for ArcCards dApp
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

// Always return Arc Testnet
export const getActiveChain = () => arcTestnet

// ═══════════════════════════════════════════════════════════════════════
// APPKIT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID

// Only Arc Testnet supported
const networks = [arcTestnet]

export const wagmiAdapter = new WagmiAdapter({ 
  networks, 
  projectId: PROJECT_ID,
  ssr: false
})
export const wagmiConfig  = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: PROJECT_ID,
  metadata: {
    name: 'ArcCards',
    description: 'Pokémon NFT Gacha on Arc Testnet',
    // Use production URL — must match the deployed domain for WalletConnect verification
    url: import.meta.env.VITE_APP_URL || 'https://cardarc.vercel.app',
    icons: ['https://assets.tcgdex.net/univ/swsh/swsh3/symbol'],
  },
  themeMode: 'dark',
  themeVariables: { '--w3m-accent': '#6c5ce7', '--w3m-border-radius-master': '12px' },
  features: { analytics: false },
})

// ── Session management ───────────────────────────────────────────
// Auto-disconnect if session is older than SESSION_TTL_MS or if
// the page becomes visible after a long period (sleep/hibernate).
// beforeunload is NOT reliable on sleep/shutdown, so we use a
// timestamp-based approach instead.

const SESSION_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

function clearWalletSession() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (
        key.startsWith('wc@') ||
        key.startsWith('@appkit') ||
        key.startsWith('W3M') ||
        key.startsWith('wagmi') ||
        key.includes('walletconnect')
      ) {
        localStorage.removeItem(key)
      }
    })
    localStorage.removeItem('arc_session_ts')
  } catch {}
}

function isSessionExpired() {
  try {
    const ts = parseInt(localStorage.getItem('arc_session_ts') || '0', 10)
    if (!ts) return false // no session recorded yet
    return Date.now() - ts > SESSION_TTL_MS
  } catch { return false }
}

if (typeof window !== 'undefined') {
  // ── Browser-close auto-disconnect ────────────────────────────
  // sessionStorage is per-tab and CLEARED when the browser is closed.
  // On load: if sessionStorage flag is missing, this is a fresh browser
  // session → clear all persisted wallet data so Wagmi cannot reconnect.
  // If the flag exists, the tab was refreshed mid-session → allow reconnect.

  const SESSION_FLAG = 'arc_browser_session_active'

  function isNewBrowserSession() {
    try {
      return !sessionStorage.getItem(SESSION_FLAG)
    } catch { return true }
  }

  function markSessionActive() {
    try { sessionStorage.setItem(SESSION_FLAG, '1') } catch {}
  }

  if (isNewBrowserSession()) {
    // Fresh browser open (or browser was closed & reopened) — wipe wallet state
    clearWalletSession()
  } else {
    // Tab refresh within same browser session — allow Wagmi reconnect
    // But still enforce 4-hour expiry
    if (isSessionExpired()) {
      clearWalletSession()
    } else {
      try { localStorage.setItem('arc_session_ts', String(Date.now())) } catch {}
    }
  }
  markSessionActive()

  // Also clear on tab close as immediate cleanup
  window.addEventListener('beforeunload', () => {
    clearWalletSession()
    try { sessionStorage.removeItem(SESSION_FLAG) } catch {}
  })

  // On visibility change — enforce session expiry
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isSessionExpired()) {
      clearWalletSession()
      window.location.reload()
    }
  })
}
