import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Gacha from './pages/Gacha'
import Collection from './pages/Collection'
import Marketplace from './pages/Marketplace'
import Leaderboard from './pages/Leaderboard'
import Faucet from './pages/Faucet'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AppLayout>
      {/* Skip to main content — accessibility landmark */}
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold"
        style={{ background: '#00f5ff', color: '#07070F' }}>
        Skip to main content
      </a>

      <Header />

      {/* pb-16 md:pb-0 = space for mobile bottom nav bar */}
      <main id="main-content" className="relative z-10 pb-16 md:pb-0">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/home"        element={<Home />} />
          <Route path="/gacha"       element={<Gacha />} />
          <Route path="/collection"  element={<Collection />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/faucet"      element={<Faucet />} />
          <Route path="/profile"     element={<Profile />} />
          <Route path="/settings"    element={<Settings />} />
        </Routes>
      </main>

      <footer
        role="contentinfo"
        className="relative z-10 w-full py-5 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4"
        style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(0,245,255,0.08)' }}>
        <span className="sora text-lg font-extrabold italic" style={{ color: '#e9feff' }}>ARCCARDS</span>
        <nav aria-label="Footer navigation" className="flex gap-6">
          {[
            { label: 'Docs', href: '#' },
            { label: 'X',    href: 'https://x.com/ShafiqqMu' },
          ].map(l => (
            <a key={l.label} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noreferrer' : undefined}
              aria-label={l.label}
              className="jbm text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: '#849495' }}
              onMouseEnter={e => e.target.style.color='#00f5ff'}
              onMouseLeave={e => e.target.style.color='#849495'}>
              {l.label}
            </a>
          ))}
        </nav>
        <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(180,196,196,0.7)' }}>
          © 2026 ARCCARDS • CHAIN 5042002
        </span>
      </footer>
    </AppLayout>
  )
}
