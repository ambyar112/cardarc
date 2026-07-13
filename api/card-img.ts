import type { VercelRequest, VercelResponse } from '@vercel/node'

// Generate inline SVG placeholder card (no external deps, always renders)
export default function handler(req: VercelRequest, res: VercelResponse) {
  const name = String(req.query.name || 'Card').slice(0, 24)
  const setId = String(req.query.set || 'pokemon').toLowerCase()
  const tier = String(req.query.tier || 'common').toLowerCase()

  const palette: Record<string, { bg: string; fg: string; icon: string }> = {
    pokemon:    { bg: '#1a2a4f', fg: '#7dd3fc', icon: '⚡' },
    yugioh:     { bg: '#3a2f0a', fg: '#fde68a', icon: '⚔️' },
    dragonball: { bg: '#3a1505', fg: '#fdba74', icon: '🔥' },
    common:     { bg: '#1f2937', fg: '#9ca3af', icon: '🃏' },
  }
  const p = palette[setId] || palette.common

  const tierColor: Record<string, string> = {
    legendary: '#f5c84c',
    epic: '#a78bfa',
    rare: '#16e6ff',
    common: '#9ca3af',
  }
  const tc = tierColor[tier] || '#9ca3af'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="#07080f"/>
    </linearGradient>
  </defs>
  <rect width="300" height="420" rx="14" fill="url(#g)" stroke="${tc}" stroke-width="2"/>
  <text x="150" y="150" font-size="72" text-anchor="middle" fill="${p.fg}">${p.icon}</text>
  <text x="150" y="250" font-size="20" font-weight="bold" text-anchor="middle" fill="${p.fg}" font-family="sans-serif">${escapeXml(name)}</text>
  <text x="150" y="290" font-size="12" text-anchor="middle" fill="${tc}" font-family="sans-serif" text-transform="uppercase">${escapeXml(tier)}</text>
  <text x="150" y="390" font-size="10" text-anchor="middle" fill="#6b7280" font-family="sans-serif">ARCCARDS</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.status(200).send(svg)
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c))
}
