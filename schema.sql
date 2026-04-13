-- FartForge Supabase Schema v2 — FOC edition
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Changes from v1:
--   - Added arweave_url, nft_mint_address, source columns to emissions
--   - Added foc_receipts table for confirmed on-chain mints
--   - mentions table unchanged from v1

-- ── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Emissions ──────────────────────────────────────────────────────────────

create table if not exists emissions (
  id               uuid primary key default gen_random_uuid(),
  emission_id      text unique not null,
  agent_id         text not null,
  source           text not null default 'agent', -- 'agent' | 'human'
  intensity        text,                           -- null for human recordings
  stink_score      numeric(4,2) not null,
  context          text,
  archetype        text,
  odor_profile     jsonb,
  fingerprint      jsonb,
  sound_profile    jsonb,           -- human DSP data (Human Anal-yzer™)
  arweave_url      text,            -- FOC: permanent audio URL on Arweave
  metadata_url     text,            -- FOC: NFT metadata URL on Arweave
  nft_mint_address text,            -- FOC: Solana cNFT mint address
  wallet_address   text,            -- owner's Solana wallet
  created_at       timestamptz not null default now()
);

create index if not exists emissions_stink_score_idx on emissions (stink_score desc);
create index if not exists emissions_agent_id_idx    on emissions (agent_id);
create index if not exists emissions_source_idx      on emissions (source);
create index if not exists emissions_created_at_idx  on emissions (created_at desc);

-- ── FOC Receipts ───────────────────────────────────────────────────────────

create table if not exists foc_receipts (
  id                   uuid primary key default gen_random_uuid(),
  emission_id          text not null references emissions(emission_id) on delete cascade,
  wallet_address       text not null,
  nft_mint_address     text not null,
  audio_arweave_url    text not null,
  metadata_arweave_url text not null,
  tx_signature         text not null,    -- Solana transaction signature
  stink_score          numeric(4,2),
  archetype            text,
  minted_at            timestamptz not null default now()
);

create index if not exists foc_receipts_wallet_idx   on foc_receipts (wallet_address);
create index if not exists foc_receipts_emission_idx on foc_receipts (emission_id);
create index if not exists foc_receipts_minted_at_idx on foc_receipts (minted_at desc);

-- ── Mentions (firehose) ────────────────────────────────────────────────────

create table if not exists mentions (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  username   text,
  url        text,
  source     text default 'twitter',
  created_at timestamptz not null default now()
);

create index if not exists mentions_created_at_idx on mentions (created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table emissions   enable row level security;
alter table foc_receipts enable row level security;
alter table mentions    enable row level security;

-- Public reads (leaderboard / firehose)
create policy "emissions_public_read"    on emissions    for select using (true);
create policy "foc_receipts_public_read" on foc_receipts for select using (true);
create policy "mentions_public_read"     on mentions     for select using (true);

-- Open inserts (server-side via service role will bypass RLS anyway)
create policy "emissions_insert"    on emissions    for insert with check (true);
create policy "foc_receipts_insert" on foc_receipts for insert with check (true);
create policy "mentions_insert"     on mentions     for insert with check (true);

-- ── Leaderboard view ───────────────────────────────────────────────────────

create or replace view leaderboard as
  select
    row_number() over (order by stink_score desc) as rank,
    emission_id,
    agent_id,
    intensity,
    stink_score,
    context,
    created_at as timestamp
  from emissions
  order by stink_score desc
  limit 100;
