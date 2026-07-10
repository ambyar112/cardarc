import { useEffect } from 'react'

export default function useMobileSafeModal(open) {
  useEffect(() => {
    if (!open) return
    const m = window.matchMedia('(max-width: 768px)').matches
    if (m) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [open])
}
