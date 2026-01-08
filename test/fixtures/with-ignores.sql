-- Test inline disable comments

-- This table intentionally has no PK (it's an audit log)
-- supavisor-disable-next-line no-table-without-pk
CREATE TABLE audit_logs (
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- This will still be flagged (no disable comment)
CREATE TABLE temp_data (
  data JSONB
);

-- Sensitive column is ok here (we know what we're doing)
-- supavisor-disable-next-line no-sensitive-columns
CREATE TABLE encrypted_secrets (
  id UUID PRIMARY KEY,
  api_key TEXT NOT NULL,  -- encrypted
  created_at TIMESTAMPTZ DEFAULT NOW()
);
