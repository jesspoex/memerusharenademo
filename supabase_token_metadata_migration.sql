-- Migration: token metadata cache table
-- Run once in Supabase Dashboard → SQL Editor

create table if not exists mr_token_metadata (
  address       text        primary key,          -- Solana mint address
  symbol        text        not null,
  name          text        not null,
  logo_url      text        not null,
  pair_address  text,                             -- DexScreener best pair
  dex_id        text,                             -- e.g. 'raydium', 'orca'
  dex_url       text,
  price_usd     numeric     default 0,
  liquidity_usd numeric     default 0,
  volume_24h    numeric     default 0,
  change_24h    numeric     default 0,
  source        text        default 'dexscreener', -- 'dexscreener' | 'manual' | 'fallback'
  updated_at    timestamptz default now()
);

-- RLS
alter table mr_token_metadata enable row level security;

drop policy if exists "public_read" on mr_token_metadata;
create policy "public_read"
  on mr_token_metadata for select to anon using (true);

drop policy if exists "service_write" on mr_token_metadata;
create policy "service_write"
  on mr_token_metadata for all to service_role using (true) with check (true);

-- Index for symbol lookups (battle cards query by symbol)
create index if not exists idx_mr_token_metadata_symbol
  on mr_token_metadata (symbol);
