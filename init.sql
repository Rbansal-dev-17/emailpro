-- =============================================================================
-- EmailPro — Database Initialisation Script
-- =============================================================================
-- HOW TO USE:
--   1. Open pgAdmin and connect to your PostgreSQL server
--   2. Create a database called "email_platform" (right-click Databases → Create)
--   3. Open the Query Tool for that database (Tools → Query Tool)
--   4. Paste this entire file and click Run (F5)
--
-- SAFE TO RE-RUN: Every statement uses IF NOT EXISTS or ALTER … IF NOT EXISTS,
-- so running this on an existing database will only add missing tables/columns
-- without touching any existing data.
--
-- WHEN SCHEMA CHANGES: Replace this file with the latest version from the repo
-- and re-run it in pgAdmin on every device that needs the update.
--
-- Last updated: 2026-04-26
-- Schema version: 6
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. inbox_configs
--    Stores connected Gmail accounts used for sending campaigns.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox_configs (
    id            SERIAL       PRIMARY KEY,
    inbox_name    VARCHAR(255) NOT NULL,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    app_password  VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 2. campaigns
--    One row per campaign. email_templates holds the full template+variation+
--    followup definition as a JSON array.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
    id              SERIAL       PRIMARY KEY,
    campaign_name   VARCHAR(255) NOT NULL,
    inbox_id        INTEGER      NOT NULL REFERENCES inbox_configs(id),

    -- Legacy single-template columns (kept for backwards compatibility)
    email_subject   VARCHAR(255),
    email_body      TEXT,

    -- Full template structure stored as JSON:
    -- [
    --   {
    --     "variations": [{"subject": "...", "body": "..."}, ...],
    --     "followups":  [{"send_after_days": 3, "variations": [{"body": "..."}]}]
    --   }
    -- ]
    email_templates JSONB,

    total_leads     INTEGER   NOT NULL DEFAULT 0,
    sent_count      INTEGER   NOT NULL DEFAULT 0,
    opened_count    INTEGER   NOT NULL DEFAULT 0,
    replied_count   INTEGER   NOT NULL DEFAULT 0,

    -- draft | sending | completed
    status          VARCHAR(50) NOT NULL DEFAULT 'draft',

    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_inbox_id ON campaigns(inbox_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status   ON campaigns(status);


-- -----------------------------------------------------------------------------
-- 3. leads
--    One row per lead per campaign (uploaded from CSV).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id              SERIAL       PRIMARY KEY,
    campaign_id     INTEGER      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    first_name      VARCHAR(255) NOT NULL,
    last_name       VARCHAR(255) NOT NULL,
    company         VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    job_title       VARCHAR(255),
    custom_field_1  VARCHAR(255),
    custom_field_2  VARCHAR(255),
    custom_field_3  VARCHAR(255),
    is_valid        BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);


-- -----------------------------------------------------------------------------
-- 4. emails
--    One row per email sent to a lead. Tracks open/bounce/thread state.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emails (
    id               SERIAL       PRIMARY KEY,
    campaign_id      INTEGER      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id          INTEGER      NOT NULL REFERENCES leads(id)     ON DELETE CASCADE,
    recipient_email  VARCHAR(255) NOT NULL,
    subject          VARCHAR(255) NOT NULL,
    body             TEXT         NOT NULL,
    tracking_id      VARCHAR(255) NOT NULL UNIQUE,

    -- Gmail Message-ID header — stored so follow-ups can reply in the same thread
    message_id       VARCHAR(512),

    -- Which template (always 0 — single template) and variation (0-based) was used
    template_index   INTEGER DEFAULT 0,
    variation_index  INTEGER DEFAULT 0,

    -- Delivery state
    -- pending | sent | failed
    status           VARCHAR(50) NOT NULL DEFAULT 'pending',
    sent_at          TIMESTAMP,

    -- Open tracking (pixel)
    is_opened        BOOLEAN   NOT NULL DEFAULT FALSE,
    opened_at        TIMESTAMP,
    open_count       INTEGER   NOT NULL DEFAULT 0,

    -- Bounce tracking
    -- bounce_type: 'hard' (5xx / invalid address) | 'soft' (4xx / mailbox full)
    is_bounced       BOOLEAN   NOT NULL DEFAULT FALSE,
    bounce_type      VARCHAR(20),          -- 'hard' | 'soft' | NULL
    bounced_at       TIMESTAMP,

    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_campaign_id    ON emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_emails_lead_id        ON emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_tracking_id    ON emails(tracking_id);
CREATE INDEX IF NOT EXISTS idx_emails_status         ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_recipient      ON emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_emails_is_bounced     ON emails(is_bounced);


-- -----------------------------------------------------------------------------
-- 5. open_tracking
--    Each pixel-load event is recorded here (one email can have multiple opens).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS open_tracking (
    id          SERIAL       PRIMARY KEY,
    email_id    INTEGER      NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    opened_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    user_agent  VARCHAR(500),
    ip_address  VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_open_tracking_email_id ON open_tracking(email_id);


-- -----------------------------------------------------------------------------
-- 6. replies
--    Replies detected in Gmail inbox via IMAP (FROM lead address, Re: subject).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS replies (
    id                SERIAL       PRIMARY KEY,
    email_id          INTEGER      NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    from_email        VARCHAR(255) NOT NULL,
    reply_subject     VARCHAR(255),
    reply_body        TEXT,
    reply_timestamp   TIMESTAMP    NOT NULL,
    is_from_recipient BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_email_id   ON replies(email_id);
CREATE INDEX IF NOT EXISTS idx_replies_from_email ON replies(from_email);


-- -----------------------------------------------------------------------------
-- 7. followups
--    One row per scheduled follow-up attached to a campaign.
--    status: waiting → scheduled → sending → completed | failed
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS followups (
    id                    SERIAL   PRIMARY KEY,
    campaign_id           INTEGER  NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Which template index this targets (always 0 for single-template campaigns)
    target_template_index INTEGER,

    send_after_days       INTEGER  NOT NULL,

    -- Computed when campaign completes: campaign.completed_at + send_after_days
    scheduled_send_at     TIMESTAMP,

    -- waiting | scheduled | sending | completed | failed
    status                VARCHAR(50) NOT NULL DEFAULT 'waiting',
    sent_count            INTEGER     NOT NULL DEFAULT 0,
    created_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
    completed_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_followups_campaign_id       ON followups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_followups_status            ON followups(status);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled_send_at ON followups(scheduled_send_at);


-- -----------------------------------------------------------------------------
-- 8. followup_variations
--    Body variations for a follow-up (subject is always auto Re: <original>).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS followup_variations (
    id              SERIAL   PRIMARY KEY,
    followup_id     INTEGER  NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
    variation_index INTEGER  NOT NULL DEFAULT 0,
    subject         VARCHAR(255),   -- stored for reference, always "Re: <original>"
    body            TEXT     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followup_variations_followup_id ON followup_variations(followup_id);


-- -----------------------------------------------------------------------------
-- 9. followup_emails
--    One row per lead per follow-up. Created when a follow-up is due to fire.
--    status: pending | sent | failed | skipped
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS followup_emails (
    id                       SERIAL       PRIMARY KEY,
    followup_id              INTEGER      NOT NULL REFERENCES followups(id)  ON DELETE CASCADE,
    original_email_id        INTEGER      NOT NULL REFERENCES emails(id)     ON DELETE CASCADE,
    recipient_email          VARCHAR(255) NOT NULL,
    followup_variation_index INTEGER      DEFAULT 0,
    subject                  VARCHAR(255) NOT NULL,
    body                     TEXT         NOT NULL,
    -- pending | sent | failed | skipped
    status                   VARCHAR(50)  NOT NULL DEFAULT 'pending',
    sent_at                  TIMESTAMP,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_emails_followup_id        ON followup_emails(followup_id);
CREATE INDEX IF NOT EXISTS idx_followup_emails_original_email_id  ON followup_emails(original_email_id);
CREATE INDEX IF NOT EXISTS idx_followup_emails_status             ON followup_emails(status);


-- -----------------------------------------------------------------------------
-- 10. daily_limits
--     Tracks how many emails have been sent per inbox per calendar day.
--     Hard cap: 20 emails per day per inbox.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_limits (
    id          SERIAL   PRIMARY KEY,
    date        DATE     NOT NULL,
    inbox_id    INTEGER  REFERENCES inbox_configs(id),
    emails_sent INTEGER  NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (date, inbox_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_limits_date     ON daily_limits(date);
CREATE INDEX IF NOT EXISTS idx_daily_limits_inbox_id ON daily_limits(inbox_id);


-- -----------------------------------------------------------------------------
-- 11. weekly_limits
--     Tracks how many emails have been sent per inbox per ISO week.
--     Soft cap: 100 emails per week per inbox.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_limits (
    id          SERIAL   PRIMARY KEY,
    week_start  DATE     NOT NULL,   -- Monday of the ISO week
    inbox_id    INTEGER  REFERENCES inbox_configs(id),
    emails_sent INTEGER  NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (week_start, inbox_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_limits_week_start ON weekly_limits(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_limits_inbox_id   ON weekly_limits(inbox_id);


-- =============================================================================
-- SAFE COLUMN ADDITIONS (idempotent — run these even on existing databases)
-- These handle cases where the database was created before certain columns
-- were added. Running them on a fresh database is harmless.
-- =============================================================================

-- emails: bounce tracking (added in schema v4)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_bounced   BOOLEAN   DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounce_type  VARCHAR(20);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounced_at   TIMESTAMP;

-- emails: thread + variation tracking (added in schema v3)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS message_id      VARCHAR(512);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS template_index  INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS variation_index INTEGER DEFAULT 0;

-- campaigns: email_templates JSON (added in schema v2)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_templates JSONB;

-- followup_emails: skipped status support (added in schema v5)
-- (status column already supports 'skipped' as a varchar — no migration needed)

-- daily_limits: unique constraint guard (in case old table lacked it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_limits_date_inbox_id_key'
    ) THEN
        ALTER TABLE daily_limits ADD CONSTRAINT daily_limits_date_inbox_id_key
            UNIQUE (date, inbox_id);
    END IF;
END $$;

-- weekly_limits: unique constraint guard
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'weekly_limits_week_start_inbox_id_key'
    ) THEN
        ALTER TABLE weekly_limits ADD CONSTRAINT weekly_limits_week_start_inbox_id_key
            UNIQUE (week_start, inbox_id);
    END IF;
END $$;


-- =============================================================================
-- VERIFICATION QUERY
-- Run this after the script to confirm all 11 tables were created:
-- =============================================================================
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
--
-- Expected output (11 rows):
--   campaigns
--   daily_limits
--   emails
--   followup_emails
--   followup_variations
--   followups
--   inbox_configs
--   leads
--   open_tracking
--   replies
--   weekly_limits
-- =============================================================================