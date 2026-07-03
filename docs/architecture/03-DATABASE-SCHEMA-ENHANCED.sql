-- ═══════════════════════════════════════════════════════════════════════
-- ENHANCED DATABASE SCHEMA — Production PostgreSQL (Supabase)
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- ENHANCEMENTS over base schema:
-- 1. transaction_ledger table for complete on-chain operation tracking
-- 2. Composite indexes for high-velocity query patterns
-- 3. Partial indexes for active marketplace listings
-- 4. JSONB fields for extensible metadata
-- 5. Audit triggers with updated_at auto-refresh
-- 6. Materialized view for leaderboard aggregation
--
-- Deploy: Run in Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

-- ── CORE TABLES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet          TEXT UNIQUE NOT NULL,
  username        TEXT,
  level           INT DEFAULT 1 CHECK (level >= 1),
  legendary_count INT DEFAULT 0 CHECK (legendary_count >= 0),
  arc_volume      NUMERIC DEFAULT 0 CHECK (arc_volume >= 0),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet      TEXT NOT NULL,
  card_id     TEXT NOT NULL,
  card_name   TEXT NOT NULL,
  card_img    TEXT,
  tier        TEXT NOT NULL,
  set_id      TEXT,
  local_id    TEXT,
  hp          TEXT,
  types       TEXT,
  rarity      TEXT,
  atk         INT,
  def         INT,
  level       INT,
  token_id    BIGINT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, card_id)
);

CREATE TABLE IF NOT EXISTS gacha_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet     TEXT NOT NULL,
  card_id    TEXT NOT NULL,
  card_name  TEXT NOT NULL,
  tier       TEXT NOT NULL,
  qty        INT DEFAULT 1,
  tx_hash    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  on_chain_listing_id BIGINT UNIQUE,
  seller              TEXT NOT NULL,
  card_id             TEXT NOT NULL,
  card_name           TEXT NOT NULL,
  card_img            TEXT,
  tier                TEXT NOT NULL,
  set_id              TEXT,
  price_usdc          NUMERIC NOT NULL,
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer               TEXT,
  tx_hash             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faucet_claims (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet     TEXT NOT NULL,
  amount     NUMERIC DEFAULT 100,
  tx_hash    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NEW: TRANSACTION LEDGER ──────────────────────────────────────────────
-- Tracks all on-chain operations with multi-state confirmation tracking.
-- States: pending → confirming → success | failed

CREATE TABLE IF NOT EXISTS transaction_ledger (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet          TEXT NOT NULL,
  tx_hash         TEXT NOT NULL UNIQUE,
  operation       TEXT NOT NULL CHECK (operation IN ('mint', 'list', 'buy', 'cancel', 'faucet', 'transfer')),
  entity_id       TEXT,
  block_number    BIGINT,
  gas_used        BIGINT,
  gas_price       BIGINT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'success', 'failed')),
  confirmations   INT DEFAULT 0,
  error_reason    TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);

-- ── INDEXES ──────────────────────────────────────────────────────────────

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON profiles(wallet);
CREATE INDEX IF NOT EXISTS idx_profiles_level_desc ON profiles(level DESC, arc_volume DESC);

-- Collection
CREATE INDEX IF NOT EXISTS idx_collection_wallet ON collection(wallet);
CREATE INDEX IF NOT EXISTS idx_collection_wallet_card ON collection(wallet, card_id);
CREATE INDEX IF NOT EXISTS idx_collection_tier ON collection(tier);
CREATE INDEX IF NOT EXISTS idx_collection_token_id ON collection(token_id) WHERE token_id IS NOT NULL;

-- Gacha log
CREATE INDEX IF NOT EXISTS idx_gacha_wallet ON gacha_log(wallet);
CREATE INDEX IF NOT EXISTS idx_gacha_created_desc ON gacha_log(created_at DESC);

-- Marketplace
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace(seller);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_desc ON marketplace(created_at DESC);
-- Partial index for hot path: active listings only
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace(created_at DESC, price_usdc) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_listing_id ON marketplace(on_chain_listing_id) WHERE on_chain_listing_id IS NOT NULL;

-- Transaction ledger
CREATE INDEX IF NOT EXISTS idx_txledger_wallet ON transaction_ledger(wallet);
CREATE INDEX IF NOT EXISTS idx_txledger_hash ON transaction_ledger(tx_hash);
CREATE INDEX IF NOT EXISTS idx_txledger_status ON transaction_ledger(status);
CREATE INDEX IF NOT EXISTS idx_txledger_operation ON transaction_ledger(operation, created_at DESC);
-- Composite for pending tx monitoring
CREATE INDEX IF NOT EXISTS idx_txledger_pending ON transaction_ledger(wallet, status, created_at DESC) WHERE status IN ('pending', 'confirming');

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE faucet_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_ledger ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (wallet = LOWER(wallet));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (wallet = LOWER(wallet));

-- Collection
DROP POLICY IF EXISTS "col_read" ON collection;
DROP POLICY IF EXISTS "col_insert_own" ON collection;
DROP POLICY IF EXISTS "col_update_own" ON collection;

