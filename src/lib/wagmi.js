import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID
const networks   = [arcTestnet]

export const wagmiAdapter = new WagmiAdapter({ networks, projectId: PROJECT_ID })
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
  // On load — allow Wagmi to attempt auto-reconnection first
  // Only clear session if it's truly expired (4+ hours)
  // Updated timestamp on load to allow reconnection to proceed
  if (isSessionExpired()) {
    // Session is genuinely old (4+ hours), clear it
    clearWalletSession()
  } else {
    // Session is recent, allow Wagmi to auto-reconnect
    // Update timestamp to reflect page load
    try { localStorage.setItem('arc_session_ts', String(Date.now())) } catch {}
  }

  // On tab becomes visible again (after sleep/wake, tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isSessionExpired()) {
      clearWalletSession()
      // Force page reload so React state reflects disconnected
      window.location.reload()
    }
  })

  // Update timestamp periodically while active (every 5 min)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      try { localStorage.setItem('arc_session_ts', String(Date.now())) } catch {}
    }
  }, 5 * 60 * 1000)

  // Still clear on tab close as bonus
  window.addEventListener('beforeunload', clearWalletSession)
}
