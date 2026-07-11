import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xswquwhtulshrvwkyjqu.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const sellers = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234'
]

const sampleListings = [
  { seller: sellers[0], card_id: 'swsh8-123', card_name: 'Pikachu VMAX', card_img: 'https://assets.tcgdex.net/en/swsh/swsh8/123/high.webp', tier: 'legendary', set_id: 'pokemon', price_usdc: 50.00, status: 'active' },
  { seller: sellers[1], card_id: 'ygo-89631139', card_name: 'Blue-Eyes White Dragon', card_img: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', tier: 'epic', set_id: 'yugioh', price_usdc: 35.50, status: 'active' },
  { seller: sellers[2], card_id: 'dbs-bt1-001', card_name: 'Son Goku', card_img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/BT1-001_f.webp', tier: 'rare', set_id: 'dragonball', price_usdc: 25.00, status: 'active' },
  { seller: sellers[3], card_id: 'sv02-087', card_name: 'Charizard ex', card_img: 'https://assets.tcgdex.net/en/sv/sv02/087/high.webp', tier: 'legendary', set_id: 'pokemon', price_usdc: 75.00, status: 'active' },
  { seller: sellers[4], card_id: 'ygo-46986414', card_name: 'Dark Magician', card_img: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', tier: 'epic', set_id: 'yugioh', price_usdc: 40.00, status: 'active' }
]

export default async function handler(req, res) {
  // Get API key from environment (must be set in Vercel)
  const expectedToken = process.env.SEED_API_KEY
  
  if (!expectedToken) {
    console.error('SEED_API_KEY not configured')
    return res.status(500).json({ error: 'Server configuration error' })
  }
  
  const authHeader = req.headers.authorization
  const providedToken = authHeader?.replace('Bearer ', '') || ''
  
  // Constant-time comparison to prevent timing attacks
  if (providedToken.length !== expectedToken.length) {
    console.warn('Seed endpoint unauthorized attempt - invalid token length')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Use crypto.timingSafeEqual for constant-time comparison
  const expectedBuffer = Buffer.from(expectedToken, 'utf8')
  const providedBuffer = Buffer.from(providedToken, 'utf8')
  
  try {
    const crypto = await import('crypto')
    if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      console.warn('Seed endpoint unauthorized attempt - invalid token')
      return res.status(401).json({ error: 'Unauthorized' })
    }
  } catch (err) {
    console.warn('Seed endpoint unauthorized attempt - comparison failed')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  console.log('Seed endpoint accessed successfully')
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const profiles = sellers.map(wallet => ({
      wallet: wallet.toLowerCase(),
      username: `seller_${wallet.slice(2, 8)}`,
      level: 10,
      legendary_count: 5
    }))

    // Upsert profiles using service_role (bypass RLS)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profiles, { onConflict: 'wallet', count: 'exact' })

    if (profileError) throw new Error(`Profile error: ${profileError.message}`)

    // Insert marketplace listings - only columns confirmed to exist
    const { data: marketResult, error: insertError } = await supabase
      .from('marketplace_listings')
      .insert(sampleListings.map(l => ({
        seller: l.seller,
        card_id: l.card_id,
        card_name: l.card_name,
        card_img: l.card_img,
        tier: l.tier,
        set_id: l.set_id,
        status: l.status || 'active'
      })), { count: 'exact' })

    if (insertError) throw new Error(`Insert error: ${insertError.message}`)

    return res.status(200).json({
      success: true,
      profiles_created: profiles.length,
      listings_created: marketResult?.length || sampleListings.length,
      message: 'Marketplace seeded successfully!'
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}