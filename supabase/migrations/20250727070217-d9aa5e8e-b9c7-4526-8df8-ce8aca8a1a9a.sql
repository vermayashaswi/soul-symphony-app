-- Final cleanup: Fix remaining functions and update all remaining policies
-- This addresses the last of the linter warnings

-- Fix all remaining journal and embeddings functions with proper search paths
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score double precision DEFAULT 0.3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, emotion_score double precision, embedding extensions.vector)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    CAST(entries.emotions->>emotion_name AS float) as emotion_score,
    je.embedding
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.emotions IS NOT NULL 
    AND entries.emotions ? emotion_name
    AND CAST(entries.emotions->>emotion_name AS float) >= min_score
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    CAST(entries.emotions->>emotion_name AS float) DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_profile_with_trial(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_data RECORD;
  is_trial_active BOOLEAN := false;
  result JSONB;
BEGIN
  -- Verify user can access this profile
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get profile with subscription info
  SELECT * INTO profile_data
  FROM profiles
  WHERE id = p_user_id;
  
  IF profile_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Check trial status
  IF profile_data.trial_ends_at IS NOT NULL THEN
    is_trial_active := profile_data.trial_ends_at > NOW();
  END IF;
  
  -- Build result without phone verification fields
  result := jsonb_build_object(
    'id', profile_data.id,
    'email', profile_data.email,
    'full_name', profile_data.full_name,
    'display_name', profile_data.display_name,
    'avatar_url', profile_data.avatar_url,
    'subscription_status', COALESCE(profile_data.subscription_status, 'free'),
    'subscription_tier', COALESCE(profile_data.subscription_tier, 'free'),
    'is_premium', COALESCE(profile_data.is_premium, false),
    'trial_ends_at', profile_data.trial_ends_at,
    'is_trial_active', is_trial_active,
    'onboarding_completed', COALESCE(profile_data.onboarding_completed, false),
    'created_at', profile_data.created_at,
    'updated_at', profile_data.updated_at
  );
  
  RETURN result;
END;
$function$;

-- Fix remaining tables' policies to require authenticated role only
-- Update chat_messages policies
DROP POLICY IF EXISTS "Users can delete messages in own threads" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in own threads" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update messages in own threads" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages in own threads" ON public.chat_messages;

CREATE POLICY "Users can view messages in own threads" ON public.chat_messages
FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM chat_threads ct WHERE ((ct.id = chat_messages.thread_id) AND (ct.user_id = auth.uid()))));

CREATE POLICY "Users can insert messages in own threads" ON public.chat_messages
FOR INSERT TO authenticated WITH CHECK (EXISTS ( SELECT 1 FROM chat_threads ct WHERE ((ct.id = chat_messages.thread_id) AND (ct.user_id = auth.uid()))));

CREATE POLICY "Users can update messages in own threads" ON public.chat_messages
FOR UPDATE TO authenticated USING (EXISTS ( SELECT 1 FROM chat_threads ct WHERE ((ct.id = chat_messages.thread_id) AND (ct.user_id = auth.uid()))));

CREATE POLICY "Users can delete messages in own threads" ON public.chat_messages
FOR DELETE TO authenticated USING (EXISTS ( SELECT 1 FROM chat_threads ct WHERE ((ct.id = chat_messages.thread_id) AND (ct.user_id = auth.uid()))));

-- Update chat_threads policies
DROP POLICY IF EXISTS "Users can delete own chat threads" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can insert own chat threads" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can update own chat threads" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can view own chat threads" ON public.chat_threads;

CREATE POLICY "Users can view own chat threads" ON public.chat_threads
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat threads" ON public.chat_threads
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat threads" ON public.chat_threads
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat threads" ON public.chat_threads
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update journal_embeddings policies
DROP POLICY IF EXISTS "Users can insert embeddings for own entries" ON public.journal_embeddings;
DROP POLICY IF EXISTS "Users can update embeddings for own entries" ON public.journal_embeddings;
DROP POLICY IF EXISTS "Users can view embeddings for own entries" ON public.journal_embeddings;

CREATE POLICY "Users can view embeddings for own entries" ON public.journal_embeddings
FOR SELECT TO authenticated USING (EXISTS ( SELECT 1 FROM "Journal Entries" je WHERE ((je.id = journal_embeddings.journal_entry_id) AND (je.user_id = auth.uid()))));

CREATE POLICY "Users can insert embeddings for own entries" ON public.journal_embeddings
FOR INSERT TO authenticated WITH CHECK (EXISTS ( SELECT 1 FROM "Journal Entries" je WHERE ((je.id = journal_embeddings.journal_entry_id) AND (je.user_id = auth.uid()))));

CREATE POLICY "Users can update embeddings for own entries" ON public.journal_embeddings
FOR UPDATE TO authenticated USING (EXISTS ( SELECT 1 FROM "Journal Entries" je WHERE ((je.id = journal_embeddings.journal_entry_id) AND (je.user_id = auth.uid()))));

-- Update user_feature_flags policies
DROP POLICY IF EXISTS "Users can delete their own feature flag overrides" ON public.user_feature_flags;
DROP POLICY IF EXISTS "Users can insert their own feature flag overrides" ON public.user_feature_flags;
DROP POLICY IF EXISTS "Users can update their own feature flag overrides" ON public.user_feature_flags;
DROP POLICY IF EXISTS "Users can view their own feature flag overrides" ON public.user_feature_flags;

CREATE POLICY "Users can view their own feature flag overrides" ON public.user_feature_flags
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feature flag overrides" ON public.user_feature_flags
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature flag overrides" ON public.user_feature_flags
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feature flag overrides" ON public.user_feature_flags
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update revenuecat_customers policies
DROP POLICY IF EXISTS "Users can insert their own revenuecat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can view their own customer data" ON public.revenuecat_customers;

CREATE POLICY "Users can view their own customer data" ON public.revenuecat_customers
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own revenuecat customer data" ON public.revenuecat_customers
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update revenuecat_subscriptions policies
DROP POLICY IF EXISTS "Users can insert their own subscription data" ON public.revenuecat_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription data" ON public.revenuecat_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscription data" ON public.revenuecat_subscriptions;

CREATE POLICY "Users can view their own subscription data" ON public.revenuecat_subscriptions
FOR SELECT TO authenticated USING (customer_id IN ( SELECT revenuecat_customers.id FROM revenuecat_customers WHERE (revenuecat_customers.user_id = auth.uid())));

CREATE POLICY "Users can insert their own subscription data" ON public.revenuecat_subscriptions
FOR INSERT TO authenticated WITH CHECK (customer_id IN ( SELECT revenuecat_customers.id FROM revenuecat_customers WHERE (revenuecat_customers.user_id = auth.uid())));

CREATE POLICY "Users can update their own subscription data" ON public.revenuecat_subscriptions
FOR UPDATE TO authenticated USING (customer_id IN ( SELECT revenuecat_customers.id FROM revenuecat_customers WHERE (revenuecat_customers.user_id = auth.uid())));

-- Remove duplicate or old policies that allow anonymous access
DROP POLICY IF EXISTS "Allow read access to emotions for authenticated users" ON public.emotions;
DROP POLICY IF EXISTS "Anyone can view feature flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Anyone can view active themes" ON public.themes;
DROP POLICY IF EXISTS "Authenticated users can select user sessions" ON public.user_sessions;