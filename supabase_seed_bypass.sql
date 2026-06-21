-- ═══════════════════════════════════════════════════════════════════════
-- TEMPORARY SEED BYPASS FOR DEMO DATA (FIXED VERSION)
-- ═══════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor, then call the seed API endpoint.

-- Function: seed_profiles (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION seed_profiles(profiles_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_count int := 0;
BEGIN
  INSERT INTO profiles (wallet, username, level, legendary_count)
  SELECT 
    LOWER((item->>'wallet')::text),
    (item->>'username')::text,
    (item->>'level')::int,
    (item->>'legendary_count')::int
  FROM jsonb_array_elements(profiles_data) AS item
  ON CONFLICT (wallet) 
  DO UPDATE SET
    username = EXCLUDED.username,
    level = EXCLUDED.level,
    legendary_count = EXCLUDED.legendary_count,
    updated_at = now();
  
  GET DIAGNOSTICS result_count = ROW_COUNT;
  
  RETURN jsonb_build_object('profiles_created', result_count);
END;
$$;

-- Function: seed_marketplace (FIXED - no price_wei column)
CREATE OR REPLACE FUNCTION seed_marketplace(listings_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_count int := 0;
BEGIN
  DELETE FROM marketplace WHERE id != '00000000-0000-0000-0000-000000000000'::uuid;
  
  INSERT INTO marketplace (
    on_chain_listing_id, seller, card_id, card_name, card_img,
    tier, set_id, price_usdc, status
  )
  SELECT 
    (item->>'on_chain_listing_id')::bigint,
    LOWER((item->>'seller')::text),
    (item->>'card_id')::text,
    (item->>'card_name')::text,
    (item->>'card_img')::text,
    (item->>'tier')::text,
    (item->>'set_id')::text,
    (item->>'price_usdc')::numeric,
    COALESCE((item->>'status')::text, 'active')
  FROM jsonb_array_elements(listings_data) AS item;
  
  GET DIAGNOSTICS result_count = ROW_COUNT;
  
  RETURN jsonb_build_object('listings_created', result_count);
END;
$$;

GRANT EXECUTE ON FUNCTION seed_profiles(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION seed_marketplace(jsonb) TO anon;