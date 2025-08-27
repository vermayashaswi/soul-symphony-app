-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job that runs every minute to check for journal reminders
SELECT cron.schedule(
  'journal-reminder-scheduler',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/schedule-journal-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMzk4ODMsImV4cCI6MjA1NzkxNTg4M30.UAB3e5b44iJa9kKT391xyJKoQmlUOtsAi-yp4UEqZrc"}'::jsonb,
        body:='{"triggered_by": "cron", "timestamp": "'||now()||'"}'::jsonb
    ) as request_id;
  $$
);