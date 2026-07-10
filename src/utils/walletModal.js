export function tryDismissWalletModal() {
  if (typeof document === 'undefined') return
  try {
    const selectors = [
      '[data-w3m-modal] button',
      '[aria-label="Close"]',
      '.w3m-modal-close',
      '[data-testid="wallet-modal-close"]',
      'w3m-modal button[aria-label="Close"]",
      '[class*="w3m"] button[class*="close"]',
      'button[aria-label="Close wallet"]',
    ]
    for (const s of selectors) {
      const el = document.querySelector(s)
      if (el) { el.click(); return }
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  } catch (e) { /* noop */ }
}
