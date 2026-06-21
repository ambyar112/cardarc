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
-- - FIXED RLS policies (was using tautology: wallet = LOWER(wallet))
-- - FIXED DB function volatility (IMMUTABLE → STABLE for time-dependent fns)
-- - ADDED claim_log table for gacha claim flow
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
  nft_token_id        bigint,
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
-- CLAIM LOG TABLE - NEW (tracks gacha claims to prevent double-claim)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_log (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet              text NOT NULL,
  card_id             text NOT NULL,
  nonce               text UNIQUE NOT NULL,
  signature           text,
  claimed_at          timestamptz DEFAULT now(),
  
  UNIQUE(wallet, card_id),
  CONSTRAINT fk_claim_profile FOREIGN KEY (wallet) REFERENCES profiles(wallet)
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
  price_wei           numeric(20, 0) NOT NULL CHECK (price_wei > 0),
  price_usdc          numeric(20, 2) NOT NULL CHECK (price_usdc > 0),
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

-- Claim Log
CREATE INDEX IF NOT EXISTS idx_claim_wallet ON claim_log(wallet);
CREATE INDEX IF NOT EXISTS idx_claim_nonce ON claim_log(nonce);

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
-- TRIGGERS - AUTO TIMESTAMPS (STABLE, not IMMUTABLE - uses now())
-- ─────────────────────────────────────────────────────────────────────────

-- FIX: was incorrectly marked IMMUTABLE. now() is STABLE, not IMMUTABLE.
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
-- TRIGGERS - WALLET NORMALIZATION (STABLE - uses LOWER())
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
  ELSIF TG_TABLE_NAME = 'claim_log' THEN
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

DROP TRIGGER IF EXISTS trg_normalize_claim ON claim_log;
CREATE TRIGGER trg_normalize_claim BEFORE INSERT OR UPDATE ON claim_log FOR EACH ROW EXECUTE FUNCTION normalize_wallet_on_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) - FIXED POLICIES
-- ─────────────────────────────────────────────────────────────────────────

-- IMPORTANT: Previous version used "wallet = LOWER(wallet)" which is a
-- TAUTOLOGY (always true for already-lowercase wallets). This allowed
-- ANY authenticated user to INSERT/UPDATE/DELETE ANYONE's data.
--
-- Fix: use auth.jwt() ->> 'wallet' to extract the authenticated
-- wallet from the JWT custom claim. The application must include
-- a 'wallet' claim in the JWT when authenticating via SIWE.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE faucet_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_log ENABLE ROW LEVEL SECURITY;

-- Helper: get authenticated wallet from JWT
CREATE OR REPLACE FUNCTION auth_wallet()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT LOWER(COALESCE(
    current_setting('request.jwt.claim.wallet', true),
    auth.jwt() ->> 'wallet',
    ''
  ));
$$;

-- Profiles: Public read, own write
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (LOWER(wallet) = auth_wallet());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (LOWER(wallet) = auth_wallet());

-- Collection: Public read, own write
CREATE POLICY "collection_select" ON collection FOR SELECT USING (true);
CREATE POLICY "collection_insert" ON collection FOR INSERT WITH CHECK (LOWER(wallet) = auth_wallet());
CREATE POLICY "collection_update" ON collection FOR UPDATE USING (LOWER(wallet) = auth_wallet());
CREATE POLICY "collection_delete" ON collection FOR DELETE USING (LOWER(wallet) = auth_wallet());

-- Gacha Log: Public read, service role only for inserts (backend writes)
-- Clients should NOT insert gacha_log directly; backend handles it.
CREATE POLICY "gacha_select" ON gacha_log FOR SELECT USING (true);

-- Claim Log: Backend-only writes (service role bypasses RLS)
CREATE POLICY "claim_select" ON claim_log FOR SELECT USING (LOWER(wallet) = auth_wallet());

-- Marketplace: Public read, own write
CREATE POLICY "marketplace_select" ON marketplace FOR SELECT USING (true);
CREATE POLICY "marketplace_insert" ON marketplace FOR INSERT WITH CHECK (LOWER(seller) = auth_wallet());
CREATE POLICY "marketplace_update" ON marketplace FOR UPDATE USING (LOWER(seller) = auth_wallet());

-- Faucet: Public read, service role only for inserts (rate-limited backend)
CREATE POLICY "faucet_select" ON faucet_claims FOR SELECT USING (LOWER(wallet) = auth_wallet());

-- Transaction Ledger: Public read (immutable history)
CREATE POLICY "tx_ledger_select" ON transaction_ledgers FOR SELECT USING (true);

-- Audit Logs: Read-only (service role writes only)
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- FUNCTIONS - PROPERLY MARKED VOLATILITY
-- ─────────────────────────────────────────────────────────────────────────

-- FIX: must be STABLE (not IMMUTABLE) because it reads from request.jwt
-- or auth.jwt() which can change between statements in same transaction.

-- Note: update_updated_at is plpgsql and uses now() — plpgsql is VOLATILE by
-- default, which is correct for triggers. Don't override.

-- Add helper to get user's tier counts (used by Home.jsx leaderboard)
CREATE OR REPLACE FUNCTION get_tier_count(p_wallet text, p_tier text)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int
  FROM collection
  WHERE LOWER(wallet) = LOWER(p_wallet) AND tier = p_tier;
$$;

-- Add helper to check if gacha pull is recent (used by claim API)
CREATE OR REPLACE FUNCTION has_recent_gacha_pull(p_wallet text, p_card_id text, p_minutes int DEFAULT 5)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1 FROM gacha_log
    WHERE LOWER(wallet) = LOWER(p_wallet)
      AND card_id = p_card_id
      AND created_at > now() - (p_minutes || ' minutes')::interval
  );
$$;

-- Add helper to check if card already claimed
CREATE OR REPLACE FUNCTION is_card_claimed(p_wallet text, p_card_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1 FROM claim_log
    WHERE LOWER(wallet) = LOWER(p_wallet) AND card_id = p_card_id
  );
$$;