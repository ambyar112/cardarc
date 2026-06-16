import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { getRealLeaderboard, getExplorerFeed } from '../lib/supabase'

const RANK_COLORS = ['#ffdb40', '#b9caca', '#cd7f32']

function shortAddr(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : '—' }
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}
function formatVol(n) {
  if (n >= 1000) return (n/1000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}
function actionLabel(row) {
  const qty = row.qty || 1
  const pull = qty >= 10 ? `10× Multi Pull` : `1× Pull`
  const tier = row.tier === 'legendary' ? '🌟 Legendary' :
               row.tier === 'epic'      ? '💜 Epic' :
               row.tier === 'rare'      ? '💎 Rare' : 'Common'
  return `${pull} — ${row.card_name} (${tier})`
}
function gameFromId(cardId) {
  if (!cardId) return '⚡ PKM'
  if (cardId.startsWith('ygo-'))  return '⚔️ YGO'
  if (cardId.startsWith('dbs-'))  return '🔥 DBS'
  return '⚡ PKM'
}

export default function Leaderboard() {
  const { address } = useAccount()
  const [board, setBoard]         = useState([])
  const [boardLoading, setBoardLoading] = useState(true)
  const [feed, setFeed]           = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [search, setSearch]       = useState('')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  // Load leaderboard
  useEffect(() => {
    setBoardLoading(true)
    getRealLeaderboard(20).then(data => {
      setBoard(data)
      setBoardLoading(false)
    })
  }, [lastRefresh])

  // Load explorer feed
  useEffect(() => {
    setFeedLoading(true)
    getExplorerFeed(25).then(data => {
      setFeed(data)
      setFeedLoading(false)
    })
  }, [lastRefresh])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => setLastRefresh(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const filteredFeed = feed.filter(r =>
    !search ||
    r.card_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.wallet?.includes(search)
  )

  return (
    <div className="pt-24 px-4 lg:px-12 pb-16 max-w-7xl mx-auto flex flex-col gap-6" style={{ color: '#e5e1e7' }}>

      {/* Network status bar — live data */}
      <div className="glass rounded-xl px-5 py-3 flex flex-col md:flex-row justify-between items-center gap-4"
        style={{ borderLeft: '3px solid #00f5ff' }}>
        <div className="flex items-center gap-3">
          <span className="relative flex" style={{ width: 12, height: 12 }}>
            <span className="animate-ping absolute inline-flex rounded-full opacity-75"
              style={{ width: 12, height: 12, background: '#00f5ff' }} />
            <span className="relative inline-flex rounded-full"
              style={{ width: 12, height: 12, background: '#00f5ff' }} />
          </span>
          <span className="jbm uppercase" style={{ fontSize: 11, color: '#00f5ff', letterSpacing: '0.12em' }}>
            Arc Testnet — Live Activity Feed
          </span>
        </div>
        <div className="flex gap-3 items-center">
          <div className="jbm flex items-center gap-1.5 px-3 py-1 rounded"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', fontSize: 11, color: '#b9caca' }}>
            <span style={{ color: '#00f5ff' }}>Chain:</span> 5042002
          </div>
          <div className="jbm flex items-center gap-1.5 px-3 py-1 rounded"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', fontSize: 11, color: '#b9caca' }}>
            <span style={{ color: '#00f5ff' }}>Players:</span>
            {boardLoading ? '...' : board.length}
          </div>
          <button onClick={() => setLastRefresh(Date.now())}
            className="jbm flex items-center gap-1 px-3 py-1 rounded transition-all"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', fontSize: 11, color: '#00f5ff', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Global Rankings */}
      <div className="glass rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 30px rgba(0,245,255,0.06)' }}>
        <div className="px-6 py-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(0,245,255,0.1)', background: 'rgba(0,245,255,0.03)' }}>
          <span className="material-symbols-outlined" style={{ color: '#ffdb40', fontSize: 20 }}>emoji_events</span>
          <h2 className="sora font-bold" style={{ fontSize: 16, color: '#e5e1e7' }}>Global Rankings</h2>
          <div className="jbm ml-auto px-2.5 py-0.5 rounded"
            style={{ fontSize: 10, background: 'rgba(255,219,64,0.15)', color: '#ffdb40',
                     border: '1px solid rgba(255,219,64,0.4)', letterSpacing: '0.08em', fontWeight: 700 }}>
            SEASON 4 · LIVE
          </div>
        </div>

        {boardLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl animate-spin">refresh</span>
            <span className="font-mono text-xs">Loading rankings...</span>
          </div>
        ) : board.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="text-3xl">🏆</span>
            <p className="font-mono text-xs">No rankings yet. Start pulling cards!</p>
          </div>
        ) : (
              <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="jbm uppercase"
                  style={{ fontSize: 10, color: '#b9caca', letterSpacing: '0.1em',
                           borderBottom: '1px solid rgba(0,245,255,0.08)', background: 'rgba(5,5,8,0.4)' }}>
                  <th className="px-2 sm:px-3 py-3 whitespace-nowrap">Rank</th>
                  <th className="px-2 sm:px-3 py-3">Player</th>
                  <th className="px-2 sm:px-3 py-3 text-right hidden sm:table-cell whitespace-nowrap">Total Pulls</th>
                  <th className="px-2 sm:px-3 py-3 text-right whitespace-nowrap">Legendary ✦</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r, i) => {
                  const isYou = address && r.wallet.toLowerCase() === address.toLowerCase()
                  const rankColor = i < 3 ? RANK_COLORS[i] : '#3a494a'
                  return (
                    <tr key={r.wallet}
                      style={{
                        borderBottom: '1px solid rgba(0,245,255,0.05)',
                        background: isYou ? 'rgba(0,245,255,0.05)' : 'transparent',
                        borderLeft: isYou ? '3px solid #00f5ff' : '3px solid transparent',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => { if (!isYou) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isYou) e.currentTarget.style.background = 'transparent' }}>
                      <td className="px-2 sm:px-3 py-3">
                        <span className="jbm font-bold" style={{ fontSize: 14, color: rankColor }}>
                          {i === 0 ? '👑' : String(i + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="jbm flex items-center justify-center rounded flex-shrink-0"
                            style={{
                              width: 28, height: 28, fontSize: 9, fontWeight: 700,
                              background: isYou ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.05)',
                              border: isYou ? '1px solid rgba(0,245,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                              color: isYou ? '#00f5ff' : '#b9caca',
                            }}>
                            {isYou ? 'YOU' : String(i + 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="sora font-semibold truncate" style={{ fontSize: 12, color: isYou ? '#00f5ff' : '#e5e1e7', maxWidth: '120px' }}>
                              {r.username || shortAddr(r.wallet)}
                            </div>
                            {/* Hide full wallet on mobile */}
                            <div className="jbm hidden sm:block truncate" style={{ fontSize: 9, color: '#3a494a', maxWidth: '120px' }}>
                              {r.wallet}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-right hidden sm:table-cell">
                        <span className="jbm" style={{ fontSize: 12, color: '#9aa3b2' }}>
                          {r.totalPulls.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span style={{ fontSize: 12 }}>✦</span>
                          <span className="jbm font-bold" style={{ fontSize: 12, color: '#ffdb40' }}>
                            {r.legendary_count}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ArcScan Explorer — real gacha_log feed */}
      <div className="glass rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 30px rgba(148,0,228,0.07)' }}>
        <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{ borderBottom: '1px solid rgba(0,245,255,0.1)', background: 'rgba(148,0,228,0.04)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ color: '#9400e4', fontSize: 20 }}>terminal</span>
            <h2 className="sora font-bold" style={{ fontSize: 16, color: '#e5e1e7' }}>ArcScan Explorer</h2>
            <span className="jbm"
              style={{ fontSize: 9, color: '#9400e4', background: 'rgba(148,0,228,0.12)',
                       border: '1px solid rgba(148,0,228,0.3)', padding: '2px 8px',
                       borderRadius: 4, letterSpacing: '0.1em' }}>
              LIVE DATA
            </span>
          </div>
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#3a494a', fontSize: 16 }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search card or wallet..."
              className="arc-input w-full rounded-lg py-2.5 pl-9 pr-4"
              style={{ fontSize: 11 }} />
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div className="scan-line" />
          {feedLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-2xl animate-spin">refresh</span>
              <span className="font-mono text-xs">Loading activity...</span>
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
              <span className="text-3xl">📡</span>
              <p className="font-mono text-xs">No activity yet. Pull some cards!</p>
            </div>
          ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="jbm uppercase"
                    style={{ fontSize: 10, color: '#b9caca', letterSpacing: '0.1em',
                             borderBottom: '1px solid rgba(0,245,255,0.08)', background: 'rgba(5,5,8,0.4)' }}>
                    <th className="px-3 sm:px-6 py-3">Tx ID</th>
                    <th className="px-3 sm:px-6 py-3">Action</th>
                    <th className="px-3 sm:px-6 py-3 hidden sm:table-cell">Game</th>
                    <th className="px-3 sm:px-6 py-3 text-right">Wallet</th>
                    <th className="px-3 sm:px-6 py-3 text-right hidden xs:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeed.map((row, i) => {
                    const isYou = address && row.wallet?.toLowerCase() === address.toLowerCase()
                    return (
                      <tr key={row.id || i}
                        style={{ borderBottom: '1px solid rgba(0,245,255,0.05)', transition: 'background 0.2s',
                                 background: isYou ? 'rgba(0,245,255,0.04)' : 'transparent' }}
                        onMouseEnter={e => { if (!isYou) e.currentTarget.style.background = 'rgba(0,245,255,0.03)' }}
                        onMouseLeave={e => { if (!isYou) e.currentTarget.style.background = isYou ? 'rgba(0,245,255,0.04)' : 'transparent' }}>
                        <td className="px-3 sm:px-6 py-3">
                          <span className="jbm" style={{ fontSize: 11, color: '#9400e4' }}>
                            #{String(row.id || i).slice(0,8).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 max-w-[140px] sm:max-w-none">
                          <span className="jbm line-clamp-2 sm:line-clamp-1" style={{ fontSize: 11, color: '#e5e1e7' }}>
                            {actionLabel(row)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 hidden sm:table-cell">
                          <span className="jbm" style={{ fontSize: 11, color: '#b9caca' }}>
                            {gameFromId(row.card_id)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-right">
                          <span className="jbm" style={{ fontSize: 11, color: isYou ? '#00f5ff' : '#b9caca', fontWeight: isYou ? 700 : 400 }}>
                            {isYou ? 'YOU' : shortAddr(row.wallet)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-right hidden xs:table-cell">
                          <span className="jbm" style={{ fontSize: 11, color: '#3a494a' }}>
                            {timeAgo(row.created_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
          )}
        </div>

        <div className="px-6 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(0,245,255,0.08)', background: 'rgba(5,5,8,0.3)' }}>
          <span className="jbm" style={{ fontSize: 10, color: '#3a494a' }}>
            {feedLoading ? '—' : `${filteredFeed.length} of ${feed.length} activities`}
          </span>
          <span className="jbm" style={{ fontSize: 10, color: '#3a494a' }}>
            Arc Testnet Chain 5042002 • Auto-refresh 30s
          </span>
        </div>
      </div>
    </div>
  )
}
