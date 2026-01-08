-- Migration 002: Enable RLS on tables

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view all posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
