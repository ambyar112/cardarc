const { createClient } = require('@supabase/supabase-js')

// Use SERVICE_ROLE_KEY to bypass RLS
const supabaseUrl = 'https://xswquwhtulshrvwkyjqu.supabase.co'
// We need service role key here, but anon key can also work if we disable RLS temporarily
// For seeding, we'll use anon key and rely on auth.uid() check OR we need service role
// Since we don't have service role key, we'll create profile rows first via anon (which has INSERT policy)

// Actually, the RLS policy requires auth.uid() - which we don't have from node script
// So we need to use service role. Let me check if we have it in env or use direct SQL

// WORKAROUND: We'll use the anon key but the policies allow public SELECT
// For INSERT we need service role. Let's use a different approach:
// Insert via direct REST API with service role if available, or temporarily disable RLS via SQL

// Check if we have service role key in env
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (serviceRoleKey) {
  console.log('🔑 Using SERVICE_ROLE_KEY')
} else {
  console.log('⚠️  No SERVICE_ROLE_KEY found, trying with anon key (INSERT may fail due to RLS)')
}

const supabaseKey = serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd3F1d2h0dWxzaHJ2d2t5anF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDYyNTEsImV4cCI6MjA5NjMyMjI1MX0.RTB0QJDJnb-17RKgnAPVZXALPvxWvZcRIMW1_evtO98'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

const sellers = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234'
]

const sampleListings = [
  {
    on_chain_listing_id: 1,
    seller: sellers[0],
    card_id: 'swsh8-123',
    card_name: 'Pikachu VMAX',
    card_img: 'https://assets.tcgdex.net/en/swsh/swsh8/123/high.webp',
    tier: 'legendary',
    set_id: 'pokemon',
    price_wei: '50000000000000000000',
    price_usdc: 50.00,
    status: 'active'
  },
  {
    on_chain_listing_id: 2,
    seller: sellers[1],
    card_id: 'ygo-89631139',
    card_name: 'Blue-Eyes White Dragon',
    card_img: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
    tier: 'epic',
    set_id: 'yugioh',
    price_wei: '35500000000000000000',
    price_usdc: 35.50,
    status: 'active'
  },
  {
    on_chain_listing_id: 3,
    seller: sellers[2],
    card_id: 'dbs-bt1-001',
    card_name: 'Son Goku',
    card_img: 'https://www.dbs-cardgame.com/fw/images/cards/card/en/BT1-001_f.webp',
    tier: 'rare',
    set_id: 'dragonball',
    price_wei: '25000000000000000000',
    price_usdc: 25.00,
    status: 'active'
  },
  {
    on_chain_listing_id: 4,
    seller: sellers[3],
    card_id: 'sv02-087',
    card_name: 'Charizard ex',
    card_img: 'https://assets.tcgdex.net/en/sv/sv02/087/high.webp',
    tier: 'legendary',
    set_id: 'pokemon',
    price_wei: '75000000000000000000',
    price_usdc: 75.00,
    status: 'active'
  },
  {
    on_chain_listing_id: 5,
    seller: sellers[4],
    card_id: 'ygo-46986414',
    card_name: 'Dark Magician',
    card_img: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
    tier: 'epic',
    set_id: 'yugioh',
    price_wei: '40000000000000000000',
    price_usdc: 40.00,
    status: 'active'
  }
]

async function seed() {
  console.log('🌱 Seeding marketplace...\n')

  // Step 1: Create profiles for sellers (required by FK constraint)
  console.log('Step 1: Creating seller profiles...')
  const profiles = sellers.map(wallet => ({
    wallet: wallet.toLowerCase(),
    username: `seller_${wallet.slice(2, 8)}`,
    level: 10,
    legendary_count: 5
  }))

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profiles, { onConflict: 'wallet' })

  if (profileError) {
    console.error('❌ Profile error:', profileError.message)
    if (!serviceRoleKey) {
      console.log('\n💡 TIP: Profile insert requires SERVICE_ROLE_KEY due to RLS.')
      console.log('   Add SUPABASE_SERVICE_ROLE_KEY to your .env file.')
      console.log('   Or run this SQL in Supabase dashboard SQL editor:\n')
      console.log(getManualSQL(profiles, sampleListings))
      return
    }
    return
  }
  console.log('✅ Profiles ready\n')

  // Step 2: Insert listings
  console.log('Step 2: Inserting listings...')
  const { data, error } = await supabase
    .from('marketplace')
    .insert(sampleListings)
    .select()

  if (error) {
    console.error('❌ Insert error:', error.message)
    return
  }

  console.log('✅ Successfully added', data?.length || 0, 'listings!')
  console.log('\n🎉 Done! Refresh your marketplace page.')
}

function getManualSQL(profiles, listings) {
  const profileSQL = profiles.map(p => 
    `INSERT INTO profiles (wallet, username, level) VALUES ('${p.wallet}', '${p.username}', ${p.level}) ON CONFLICT (wallet) DO NOTHING;`
  ).join('\n')
  
  const listingSQL = listings.map(l => 
    `INSERT INTO marketplace (on_chain_listing_id, seller, card_id, card_name, card_img, tier, set_id, price_wei, price_usdc, status) VALUES (${l.on_chain_listing_id}, '${l.seller}', '${l.card_id}', '${l.card_name}', '${l.card_img}', '${l.tier}', '${l.set_id}', ${l.price_wei}, ${l.price_usdc}, '${l.status}');`
  ).join('\n')
  
  return profileSQL + '\n\n' + listingSQL
}

seed()