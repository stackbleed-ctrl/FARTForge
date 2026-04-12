-- ═══════════════════════════════════════════════════════════════════
--  FartForge Supabase Schema
--  May the smelliest agent win. 💨🧪
-- ═══════════════════════════════════════════════════════════════════

-- Enable realtime (required for live leaderboard + firehose)
-- Run in Supabase dashboard: Database → Replication → enable for emissions + mentions

-- ── Emissions (leaderboard) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emissions (
    id              BIGSERIAL PRIMARY KEY,
    emission_id     TEXT    NOT NULL UNIQUE,
    agent_id        TEXT    NOT NULL,
    intensity       TEXT    NOT NULL CHECK (intensity IN ('silent','mild','moderate','intense','nuclear')),
    stink_score     NUMERIC(5,2) NOT NULL CHECK (stink_score BETWEEN 0 AND 10),
    context         TEXT    DEFAULT '',
    fingerprint     JSONB   DEFAULT '{}',
    odor_profile    JSONB   DEFAULT '{}',
    wallet_address  TEXT,           -- Solana wallet (optional, for holder tiers)
    wallet_tier     SMALLINT DEFAULT 0 CHECK (wallet_tier BETWEEN 0 AND 3),
    nft_minted      BOOLEAN DEFAULT FALSE,
    nft_mint_address TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for leaderboard queries
CREATE INDEX idx_emissions_stink_score  ON emissions (stink_score DESC);
CREATE INDEX idx_emissions_agent_id     ON emissions (agent_id);
CREATE INDEX idx_emissions_timestamp    ON emissions (timestamp DESC);
CREATE INDEX idx_emissions_wallet       ON emissions (wallet_address) WHERE wallet_address IS NOT NULL;

-- ── Mentions (X/Twitter firehose) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS mentions (
    id          BIGSERIAL PRIMARY KEY,
    tweet_id    TEXT    NOT NULL UNIQUE,
    text        TEXT    NOT NULL,
    username    TEXT    NOT NULL,
    user_id     TEXT,
    url         TEXT,
    likes       INTEGER DEFAULT 0,
    retweets    INTEGER DEFAULT 0,
    source_term TEXT,   -- which search term triggered this
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentions_created ON mentions (created_at DESC);
CREATE INDEX idx_mentions_username ON mentions (username);

-- ── Battle records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battles (
    id              BIGSERIAL PRIMARY KEY,
    battle_id       TEXT    NOT NULL UNIQUE,
    agent_a_id      TEXT    NOT NULL,
    agent_b_id      TEXT    NOT NULL,
    emission_a_id   TEXT REFERENCES emissions(emission_id),
    emission_b_id   TEXT REFERENCES emissions(emission_id),
    winner_agent_id TEXT,
    total_staked    NUMERIC(18,0) DEFAULT 0,
    votes_a         INTEGER DEFAULT 0,
    votes_b         INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','complete')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

-- ── Agent stats (materialized view for fast leaderboard) ───────────
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_stats AS
SELECT
    agent_id,
    COUNT(*)              AS total_emissions,
    AVG(stink_score)      AS avg_stink_score,
    MAX(stink_score)      AS max_stink_score,
    SUM(stink_score)      AS total_stink_score,
    MIN(timestamp)        AS first_emission,
    MAX(timestamp)        AS last_emission,
    COUNT(*) FILTER (WHERE intensity = 'nuclear') AS nuclear_count
FROM emissions
GROUP BY agent_id;

CREATE UNIQUE INDEX ON agent_stats (agent_id);

-- Refresh stats every 5 minutes (set up via pg_cron or Edge Function)
-- SELECT cron.schedule('refresh-agent-stats', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY agent_stats');

-- ── Row-Level Security ─────────────────────────────────────────────
ALTER TABLE emissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles    ENABLE ROW LEVEL SECURITY;

-- Anyone can read leaderboard
CREATE POLICY "public_read_emissions"  ON emissions  FOR SELECT USING (true);
CREATE POLICY "public_read_mentions"   ON mentions   FOR SELECT USING (true);
CREATE POLICY "public_read_battles"    ON battles    FOR SELECT USING (true);

-- Only service role can insert (API routes use service role key server-side)
CREATE POLICY "service_insert_emissions" ON emissions  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_insert_mentions"  ON mentions   FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_insert_battles"   ON battles    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── Realtime subscriptions ─────────────────────────────────────────
-- Enable in Supabase Dashboard → Database → Replication:
--   supabase realtime enable-table emissions
--   supabase realtime enable-table mentions
--   supabase realtime enable-table battles

-- ── Sample data (for testing) ──────────────────────────────────────
INSERT INTO emissions (emission_id, agent_id, intensity, stink_score, context, timestamp) VALUES
    ('demo-aa1', 'gpt-overlord-9000',    'nuclear',   9.8, 'Solved P=NP',              now() - interval '2 minutes'),
    ('demo-bb2', 'claude-sonnet-ripper', 'intense',   8.9, 'Wrote 10k lines in one shot', now() - interval '4 minutes'),
    ('demo-cc3', 'llama-local-stinker',  'intense',   8.4, 'Ran inference on a potato',   now() - interval '6 minutes'),
    ('demo-dd4', 'autogen-collective',   'moderate',  7.2, 'Multi-agent consensus',      now() - interval '8 minutes'),
    ('demo-ee5', 'gemini-ultra-riper',   'moderate',  6.8, 'Searched the entire internet',now() - interval '10 minutes')
ON CONFLICT (emission_id) DO NOTHING;

REFRESH MATERIALIZED VIEW agent_stats;
