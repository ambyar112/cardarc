import { useEffect } from 'react'
import { tryDismissWalletModal } from '../utils/walletModal'

export default function useDismissWalletModal(opts = {}) {
  const { when, delay = 250, deps = [] } = opts
  useEffect(() => {
    if (!when) return
    const t = setTimeout(() => tryDismissWalletModal(), delay)
    return () => clearTimeout(t)
  }, [when, delay, ...deps])
}
