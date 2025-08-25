-- Enable pg_cron extension for scheduling notifications
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to run notification delivery every 5 minutes
SELECT cron.schedule(
  'notification-delivery-scheduler',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/notification-delivery',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMzOTg4MywiZXhwIjoyMDU3OTE1ODgzfQ.jPLJwqPz3AhBIwDPLGv6nIhqLfJpHcE0G5iZCmJNqiQ"}'::jsonb,
        body:='{"scheduled_run": true}'::jsonb
    ) as request_id;
  $$
);

-- Enable realtime for notification_queue table
ALTER TABLE notification_queue REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_queue;