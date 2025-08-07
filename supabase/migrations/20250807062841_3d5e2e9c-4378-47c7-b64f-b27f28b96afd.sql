-- Create a database function to safely get/create RevenueCat customer
-- This function can be called from edge functions with proper RLS context
CREATE OR REPLACE FUNCTION public.get_or_create_revenuecat_customer(
  p_user_id UUID,
  p_platform TEXT DEFAULT 'web'
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  revenuecat_customer_id TEXT,
  platform TEXT,
  app_store_country TEXT,
  play_store_country TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_record RECORD;
BEGIN
  -- Try to get existing customer
  SELECT * INTO customer_record
  FROM revenuecat_customers
  WHERE revenuecat_customers.user_id = p_user_id;
  
  -- If no customer exists, create one
  IF customer_record IS NULL THEN
    INSERT INTO revenuecat_customers (
      user_id,
      revenuecat_customer_id,
      platform,
      app_store_country,
      play_store_country
    ) VALUES (
      p_user_id,
      p_user_id::TEXT, -- Use user ID as customer ID
      p_platform,
      CASE WHEN p_platform = 'ios' THEN 'US' ELSE NULL END,
      CASE WHEN p_platform = 'android' THEN 'US' ELSE NULL END
    )
    RETURNING * INTO customer_record;
  END IF;
  
  -- Return the customer record
  RETURN QUERY
  SELECT 
    customer_record.id,
    customer_record.user_id,
    customer_record.revenuecat_customer_id,
    customer_record.platform,
    customer_record.app_store_country,
    customer_record.play_store_country,
    customer_record.created_at,
    customer_record.updated_at;
END;
$$;

-- Create a database function to safely get active subscriptions
CREATE OR REPLACE FUNCTION public.get_active_revenuecat_subscriptions(
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  customer_id UUID,
  subscription_id TEXT,
  product_id TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.customer_id,
    s.subscription_id,
    s.product_id,
    s.status,
    s.expires_at,
    s.created_at,
    s.updated_at
  FROM revenuecat_subscriptions s
  JOIN revenuecat_customers c ON s.customer_id = c.id
  WHERE c.user_id = p_user_id
    AND s.status = 'active';
END;
$$;