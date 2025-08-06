-- Enable Row Level Security on the journal_embeddings table
-- This will enforce the existing RLS policies that are already defined
ALTER TABLE journal_embeddings ENABLE ROW LEVEL SECURITY;