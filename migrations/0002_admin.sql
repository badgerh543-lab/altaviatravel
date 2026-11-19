CREATE TABLE IF NOT EXISTS admin_users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('developer','owner','admin')),
 password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1,
 totp_secret TEXT, totp_pending TEXT, totp_last_step INTEGER NOT NULL DEFAULT -1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admin_users(id), csrf_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, auth_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_session_user ON admin_sessions(user_id);
CREATE TABLE IF NOT EXISTS admin_recovery (
 user_id TEXT NOT NULL REFERENCES admin_users(id), code_hash TEXT NOT NULL, PRIMARY KEY(user_id,code_hash)
);
CREATE TABLE IF NOT EXISTS admin_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit (
 id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_state (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 1,
 draft TEXT NOT NULL, published TEXT NOT NULL, published_revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL, published_at TEXT, deployed_revision INTEGER NOT NULL DEFAULT 1, publishing_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cms_assets (
 id TEXT NOT NULL, width INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(id,width)
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, tour_slug TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('new','reserved','approved','sold','cancelled')),
 amount_minor INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL CHECK(currency IN ('USD','UZS')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchant_settings (
 provider TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_expiry ON bookings(expires_at);
CREATE INDEX IF NOT EXISTS booking_status_time ON bookings(status,created_at);
CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(created_at);
CREATE INDEX IF NOT EXISTS admin_limit_expiry ON admin_limits(expires_at);
