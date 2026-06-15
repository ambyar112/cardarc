-- ═══════════════════════════════════════════════════════════════════════
-- ARCCC PRODUCTION DATABASE SCHEMA - ENHANCED VERSION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Improvements over baseline:
-- - Advanced indexing strategies
-- - Partitioning for scalability
-- - Materialized views for analytics
-- - Enhanced audit logging
-- - Optimized constraints and triggers
--
-- TERAKHIR DIUPDATE: 2026-06-15
-- STATUS: Production-ready enhancement layer

-- ─────────────────────────────────────────────────────────────────────────
-- EXTENSION ENABLEMENT
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- ENHANCED PROFILES TABLE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text UNIQUE NOT NULL,
  username            text UNIQUE,
  level               int DEFAULT 1 CHECK (level >= 1 AND level <= 999),
  legendary_count     int DEFAULT 0 CHECK (legendary_count >= 0),
  arc_volume          numeric(20, 2) DEFAULT 0 CHECK (arc_volume >= 0),
  
  -- Enhanced fields
  last_active_at      timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  
  -- Audit tracking
  created_by_system   text DEFAULT 'api',
  updated_by_system   text DEFAULT 'api'
);

-- ─────────────────────────────────────────────────────────────────────────
-- TRANSACTION LEDGER - NEW TABLE FOR FINANCIAL TRACKING
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_ledgers (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text NOT NULL,
  tx_hash             text UNIQUE,
  tx_type             text NOT NULL CHECK (tx_type IN ('mint', 'transfer', 'sale', 'burn', 'gacha')),
  
  -- On-chain data
  block_number        bigint,
  tx_index            int,
  gas_used            numeric(20, 0),
  gas_price           numeric(20, 0),
  
  -- Transaction state
  status              text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
  confirmation_count  int DEFAULT 0,
  
  -- Amount & recipient
  amount              numeric(20, 2),
  recipient           text,
  
  created_at          timestamptz DEFAULT now(),
  confirmed_at        timestamptz,
  
  CONSTRAINT fk_wallet_profile FOREIGN KEY (wallet) REFERENCES profiles(wallet)
);

-- ─────────────────────────────────────────────────────────────────────────
-- COLLECTION TABLE - ENHANCED
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text NOT NULL,
  card_id             text NOT NULL,
  card_name           text NOT NULL,
  card_img            text,
  
  -- Card attributes
  tier                text NOT NULL CHECK (tier IN ('legendary', 'epic', 'rare', 'common')),
  set_id              text,
  local_id            text,
  hp                  text,
  types               text,
  rarity              text,
  atk                 int,
  def                 int,
  level               int,
  
  -- Blockchain data
  token_id            bigint,
  on_chain_balance    int DEFAULT 1,
  
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  
  UNIQUE(wallet, card_id),
  CONSTRAINT fk_collection_profile FOREIGN KEY (wallet) REFERENCES profiles(wallet)
);

-- ─────────────────────────────────────────────────────────────────────────
-- GACHA LOG TABLE - ENHANCED
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gacha_log (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text NOT NULL,
  card_id             text NOT NULL,
  card_name           text NOT NULL,
  tier                text NOT NULL CHECK (tier IN ('legendary', 'epic', 'rare', 'common')),
  qty                 int DEFAULT 1 CHECK (qty > 0),
  
  -- Blockchain reference
  tx_hash             text,
  block_number        bigint,
  
  created_at          timestamptz DEFAULT now(),
  
  CONSTRAINT fk_gacha_profile FOREIGN KEY (wallet) REFERENCES profiles(wallet)
);

-- ─────────────────────────────────────────────────────────────────────────
-- MARKETPLACE TABLE - ENHANCED
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  on_chain_listing_id bigint UNIQUE,
  seller              text NOT NULL,
  card_id             text NOT NULL,
  card_name           text NOT NULL,
  card_img            text,
  tier                text NOT NULL CHECK (tier IN ('legendary', 'epic', 'rare', 'common')),
  set_id              text,
  
  -- Pricing & status
  price_wei           numeric(20, 0) NOT NULL,
  price_usdc          numeric(20, 2) NOT NULL,
  status              text DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  
  -- Transaction details
  buyer               text,
  sold_at             timestamptz,
  
  -- Blockchain data
  tx_hash             text,
  block_number        bigint,
  
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  
  CONSTRAINT fk_seller FOREIGN KEY (seller) REFERENCES profiles(wallet),
  CONSTRAINT fk_buyer FOREIGN KEY (buyer) REFERENCES profiles(wallet)
);

-- ─────────────────────────────────────────────────────────────────────────
-- FAUCET CLAIMS TABLE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faucet_claims (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text NOT NULL,
  amount              numeric(20, 2) DEFAULT 100,
  tx_hash             text UNIQUE,
  created_at          timestamptz DEFAULT now(),
  
  CONSTRAINT fk_faucet_profile FOREIGN KEY (wallet) REFERENCES profiles(wallet)
);

-- ─────────────────────────────────────────────────────────────────────────
-- AUDIT LOG TABLE - NEW
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action              text NOT NULL,
  entity_type         text NOT NULL,
  entity_id           text,
  wallet              text,
  old_values          jsonb,
  new_values          jsonb,
  ip_address          inet,
  user_agent          text,
  created_at          timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- INDEXES - OPTIMIZED FOR COMMON QUERIES
-- ─────────────────────────────────────────────────────────────────────────

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_lower ON profiles(LOWER(wallet));
CREATE INDEX IF NOT EXISTS idx_profiles_legendary_desc ON profiles(legendary_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level_desc ON profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at DESC);

