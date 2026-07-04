-- ═══════════════════════════════════════════════════════════════════
-- OPTIONAL MIGRATION: Add nft_token_id column to collection table
-- ═══════════════════════════════════════════════════════════════════
-- 
-- Status: OPTIONAL - Current fix works without this column
-- 
-- Purpose: Track NFT token ID for each collection card
--          Useful for on-chain verification and marketplace integration
-- 
-- When to run: When you want to store NFT token IDs in collection
-- 
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
-- 
-- Note: This is safe to run - uses "IF NOT EXISTS" logic
-- ═══════════════════════════════════════════════════════════════════

-- Add nft_token_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'collection' 
    AND column_name = 'nft_token_id'
  ) THEN
    ALTER TABLE collection 
    ADD COLUMN nft_token_id bigint;
    
    -- Add index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_collection_nft_token_id 
      ON collection(nft_token_id);
    
    RAISE NOTICE 'Column nft_token_id added successfully';
  ELSE
    RAISE NOTICE 'Column nft_token_id already exists';
  END IF;
END $$;

-- Optional: Add comment for documentation
COMMENT ON COLUMN collection.nft_token_id IS 
  'On-chain NFT token ID from ArcCards contract. NULL if not yet minted or tracked.';

-- ═══════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS MIGRATION:
-- ═══════════════════════════════════════════════════════════════════
-- 
-- 1. Update api/collection/add.ts to include nft_token_id:
--    Uncomment this line in collectionData object:
--    nft_token_id: nftTokenId != null ? Number(nftTokenId) : null,
-- 
-- 2. Redeploy to Vercel:
--    vercel deploy --prod
-- 
-- 3. Cards will now store NFT token IDs for marketplace integration
-- 
-- ═══════════════════════════════════════════════════════════════════