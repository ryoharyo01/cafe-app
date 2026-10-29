-- ============================================
-- ERROR LOGS — catatan error server & browser
-- ============================================
-- Diisi oleh src/lib/logger.ts (server) dan /api/log (browser), dibaca di
-- tab "Error Log" halaman admin. Hanya service role yang boleh akses
-- (RLS aktif tanpa policy), jadi anon key di browser tidak bisa baca/tulis.
-- ============================================

CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warn')),
  source TEXT NOT NULL CHECK (source IN ('server', 'client')),
  context TEXT NOT NULL,          -- mis. 'ai.chat', 'payment.create', 'window.onerror'
  message TEXT NOT NULL,
  stack TEXT,
  meta JSONB,
  url TEXT,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs (created_at DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