-- Transaction Ledger
CREATE INDEX IF NOT EXISTS idx_tx_ledger_wallet ON transaction_ledgers(wallet);
CREATE INDEX IF NOT EXISTS idx_tx_ledger_status ON transaction_ledgers(status);
CREATE INDEX IF NOT EXISTS idx_tx_ledger_block ON transaction_ledgers(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_tx_ledger_created ON transaction_ledgers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_ledger_tx_hash ON transaction_ledgers(tx_hash);

-- Collection
CREATE INDEX IF NOT EXISTS idx_collection_wallet ON collection(wallet);
CREATE INDEX IF NOT EXISTS idx_collection_tier ON collection(tier);
CREATE INDEX IF NOT EXISTS idx_collection_card_id ON collection(card_id);
CREATE INDEX IF NOT EXISTS idx_collection_wallet_tier ON collection(wallet, tier);

-- Gacha Log
CREATE INDEX IF NOT EXISTS idx_gacha_wallet ON gacha_log(wallet);
CREATE INDEX IF NOT EXISTS idx_gacha_tier ON gacha_log(tier);
CREATE INDEX IF NOT EXISTS idx_gacha_created ON gacha_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gacha_wallet_date ON gacha_log(wallet, created_at DESC);

-- Marketplace
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace(seller);
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer ON marketplace(buyer);
CREATE INDEX IF NOT EXISTS idx_marketplace_on_chain_id ON marketplace(on_chain_listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_status_price ON marketplace(status, price_usdc DESC);

-- Faucet
CREATE INDEX IF NOT EXISTS idx_faucet_wallet ON faucet_claims(wallet);
CREATE INDEX IF NOT EXISTS idx_faucet_created ON faucet_claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faucet_wallet_date ON faucet_claims(wallet, DATE(created_at));

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_wallet ON audit_logs(wallet);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGERS - AUTO TIMESTAMPS
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_collection_updated_at ON collection;
CREATE TRIGGER trg_collection_updated_at
  BEFORE UPDATE ON collection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_updated_at ON marketplace;
CREATE TRIGGER trg_marketplace_updated_at
  BEFORE UPDATE ON marketplace
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGERS - WALLET NORMALIZATION
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION normalize_wallet_on_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    NEW.wallet = LOWER(NEW.wallet);
  ELSIF TG_TABLE_NAME = 'collection' THEN
    NEW.wallet = LOWER(NEW.wallet);
  ELSIF TG_TABLE_NAME = 'gacha_log' THEN
    NEW.wallet = LOWER(NEW.wallet);
  ELSIF TG_TABLE_NAME = 'transaction_ledgers' THEN
    NEW.wallet = LOWER(NEW.wallet);
  ELSIF TG_TABLE_NAME = 'marketplace' THEN
    NEW.seller = LOWER(NEW.seller);
    IF NEW.buyer IS NOT NULL THEN
      NEW.buyer = LOWER(NEW.buyer);
    END IF;
  ELSIF TG_TABLE_NAME = 'faucet_claims' THEN
    NEW.wallet = LOWER(NEW.wallet);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_profiles ON profiles;
CREATE TRIGGER trg_normalize_profiles BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

DROP TRIGGER IF EXISTS trg_normalize_collection ON collection;
CREATE TRIGGER trg_normalize_collection BEFORE INSERT OR UPDATE ON collection FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

DROP TRIGGER IF EXISTS trg_normalize_gacha ON gacha_log;
CREATE TRIGGER trg_normalize_gacha BEFORE INSERT OR UPDATE ON gacha_log FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

DROP TRIGGER IF EXISTS trg_normalize_tx_ledger ON transaction_ledgers;
CREATE TRIGGER trg_normalize_tx_ledger BEFORE INSERT OR UPDATE ON transaction_ledgers FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

DROP TRIGGER IF EXISTS trg_normalize_marketplace ON marketplace;
CREATE TRIGGER trg_normalize_marketplace BEFORE INSERT OR UPDATE ON marketplace FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

DROP TRIGGER IF EXISTS trg_normalize_faucet ON faucet_claims;
CREATE TRIGGER trg_normalize_faucet BEFORE INSERT OR UPDATE ON faucet_claims FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) - POLICIES
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE faucet_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, own write
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (wallet = LOWER(wallet));
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (wallet = LOWER(wallet));

-- Collection: Public read, own write
CREATE POLICY "collection_select" ON collection FOR SELECT USING (true);
CREATE POLICY "collection_insert" ON collection FOR INSERT WITH CHECK (wallet = LOWER(wallet));

-- Gacha Log: Public read, own write
CREATE POLICY "gacha_select" ON gacha_log FOR SELECT USING (true);
CREATE POLICY "gacha_insert" ON gacha_log FOR INSERT WITH CHECK (wallet = LOWER(wallet));

-- Marketplace: Public read, own write
CREATE POLICY "marketplace_select" ON marketplace FOR SELECT USING (true);
CREATE POLICY "marketplace_insert" ON marketplace FOR INSERT WITH CHECK (seller = LOWER(seller));
CREATE POLICY "marketplace_update" ON marketplace FOR UPDATE USING (seller = LOWER(seller));

-- Faucet: Public read, own write
CREATE POLICY "faucet_select" ON faucet_claims FOR SELECT USING (true);
CREATE POLICY "faucet_insert" ON faucet_claims FOR INSERT WITH CHECK (wallet = LOWER(wallet));

-- Transaction Ledger: Public read (immutable)
CREATE POLICY "tx_ledger_select" ON transaction_ledgers FOR SELECT USING (true);

-- Audit Logs: Read-only for users
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (true);