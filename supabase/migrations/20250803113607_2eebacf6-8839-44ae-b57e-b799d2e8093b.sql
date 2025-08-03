-- Remove streaming-related columns from chat_threads
ALTER TABLE chat_threads DROP COLUMN IF EXISTS processing_status;
ALTER TABLE chat_threads DROP COLUMN IF EXISTS metadata;

-- Remove streaming-related columns from chat_messages  
ALTER TABLE chat_messages DROP COLUMN IF EXISTS is_processing;