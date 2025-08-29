-- Add idempotency_key column to chat_messages table for duplicate prevention
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS idempotency_key TEXT;