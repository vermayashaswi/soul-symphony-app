-- Remove the trigger and function that creates success notifications for journal entries
-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS journal_entry_notification_trigger ON "Journal Entries";
DROP FUNCTION IF EXISTS notify_journal_entry_saved();