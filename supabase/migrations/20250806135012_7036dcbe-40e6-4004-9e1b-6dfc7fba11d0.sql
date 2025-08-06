-- Enable Row Level Security on Journal Entries table
-- This is a critical security fix - RLS policies were defined but RLS was not enabled
ALTER TABLE "Journal Entries" ENABLE ROW LEVEL SECURITY;