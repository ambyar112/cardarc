import { createClient } from '@supabase/supabase-js'

// Service role key from Vercel env
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xswquwhtulshrvwkyjqu.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd3F1d2h0dWxzaHJ2d2t5anF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDYyNTEsImV4cCI6MjA5NjMyMjI1MX0.RTB0QJDJnb-17RKgnAPVZXALPvxWvZcRIMW1_evtO98'

const sellers = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234'
]

const sampleListings = [
  { on_chain_listing_id: 1, seller: sellers[0], card_id: 'swsh8-123', card_name: 'Pikachu VMAX', card_img: 'https://assets.tcgdex.net/en/swsh/swsh8/123/high.webp', tier: 'legendary', set_id: 'pokemon', price_wei: '50000000000000000000', price_usdc: 50.00, status: 'active' },
  { on_chain_listing_id: 2, seller: sellers[1], card_id: 'ygo-89631139', card_name: 'Blue-Eyes White Dragon', card_img: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', tier: 'epic', set_id: 'yugioh', price_wei: '35500000000000000000', price_usdc: 35.50, status: 'active' },
  { on_chain_listing_id: 3, seller: sellers[2], card_id: 'dbs-bt1-001', card_name: 'Son Goku', card_img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/BT1-001_f.webp', tier: 'rare', set_id: 'dragonball', price_wei: '25000000000000000000', price_usdc: 25.00, status: 'active' },
  { on_chain_listing_id: 4, seller: sellers[3], card_id: 'sv02-087', card_name: 'Charizard ex', card_img: 'https://assets.tcgdex.net/en/sv/sv02/087/high.webp', tier: 'legendary', set_id: 'pokemon', price_wei: '75000000000000000000', price_usdc: 75.00, status: 'active' },
  { on_chain_listing_id: 5, seller: sellers[4], card_id: 'ygo-46986414', card_name: 'Dark Magician', card_img: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', tier: 'epic', set_id: 'yugioh', price_wei: '40000000000000000000', price_usdc: 40.00, status: 'active' }
]

export default async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization
  const expectedToken = process.env.SEED_SECRET || 'arccc-seed-2026'
  
  if (authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!supabaseServiceKey) {
    return res.status(500).json({ 
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel env vars',
      hint: 'Add SUPABASE_SERVICE_ROLE_KEY to Vercel project settings'
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  try {
    // Step 1: Create profiles
    const profiles = sellers.map(wallet => ({
      wallet: wallet.toLowerCase(),
      username: `seller_${wallet.slice(2, 8)}`,
      level: 10,
      legendary_count: 5
    }))

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profiles, { onConflict: 'wallet' })

    if (profileError) throw new Error(`Profile error: ${profileError.message}`)

    // Step 2: Clear existing listings (idempotent)
    await supabase.from('marketplace').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Step 3: Insert listings
    const { data, error: insertError } = await supabase
      .from('marketplace')
      .insert(sampleListings)
      .select()

    if (insertError) throw new Error(`Insert error: ${insertError.message}`)

    return res.status(200).json({
      success: true,
      profiles_created: profiles.length,
      listings_created: data?.length || 0,
      message: 'Marketplace seeded successfully!'
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}