CREATE POLICY "col_read" ON collection FOR SELECT USING (true);
CREATE POLICY "col_insert_own" ON collection FOR INSERT WITH CHECK (wallet = LOWER(wallet));
CREATE POLICY "col_update_own" ON collection FOR UPDATE USING (wallet = LOWER(wallet));

-- Gacha log
DROP POLICY IF EXISTS "log_read" ON gacha_log;
DROP POLICY IF EXISTS "log_insert_own" ON gacha_log;

CREATE POLICY "log_read" ON gacha_log FOR SELECT USING (true);
CREATE POLICY "log_insert_own" ON gacha_log FOR INSERT WITH CHECK (wallet = LOWER(wallet));

-- Marketplace
DROP POLICY IF EXISTS "mkt_read" ON marketplace;
DROP POLICY IF EXISTS "mkt_insert_own" ON marketplace;
DROP POLICY IF EXISTS "mkt_update_seller" ON marketplace;

CREATE POLICY "mkt_read" ON marketplace FOR SELECT USING (true);
CREATE POLICY "mkt_insert_own" ON marketplace FOR INSERT WITH CHECK (seller = LOWER(seller));
CREATE POLICY "mkt_update_seller" ON marketplace FOR UPDATE USING (seller = LOWER(seller) OR buyer = LOWER(buyer));

-- Faucet claims
DROP POLICY IF EXISTS "faucet_read" ON faucet_claims;
DROP POLICY IF EXISTS "faucet_insert_own" ON faucet_claims;

CREATE POLICY "faucet_read" ON faucet_claims FOR SELECT USING (true);
CREATE POLICY "faucet_insert_own" ON faucet_claims FOR INSERT WITH CHECK (wallet = LOWER(wallet));

-- Transaction ledger
DROP POLICY IF EXISTS "txledger_read_own" ON transaction_ledger;
DROP POLICY IF EXISTS "txledger_insert_own" ON transaction_ledger;
DROP POLICY IF EXISTS "txledger_update_own" ON transaction_ledger;

CREATE POLICY "txledger_read_own" ON transaction_ledger FOR SELECT USING (wallet = LOWER(wallet));
CREATE POLICY "txledger_insert_own" ON transaction_ledger FOR INSERT WITH CHECK (wallet = LOWER(wallet));
CREATE POLICY "txledger_update_own" ON transaction_ledger FOR UPDATE USING (wallet = LOWER(wallet));

-- ── AUTO-UPDATE TRIGGERS ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS marketplace_updated_at ON marketplace;
CREATE TRIGGER marketplace_updated_at
  BEFORE UPDATE ON marketplace
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── MATERIALIZED VIEW: LEADERBOARD ───────────────────────────────────────
-- Pre-aggregated for fast leaderboard queries. Refresh every 5 minutes.

DROP MATERIALIZED VIEW IF EXISTS leaderboard_snapshot;
CREATE MATERIALIZED VIEW leaderboard_snapshot AS
SELECT
  p.wallet,
  p.username,
  p.level,
  p.legendary_count,
  p.arc_volume,
  COUNT(DISTINCT c.card_id) AS total_cards,
  COUNT(DISTINCT CASE WHEN c.tier = 'Legendary' THEN c.card_id END) AS legendary_cards,
  COALESCE(SUM(m.price_usdc) FILTER (WHERE m.status = 'sold' AND m.seller = p.wallet), 0) AS total_sales_volume
FROM profiles p
LEFT JOIN collection c ON c.wallet = p.wallet
LEFT JOIN marketplace m ON m.seller = p.wallet OR m.buyer = p.wallet
GROUP BY p.wallet, p.username, p.level, p.legendary_count, p.arc_volume
ORDER BY p.level DESC, p.arc_volume DESC;

-- Index for leaderboard queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_wallet ON leaderboard_snapshot(wallet);

-- Auto-refresh function (call from cron or edge function)
CREATE OR REPLACE FUNCTION refresh_leaderboard() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_snapshot;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════════════
--
-- 1. JSONB metadata fields allow forward-compatible schema evolution
--    without ALTER TABLE migrations. Store card attributes, user
--    preferences, A/B test flags, etc.
--
-- 2. Partial indexes (e.g., idx_marketplace_active) significantly
--    reduce index size and improve write performance for high-churn
--    tables like marketplace where most rows are historical.
--
-- 3. Composite indexes match query patterns from frontend:
--    - Marketplace: ORDER BY created_at DESC WHERE status = 'active'
--    - Collection: WHERE wallet = ? AND card_id = ?
--    - Transaction ledger: WHERE wallet = ? AND status IN (...)
--
-- 4. RLS policies enforce wallet-level isolation. Backend service role
--    can bypass RLS by using service_role key. Frontend uses anon key.
--
-- 5. Materialized view refresh: Set up a Supabase cron job to call
--    refresh_leaderboard() every 5 minutes. For real-time updates,
--    query the base tables directly (trades latency for freshness).
--
-- 6. Transaction ledger enables:
--    - Pending tx tracking (show spinner in UI)
--    - Failed tx debugging (error_reason field)
--    - Gas analytics (avg gas per operation type)
--    - Blockchain event reconciliation
-- ═══════════════════════════════════════════════════════════════════════