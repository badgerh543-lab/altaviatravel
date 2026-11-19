CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  fingerprint TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiry_expiry ON inquiries(expires_at);
