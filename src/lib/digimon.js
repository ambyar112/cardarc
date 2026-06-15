// Digimon TCG
const API_BASE = 'https://digimoncard.io/api-public'
const IMG_BASE = 'https://raw.githubusercontent.com/TakaOtaku/Digimon-Card-App/main/src/assets/images/cards'
const CACHE_TTL = 1000 * 60 * 60 * 6

function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}
function safeImg(url) {
  if (!url) return ''
  try {
    const p = new URL(url)
    if (p.protocol !== 'https:') return ''
    const allowed = ['raw.githubusercontent.com', 'digimoncard.io']
    return allowed.some(h => p.hostname === h || p.hostname.endsWith('.' + h)) ? url : ''
  } catch { return '' }
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}
function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

export function digimonRarityToTier(rarity = '', dp = 0) {
  const r = rarity.toLowerCase()
  if (r === 'sec' || r === 'ssp') return 'legendary'     // Secret / Special
  if (r === 'sr' || r === 'rar') return 'epic'           // Super Rare
  if (r === 'r' || (dp >= 8000)) return 'rare'           // Rare / high DP
  return 'common'
}

// Ambil kartu per warna dengan fetch detail per kartu
export async function fetchDigimonCards(color = null, limit = 60) {
  const cacheKey = `digi_pool_${color || 'all'}`
  const cached = getCached(cacheKey)
  if (cached) return cached.sort(() => Math.random() - 0.5).slice(0, limit)

  try {
    // Step 1: Ambil list semua kartu (hanya name + cardnumber)
    const listRes = await fetch(`${API_BASE}/getAllCards?series=Digimon%20Card%20Game&sort=random`)
    const allCards = await listRes.json()

    if (!Array.isArray(allCards)) throw new Error('Invalid response')

    // Filter hanya BT series (Booster packs) — skip ST, P, EX, dll
    const btCards = allCards.filter(c => {
      const cn = c.cardnumber || ''
      return cn.startsWith('BT') && !cn.includes('_')
    })

    // Ambil 25 random card numbers
    const sample = btCards.sort(() => Math.random() - 0.5).slice(0, 25)

    // Step 2: Fetch detail setiap kartu dengan filter color
    const details = await Promise.all(
      sample.map(c =>
        fetch(`${API_BASE}/search?card=${c.cardnumber}&series=Digimon%20Card%20Game`)
          .then(r => r.json())
          .catch(() => [])
      )
    )

    let cards = details.flat().filter(c =>
      c.id &&
      c.name &&
      c.type !== 'Digi-Egg' // skip telur
    )

    if (color) {
      cards = cards.filter(c => c.color?.toLowerCase() === color.toLowerCase())
    }

    // Deduplicate
    const seen = new Set()
    cards = cards.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    const mapped = cards.map(c => ({
      id:       `digi-${sanitize(c.id, 50)}`,
      name:     sanitize(c.name),
      img:      safeImg(`${IMG_BASE}/${sanitize(c.id, 50)}.webp`),
      tier:     digimonRarityToTier(c.rarity, c.dp || 0),
      rarity:   sanitize(c.rarity || 'C', 10),
      hp:       c.dp ? String(c.dp) : '—',
      types:    sanitize(c.color || '—', 50),
      localId:  sanitize(c.id, 50),
      setId:    'digimon',
      price:    null,
      dp:       c.dp,
      color:    sanitize(c.color, 50),
      level:    c.level,
      digiType: sanitize(c.digi_type || '', 100),
      form:     sanitize(c.form || '', 50),
      setName:  sanitize(c.set_name?.[0] || '', 100),
    }))

    setCache(cacheKey, mapped)
    return mapped.sort(() => Math.random() - 0.5).slice(0, limit)
  } catch (e) {
    console.error('Digimon fetch error:', e)
    return []
  }
}
