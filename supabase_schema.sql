-- ============================================================
-- ArcCards Schema — FINAL SECURE VERSION
--
-- ✅ SIMPAN FILE INI — jangan dihapus
--    Dokumentasi schema production yang akurat.
--    Kalau perlu reset/migrate DB dari awal, jalankan file ini.
--
-- ⚠️  CARA PAKAI:
--    Jalankan SEKALI di Supabase SQL Editor.
--    Kalau sudah pernah dijalankan dan muncul error
--    "already exists", itu NORMAL — berarti sudah terpasang.
--    Tidak perlu dijalankan ulang.
--
-- TERAKHIR DIUPDATE: 2026-06-14
-- STATUS: Sudah diterapkan di Supabase production
-- ============================================================

-- ── TABLES ───────────────────────────────────────────────────

create table if not exists profiles (
  id              uuid default gen_random_uuid() primary key,
  wallet          text unique not null,
  username        text,
  level           int default 1 check (level >= 1),
  legendary_count int default 0 check (legendary_count >= 0),
  arc_volume      numeric default 0 check (arc_volume >= 0),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists collection (
  id          uuid default gen_random_uuid() primary key,
  wallet      text not null,
  card_id     text not null,
  card_name   text not null,
  card_img    text,
  tier        text not null,
  set_id      text,
  local_id    text,
  hp          text,
  types       text,
  rarity      text,
  atk         int,
  def         int,
  level       int,
  created_at  timestamptz default now(),
  unique(wallet, card_id)
);

create table if not exists gacha_log (
  id         uuid default gen_random_uuid() primary key,
  wallet     text not null,
  card_id    text not null,
  card_name  text not null,
  tier       text not null,
  qty        int default 1,
  created_at timestamptz default now()
);

create table if not exists marketplace (
  id                  uuid default gen_random_uuid() primary key,
  on_chain_listing_id bigint,
  seller              text not null,
  card_id             text not null,
  card_name           text not null,
  card_img            text,
  tier                text not null,
  set_id              text,
  price_usdc          numeric not null,
  status              text default 'active',
  buyer               text,
  created_at          timestamptz default now()
);

create table if not exists faucet_claims (
  id         uuid default gen_random_uuid() primary key,
  wallet     text not null,
  amount     numeric default 100,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table profiles      enable row level security;
alter table collection    enable row level security;
alter table gacha_log     enable row level security;
alter table marketplace   enable row level security;
alter table faucet_claims enable row level security;

-- Profiles
create policy "read_all"          on profiles for select using (true);
create policy "profiles_insert"   on profiles for insert with check (wallet = lower(wallet));
create policy "profiles_update_own" on profiles for update using (wallet = lower(wallet));

-- Collection
create policy "col_read"          on collection for select using (true);
create policy "col_insert_own"    on collection for insert with check (wallet = lower(wallet));

-- Gacha log
create policy "log_read"          on gacha_log for select using (true);
create policy "log_insert_own"    on gacha_log for insert with check (wallet = lower(wallet));

-- Marketplace
create policy "mkt_read"          on marketplace for select using (true);
create policy "mkt_insert_own"    on marketplace for insert with check (seller = lower(seller));
create policy "mkt_update_own"    on marketplace for update
  using (seller = lower(seller))
  with check (status in ('active', 'sold', 'cancelled'));

-- Faucet — rate limit enforced di DB level via unique index
create policy "faucet_read"       on faucet_claims for select using (true);
create policy "faucet_insert_own" on faucet_claims for insert with check (wallet = lower(wallet));

-- ── CHECK CONSTRAINTS ─────────────────────────────────────────

alter table profiles
  add constraint profiles_username_check
  check (
    username is null or (
      length(username) between 1 and 20
      and username ~ '^[a-zA-Z0-9_\-]+$'
    )
  );

alter table collection
  add constraint collection_tier_check
  check (tier in ('legendary', 'epic', 'rare', 'common'));

alter table gacha_log
  add constraint gacha_log_tier_check
  check (tier in ('legendary', 'epic', 'rare', 'common'));

alter table marketplace
  add constraint marketplace_tier_check
  check (tier in ('legendary', 'epic', 'rare', 'common'));

-- ── INDEXES ───────────────────────────────────────────────────

create index if not exists idx_collection_wallet       on collection(wallet);
create index if not exists idx_gacha_wallet            on gacha_log(wallet);
create index if not exists idx_faucet_wallet_time      on faucet_claims(wallet, created_at desc);
create index if not exists idx_profiles_legendary      on profiles(legendary_count desc);
create index if not exists idx_marketplace_status      on marketplace(status);
create index if not exists idx_marketplace_seller      on marketplace(seller);
create index if not exists idx_marketplace_on_chain_id on marketplace(on_chain_listing_id);
create index if not exists idx_gacha_tier              on gacha_log(tier);

-- Unique index faucet cooldown — butuh function wallet_claim_day
-- Pastikan function sudah dibuat (ada di supabase_security_patch.sql)
-- create unique index if not exists idx_faucet_one_per_day
--   on faucet_claims (lower(wallet), public.wallet_claim_day(created_at));

-- ── TRIGGERS ─────────────────────────────────────────────────

-- Auto-update updated_at pada profiles
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- Auto-lowercase semua wallet address
create or replace function normalize_wallet_trigger()
returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'profiles' then
    new.wallet = lower(new.wallet);
  elsif TG_TABLE_NAME = 'collection' then
    new.wallet = lower(new.wallet);
  elsif TG_TABLE_NAME = 'gacha_log' then
    new.wallet = lower(new.wallet);
  elsif TG_TABLE_NAME = 'marketplace' then
    new.seller = lower(new.seller);
    if new.buyer is not null then
      new.buyer = lower(new.buyer);
    end if;
  elsif TG_TABLE_NAME = 'faucet_claims' then
    new.wallet = lower(new.wallet);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_wallet_profiles   on profiles;
drop trigger if exists trg_normalize_wallet_collection on collection;
drop trigger if exists trg_normalize_wallet_gacha      on gacha_log;
drop trigger if exists trg_normalize_wallet_marketplace on marketplace;
drop trigger if exists trg_normalize_wallet_faucet     on faucet_claims;

create trigger trg_normalize_wallet_profiles
  before insert or update on profiles
  for each row execute function normalize_wallet_trigger();

create trigger trg_normalize_wallet_collection
  before insert or update on collection
  for each row execute function normalize_wallet_trigger();

create trigger trg_normalize_wallet_gacha
  before insert or update on gacha_log
  for each row execute function normalize_wallet_trigger();

create trigger trg_normalize_wallet_marketplace
  before insert or update on marketplace
  for each row execute function normalize_wallet_trigger();

create trigger trg_normalize_wallet_faucet
  before insert or update on faucet_claims
  for each row execute function normalize_wallet_trigger();
