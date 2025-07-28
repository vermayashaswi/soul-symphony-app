-- Enable RLS on remaining tables
ALTER TABLE public.revenuecat_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenuecat_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;