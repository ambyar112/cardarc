import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { safeWalletRecovery, debugWalletState, checkWalletRecoveryStatus } from '../lib/walletRecovery'

const NAV = [
  { path: '/gacha',       label: 'Gacha',       icon: '⚡' },
  { path: '/marketplace', label: 'Marketplace', icon: '🏪' },
  { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { path: '/faucet',      label: 'Faucet',      icon: '💧', badge: 'FREE', external: 'https://faucet.circle.com/' },
]

function shortAddr(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : '' }

// Generate deterministic color from address
function addrColor(addr) {
  if (!addr) return '#00f5ff'
  const hue = parseInt(addr.slice(2, 8), 16) % 360
  return `hsl(${hue}, 80%, 60%)`
}

// Avatar: default SVG user icon, colored by wallet address
function Avatar({ address, size = 32 }) {
  const color = addrColor(address)
  const initials = address ? address.slice(2, 4).toUpperCase() : '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}20`,
      border: `2px solid ${color}60`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {address ? (
        <span style={{ fontFamily: 'monospace', fontSize: size * 0.35, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
          {initials}
        </span>
      ) : (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="#849495" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#849495" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </div>
  )
}

export default function Header() {
  const navigate   = useNavigate()
  const { pathname } = useLocation()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  const [menu, setMenu]         = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const profileRef = useRef(null)
  const menuRef    = useRef(null)
  
  // Auto-reconnect timer for post-restart scenarios
  const [showReconnectButton, setShowReconnectButton] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  useEffect(() => {
    if (!isConnected) {
      // Show reconnect button after 2 seconds if wallet not connected
      const timer = setTimeout(() => {
        setShowReconnectButton(true)
      }, 2000)
      
      return () => clearTimeout(timer)
    } else {
      setShowReconnectButton(false)
      setReconnectAttempts(0)
    }
  }, [isConnected])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileMenu(false)
      if (menuRef.current    && !menuRef.current.contains(e.target))    setMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Mobile bottom nav items
  const MOBILE_NAV = [
    { path: '/',           label: 'Home',    icon: '🏠' },
    { path: '/gacha',      label: 'Gacha',   icon: '⚡' },
    { path: '/collection', label: 'Cards',   icon: '🃏' },
    { path: '/marketplace',label: 'Market',  icon: '🏪' },
    { path: '/leaderboard',label: 'Ranks',   icon: '🏆' },
  ]

  return (
    <>
    <header className="fixed top-0 w-full z-50 header-bg"
      style={{ backdropFilter: 'blur(20px)' }}>
      <div className="flex justify-between items-center px-4 md:px-12 h-14 md:h-16">

        {/* Logo */}
        <button onClick={() => navigate('/')}
          className="sora text-xl font-extrabold italic tracking-tighter logo-text"
          style={{ color: 'var(--text-primary)' }}>
          ARCCARDS
        </button>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 nav-pill"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '4px' }}>
          {NAV.map(n => {
            const active = pathname === n.path
            return (
              <button key={n.path} onClick={() => n.external ? window.open(n.external, '_blank') : navigate(n.path)}
                className="jbm text-[11px] uppercase tracking-wider px-4 py-2 transition-all duration-200 flex items-center gap-1.5"
                style={{
                  borderRadius: 6,
                  background: active ? 'rgba(0,245,255,0.12)' : 'transparent',
                  color: active ? '#00f5ff' : '#849495',
                  border: active ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e5e1e7' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#849495' }}>
                {n.icon} {n.label}
                {n.badge && (
                  <span className="jbm text-[8px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,245,255,0.15)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.2)' }}>
                    {n.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Right — avatar + wallet + menu */}
        <div className="flex items-center gap-2 relative">

          {/* ── Avatar / Profile button ── */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => {
                if (!isConnected) { open(); return }
                setProfileMenu(v => !v)
                setMenu(false)
              }}
              aria-label={isConnected ? `Profile menu for ${shortAddr(address)}` : 'Connect wallet'}
              aria-expanded={profileMenu}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all"
              style={{
                background: profileMenu ? 'rgba(0,245,255,0.08)' : 'transparent',
                border: `1px solid ${profileMenu ? 'rgba(0,245,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.3)' }}
              onMouseLeave={e => { if (!profileMenu) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
              <Avatar address={isConnected ? address : null} size={28} />
              {isConnected && (
                <span className="jbm text-[10px] hidden sm:block" style={{ color: '#9aa3b2' }}>
                  {shortAddr(address)}
                </span>
              )}
            </button>

            {/* Profile dropdown */}
            {profileMenu && isConnected && (
              <div className="absolute right-0 top-12 w-64 rounded-xl overflow-hidden z-50 dropdown-bg"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

                {/* Header */}
                <div className="px-4 py-4 flex items-center gap-3 dropdown-header"
                  style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                  <Avatar address={address} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="jbm text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>Collector</p>
                    <p className="jbm text-[10px] truncate" style={{ color: 'var(--accent-cyan)' }}>{shortAddr(address)}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(address || '')}
                    className="jbm text-[8px] px-2 py-1 rounded flex-shrink-0"
                    style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    COPY
                  </button>
                </div>

                {/* Profile & Settings */}
                <div className="py-1 dropdown-divider" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {[
                    { icon: '🎴', label: 'View Profile', path: '/profile' },
                    { icon: '⚙️', label: 'Settings',     path: '/settings' },
                  ].map(a => (
                    <button key={a.label}
                      onClick={() => { navigate(a.path); setProfileMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider transition-colors dropdown-item"
                      style={{ color: 'var(--text-muted)' }}>
                      <span>{a.icon}</span> {a.label}
                    </button>
                  ))}
                </div>

                {/* Wallet */}
                <div className="py-1">
                  <button
                    onClick={() => { open(); setProfileMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider transition-colors dropdown-item"
                    style={{ color: 'var(--text-muted)' }}>
                    🔑 Wallet Settings
                  </button>
                  <button
                    onClick={() => { debugWalletState(); setProfileMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider transition-colors dropdown-item"
                    style={{ color: 'var(--text-muted)' }}>
                    🔍 Debug Wallet
                  </button>
                  <button
                    onClick={() => { disconnect(); setProfileMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider transition-colors"
                    style={{ color: '#ff6b6b' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,107,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    🚪 Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Wallet connect button (shown only when not connected) ── */}
          {!isConnected && (
            <div className="flex items-center gap-1">
              <button onClick={() => open()}
                className="jbm text-[11px] uppercase tracking-wider px-4 py-2 transition-all flex items-center gap-2 connect-wallet"
                style={{
                  borderRadius: 6,
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-cyan)' }} />
                Connect Wallet
              </button>
              {showReconnectButton && (
                <button
                  onClick={() => safeWalletRecovery()}
                  className="jbm text-[10px] uppercase tracking-wider px-3 py-2 transition-all"
                  style={{
                    background: 'rgba(0,245,255,0.08)',
                    color: '#00f5ff',
                    border: '1px solid rgba(0,245,255,0.3)',
                    borderRadius: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.6)'; e.currentTarget.style.background = 'rgba(0,245,255,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.3)'; e.currentTarget.style.background = 'rgba(0,245,255,0.08)' }}
                  title="Reconnect wallet after restart">
                  🔄 Reconnect
                </button>
              )}
            </div>
          )}

          {/* ── Menu dots ── */}
          <div ref={menuRef} className="relative">
            <button onClick={() => { setMenu(v => !v); setProfileMenu(false) }}
              aria-label="Open navigation menu"
              aria-expanded={menu}
              className="w-8 h-8 flex items-center justify-center transition-all"
              style={{ border: '1px solid rgba(0,245,255,0.15)', borderRadius: 6, background: 'rgba(31,31,35,0.5)', color: '#849495' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.4)'; e.currentTarget.style.color = '#00f5ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.15)'; e.currentTarget.style.color = '#849495' }}>
              ⋮
            </button>

            {/* Dots dropdown — nav links + settings only, no View Profile */}
            {menu && (
              <div className="absolute right-0 top-11 w-56 rounded-xl overflow-hidden z-50"
                style={{ background: 'rgba(15,15,20,0.97)', border: '1px solid rgba(0,245,255,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

                {/* Nav links */}
                <div className="py-1" style={{ borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
                  {NAV.map(n => (
                    <button key={n.path} onClick={() => { n.external ? window.open(n.external, '_blank') : navigate(n.path); setMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider"
                      style={{ color: '#849495' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#e5e1e7'; e.currentTarget.style.background = 'rgba(0,245,255,0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#849495'; e.currentTarget.style.background = 'transparent' }}>
                      <span>{n.icon}</span> {n.label}
                      {n.badge && (
                        <span className="ml-auto jbm text-[8px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,245,255,0.15)', color: '#00f5ff' }}>{n.badge}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Settings only */}
                <div className="py-1">
                  <button onClick={() => { navigate('/settings'); setMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left jbm text-[11px] uppercase tracking-wider"
                    style={{ color: '#849495' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#e5e1e7'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#849495'; e.currentTarget.style.background = 'transparent' }}>
                    ⚙️ Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* ── Mobile Bottom Navigation Bar ── */}
    {/* Visible only on mobile (md:hidden), sticky at bottom */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around mobile-nav"
      style={{
        backdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(56px + env(safe-area-inset-bottom))',
      }}>
      {MOBILE_NAV.map(n => {
        const active = pathname === n.path || (n.path !== '/' && pathname.startsWith(n.path))
        return (
          <button key={n.path}
            onClick={() => navigate(n.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${active ? 'mobile-nav-item-active' : 'mobile-nav-item'}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider"
              style={{ fontWeight: active ? 700 : 400 }}>
              {n.label}
            </span>
            {active && (
              <span className="absolute bottom-0 rounded-t-full mobile-nav-indicator"
                style={{ width: 24, height: 2 }} />
            )}
          </button>
        )
      })}
    </nav>
    </>
  )
}
