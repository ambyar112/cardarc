import type { VercelRequest, VercelResponse } from '@vercel/node'

// Server-side proxy for Yu-Gi-Oh card images (bypass Cloudflare 403 on client)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '').replace(/[^0-9]/g, '')
  if (!id) { res.status(400).send('missing id'); return }

  const url = `https://images.ygoprodeck.com/images/cards/${id}.jpg`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ygoprodeck.com/' },
      redirect: 'follow',
    })
    if (!r.ok) {
      // fallback to local placeholder
      res.redirect(`/api/card-img?name=ygo-${id}&set=yugioh&tier=common`)
      return
    }
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.status(200).send(buf)
  } catch {
    res.redirect(`/api/card-img?name=ygo-${id}&set=yugioh&tier=common`)
  }
}
