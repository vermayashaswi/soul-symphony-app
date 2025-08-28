-- Remove the trigger that creates success notifications for journal entries
-- as the user no longer wants these notifications
DROP TRIGGER IF EXISTS notify_journal_entry_saved_trigger ON "Journal Entries";
DROP FUNCTION IF EXISTS notify_journal_entry_saved();