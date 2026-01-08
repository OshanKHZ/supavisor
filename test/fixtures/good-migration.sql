-- This migration follows all best practices

-- Table with primary key
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Table with FK and index
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the foreign key
CREATE INDEX idx_products_category_id ON products(category_id);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Extension in correct schema
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- Security definer function with search_path
CREATE OR REPLACE FUNCTION get_products_by_category(cat_id UUID)
RETURNS SETOF products
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.products WHERE category_id = cat_id;
$$;
