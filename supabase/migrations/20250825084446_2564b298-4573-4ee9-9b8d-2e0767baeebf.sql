-- Set up cron job to run notification scheduler every 15 minutes
SELECT cron.schedule(
  'notification-scheduler',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/notification-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMzk4ODMsImV4cCI6MjA1NzkxNTg4M30.UAB3e5b44iJa9kKT391xyJKoQmlUOtsAi-yp4UEqZrc"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Set up cron job to run notification delivery every 5 minutes
SELECT cron.schedule(
  'notification-delivery',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/notification-delivery',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMzk4ODMsImV4cCI6MjA1NzkxNTg4M30.UAB3e5b44iJa9kKT391xyJKoQmlUOtsAi-yp4UEqZrc"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);