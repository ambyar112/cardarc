import { useEffect } from 'react'

function tryDismissWalletModal() {
  if (typeof document === 'undefined') return
  try {
    const modal = document.querySelector('w3m-modal.open, [data-w3m-modal] .open, w3m-modal')
    if (!modal) return
    const close = modal.querySelector('[aria-label="Close"], button[class*="close"]')
    if (close) { close.click(); return }
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }))
    document.dispatchEvent(new MouseEvent('click', { bubbles:true }))
  } catch { /* noop */ }
}

export default function useAutoDismissWalletModal(enabled, opts = {}) {
  const { delay = 0 } = opts
  useEffect(() => {
    if (!enabled) return
    let t
    const attempt = (n = 0) => {
      if (n > 4) return
      tryDismissWalletModal()
      t = setTimeout(() => attempt(n + 1), 150)
    }
    t = setTimeout(attempt, delay)
    return () => clearTimeout(t)
  }, [enabled, delay])
}
