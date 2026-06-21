import { supabase } from './src/lib/supabase.js';

async function testMarketplace() {
  console.log('🔍 Testing Marketplace Listings...\n');
  
  // Test 1: Count active listings
  const { count, error: countError } = await supabase
    .from('marketplace_listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  console.log('Total active listings:', count);
  if (countError) console.error('Count error:', countError);
  
  // Test 2: Get all active listings
  const { data: listings, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  console.log('\n📦 Active Listings:', listings?.length || 0);
  if (error) {
    console.error('❌ Error:', error);
  } else {
    listings?.forEach((listing, i) => {
      console.log(`\n${i+1}. ID: ${listing.id}`);
      console.log(`   Seller: ${listing.seller_address}`);
      console.log(`   Card: ${listing.card_name} (${listing.pack_type})`);
      console.log(`   Price: ${listing.price_eth} ETH`);
      console.log(`   Status: ${listing.status}`);
    });
  }
  
  // Test 3: Get listing counts by pack
  const packs = ['Pokemon Adventures', 'Yugioh GX', 'Dragon Ball Frieza'];
  for (const pack of packs) {
    const { count } = await supabase
      .from('marketplace_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('pack_type', pack);
    console.log(`\n${pack}: ${count || 0} listings`);
  }
}

testMarketplace();