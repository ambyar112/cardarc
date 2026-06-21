-- Migration: Rename token_id to nft_token_id in collection table
-- This makes it clearer that it stores the ERC-1155 tokenId from blockchain

-- Rename column
ALTER TABLE collection RENAME COLUMN token_id TO nft_token_id;

-- Add index for faster lookups by tokenId
CREATE INDEX IF NOT EXISTS idx_collection_nft_token_id ON collection(nft_token_id) WHERE nft_token_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN collection.nft_token_id IS 'ERC-1155 tokenId from ArcCards contract. Set during gacha mint via mintCard() or mintCardBatch().';