ALTER TABLE inquiries ADD COLUMN intent TEXT NOT NULL DEFAULT 'interested' CHECK(intent IN ('interested','ready-to-pay','needs-info'));
ALTER TABLE bookings ADD COLUMN intent TEXT NOT NULL DEFAULT 'interested' CHECK(intent IN ('interested','ready-to-pay','needs-info'));
CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
