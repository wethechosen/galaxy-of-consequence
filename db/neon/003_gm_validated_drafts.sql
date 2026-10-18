-- GOC validated GM draft checkpoints. Apply before enabling hosted draft reuse.
-- Does NOT modify player saves, campaign revisions, or credentials.
CREATE TABLE IF NOT EXISTS private.goc_gm_validated_drafts (
  account_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  base_revision BIGINT NOT NULL CHECK (base_revision >= 0),
  action_digest TEXT NOT NULL,
  draft JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, turn_id)
);
CREATE INDEX IF NOT EXISTS goc_gm_validated_drafts_created_idx
  ON private.goc_gm_validated_drafts (created_at);
-- Retain pending checkpoints for recovery; purge only with a separately
-- reviewed policy and never as part of a gameplay turn.
