import { useEffect } from 'react'

export default function Faucet() {
  useEffect(() => {
    window.location.replace('https://faucet.circle.com/')
  }, [])

  return (
    <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-spin"
        style={{ borderTopColor: '#16e6ff' }} />
      <p className="font-mono text-sm" style={{ color: '#16e6ff' }}>
        Redirecting to Circle Faucet...
      </p>
    </div>
  )
}
