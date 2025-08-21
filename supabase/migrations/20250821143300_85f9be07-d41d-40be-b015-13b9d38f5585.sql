-- Remove is_processing column from chat_messages table
ALTER TABLE chat_messages DROP COLUMN IF EXISTS is_processing;

-- Remove any processing-related functions that are no longer needed
DROP FUNCTION IF EXISTS auto_cleanup_processing_messages();
DROP FUNCTION IF EXISTS cleanup_stuck_processing_messages();