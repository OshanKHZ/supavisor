-- Complex migration with multiple issues for testing all rules

-- 1. Table without PK (no-table-without-pk)
CREATE TABLE audit_logs (
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table with RLS but policy has USING (true) for DELETE (rls-policy-always-true)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can delete" ON posts FOR DELETE USING (true);

-- 3. Policy exists but RLS not enabled (policy-exists-rls-disabled)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id),
  content TEXT NOT NULL
);
CREATE POLICY "select comments" ON comments FOR SELECT USING (true);
-- Missing: ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. RLS enabled but no policy (rls-enabled-no-policy)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- Missing: CREATE POLICY ... ON categories

-- 5. Multiple permissive policies for same role/action (multiple-permissive-policies)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select products 1" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "select products 2" ON products FOR SELECT TO authenticated USING (true);

-- 6. Duplicate indexes (duplicate-index)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total NUMERIC(10, 2)
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_user_id_duplicate ON orders(user_id);

-- 7. RLS policy references user_metadata (rls-references-user-metadata)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own profile" ON profiles
  FOR SELECT USING (
    user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')::uuid
  );

-- 8. View exposing auth.users (auth-users-exposed)
CREATE VIEW public.user_emails AS
  SELECT id, email FROM auth.users;

-- 9. Materialized view in public schema (ban-materialized-view-public)
CREATE MATERIALIZED VIEW public.user_stats AS
  SELECT user_id, COUNT(*) as post_count FROM posts GROUP BY user_id;

-- 10. Extension in public schema (no-extension-in-public)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 11. Security definer function without search_path (function-search-path)
CREATE OR REPLACE FUNCTION get_user_posts(uid UUID)
RETURNS SETOF posts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM posts WHERE user_id = uid;
$$;
