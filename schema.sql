-- FartForge Supabase Schema v2 — FOC edition
-- Run this against your Supabase project SQL editor
-- Changes from v1: added arweave_url, nft_mint_address, source to emissions
--                 added foc_receipts table
--                 added mentions table (unchanged)

-- ── Emissions ──────────────────────────────────────────────────────────────
create table if not exists emissions (
  id              uuid primary key default gen_random_uuid(),
  emission_id     text unique not null,
  agent_id        text not null,
  source          text not null default 'agent',  -- 'agent' | 'human'
  intensity       text,                            -- null for human recordings
  stink_score     numeric(4,2) not null,
  context         text,
  archetype       text,
  odor_profile    jsonb,
  fingerprint     jsonb,
  sound_profile   jsonb,                           -- human DSP data
  arweave_url     text,                            -- FOC: permanent audio URL on Arweave
  metadata_url    text,                            -- FOC: NFT metadata URL on Arweave
  nft_mint_address text,                           -- FOC: Solana cNFT mint address after signing
  wallet_address  text,                            -- owner's Solana wallet
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists emissions_stink_score_idx on emissions (stink_score desc);
create index if not exists emissions_agent_id_idx    on emissions (agent_id);
create index if not exists emissions_source_idx      on emissions (source);
create index if not exists emissions_created_at_idx  on emissions (created_at desc);

-- ── FOC Receipts ───────────────────────────────────────────────────────────
-- Separate table for confirmed on-chain mints (after wallet signs + confirms)
create table if not exists foc_receipts (
  id               uuid primary key default gen_random_uuid(),
  emission_id      text not null references emissions(emission_id),
  wallet_address   text not null,
  nft_mint_address text not null,
  audio_arweave_url text not null,
  metadata_arweave_url text not null,
  tx_signature     text not null,               -- Solana tx sig
  stink_score      numeric(4,2),
  archetype        text,
  minted_at        timestamptz not null default now()
);

create index if not exists foc_receipts_wallet_idx    on foc_receipts (wallet_address);
create index if not exists foc_receipts_emission_idx  on foc_receipts (emission_id);
create index if not exists foc_receipts_minted_at_idx on foc_receipts (minted_at desc);

-- ── Mentions (firehose — unchanged from v1) ────────────────────────────────
create table if not exists mentions (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  username   text,
  url        text,
  created_at timestamptz not null default now()
);

-- ── RLS Policies ───────────────────────────────────────────────────────────
alter table emissions    enable row level security;
alter table foc_receipts enable row level security;
alter table mentions     enable row level security;

-- Public read for leaderboard
create policy "emissions_public_read"    on emissions    for select using (true);
create policy "foc_receipts_public_read" on foc_receipts for select using (true);
create policy "mentions_public_read"     on mentions     for select using (true);

-- Insert open (server-side inserts via service role bypass RLS anyway)
create policy "emissions_insert"    on emissions    for insert with check (true);
create policy "foc_receipts_insert" on foc_receipts for insert with check (true);
create policy "mentions_insert"     on mentions     for insert with check (true);
