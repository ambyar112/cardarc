-- ============================================================
-- ArcCards Security Patch — FINAL VERSION
--
-- ✅ SIMPAN FILE INI — jangan dihapus
--    Dokumentasi security patch tambahan.
--
-- ⚠️  CARA PAKAI:
--    Jalankan SEKALI setelah supabase_schema.sql.
--    Kalau muncul error "already exists", berarti sudah terpasang.
--
-- TERAKHIR DIUPDATE: 2026-06-14
-- STATUS: Sudah diterapkan di Supabase production
--
-- ── APA YANG ADA DI FILE INI ─────────────────────────────────
--
--  FUNCTION (permanen, jangan dihapus):
--    • wallet_claim_day  — dipakai oleh unique index faucet
--
--  INDEX (permanen, jangan dihapus):
--    • idx_faucet_one_per_day — enforce 1 klaim faucet per wallet per hari
--
--  CLEANUP:
--    • Hapus policy lama yang tidak aman (sudah dijalankan)
--
-- ── YANG SUDAH TERPASANG DI SUPABASE ─────────────────────────
--
--  POLICIES AKTIF:
--    profiles      : read_all, profiles_insert, profiles_update_own
--    collection    : col_read, col_insert_own
--    gacha_log     : log_read, log_insert_own
--    marketplace   : mkt_read, mkt_insert_own, mkt_update_own
--    faucet_claims : faucet_read, faucet_insert_own, faucet_insert_cooldown
--
--  POLICIES DIHAPUS (tidak aman):
--    col_insert, faucet_insert, log_insert, mkt_insert,
--    mkt_update, insert_all, update_all
--
--  CONSTRAINTS AKTIF:
--    profiles_username_check  — username: a-z, 0-9, _, - (max 20 char)
--    collection_tier_check    — tier: legendary/epic/rare/common only
--    gacha_log_tier_check     — tier: legendary/epic/rare/common only
--    marketplace_tier_check   — tier: legendary/epic/rare/common only
--
--  INDEXES AKTIF:
--    idx_faucet_one_per_day   — unique per (wallet, hari) — cooldown faucet
--    idx_faucet_wallet_time   — query performance
--    idx_collection_wallet    — query performance
--    idx_gacha_wallet         — query performance
--    idx_profiles_legendary   — leaderboard sorting
--
--  TRIGGERS AKTIF (semua tabel):
--    trg_normalize_wallet_*   — auto-lowercase semua wallet address
--    trg_profiles_updated_at  — auto-update kolom updated_at
-- ============================================================

-- ── STEP 1: Buat function IMMUTABLE untuk faucet index ───────
-- Function ini PERMANEN — dipakai oleh idx_faucet_one_per_day
-- JANGAN dihapus dari Supabase

create or replace function public.wallet_claim_day(ts timestamptz)
returns text
language sql
immutable strict
as $$
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD')
$$;

-- ── STEP 2: Buat unique index faucet cooldown ─────────────────
-- Enforce maksimal 1 klaim per wallet per hari (UTC)
-- Jika ada duplikat data, hapus dulu sebelum jalankan ini

create unique index if not exists idx_faucet_one_per_day
  on faucet_claims (lower(wallet), public.wallet_claim_day(created_at));

-- ── STEP 3: Hapus policy lama yang tidak aman ─────────────────
-- Policy ini override policy baru yang lebih ketat
-- Sudah dijalankan — dicatat di sini untuk referensi

-- drop policy if exists "col_insert"    on collection;
-- drop policy if exists "faucet_insert" on faucet_claims;
-- drop policy if exists "log_insert"    on gacha_log;
-- drop policy if exists "mkt_insert"    on marketplace;
-- drop policy if exists "mkt_update"    on marketplace;
-- drop policy if exists "insert_all"    on profiles;
-- drop policy if exists "update_all"    on profiles;

-- ── VERIFIKASI — jalankan setelah setup selesai ───────────────

-- Cek semua constraints:
-- select conname, conrelid::regclass as tabel
-- from pg_constraint
-- where contype = 'c'
-- and conrelid in (
--   'profiles'::regclass, 'collection'::regclass,
--   'gacha_log'::regclass, 'marketplace'::regclass
-- )
-- order by tabel, conname;

-- Cek unique index faucet:
-- select indexname, indexdef from pg_indexes
-- where tablename = 'faucet_claims'
-- and indexname = 'idx_faucet_one_per_day';

-- Cek semua policies aktif:
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
