-- This migration has multiple issues that supalint should catch

-- 1. Table without primary key
CREATE TABLE logs (
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table without RLS (in public schema)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,  -- 3. Sensitive column name
  api_key TEXT,                 -- 3. Another sensitive column
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Foreign key without index
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),  -- No index!
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Extension in public schema (should be in extensions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 6. Security definer function without search_path
CREATE OR REPLACE FUNCTION get_user_posts(uid UUID)
RETURNS SETOF posts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM posts WHERE user_id = uid;
$$;
