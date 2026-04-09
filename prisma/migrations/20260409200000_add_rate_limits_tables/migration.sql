-- Rate limiting table (distributed-safe)
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

-- Account lockout table (distributed-safe)
CREATE TABLE IF NOT EXISTS account_lockouts (
  email VARCHAR(255) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

-- Periodic cleanup: delete expired rate limits (older than 1 hour)
-- Run via cron or app-level cleanup
