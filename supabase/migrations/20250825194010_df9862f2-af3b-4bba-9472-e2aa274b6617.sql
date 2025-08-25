-- Remove the cron job that was causing Capacitor initialization issues
SELECT cron.unschedule('notification-delivery-scheduler');

-- Remove notification_queue from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE notification_queue;

-- Reset notification_queue replica identity back to default
ALTER TABLE notification_queue REPLICA IDENTITY DEFAULT;