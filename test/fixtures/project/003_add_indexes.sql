-- Migration 003: Add performance indexes

-- Index for FK on posts.user_id
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Extension in correct schema
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
