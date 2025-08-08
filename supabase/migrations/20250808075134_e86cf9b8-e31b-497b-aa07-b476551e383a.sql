
-- 1) Recreate profiles RLS policies to use auth.uid()

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2) Recreate "Journal Entries" RLS policies to use auth.uid()

DROP POLICY IF EXISTS "Users can view own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can view own journal entries"
  ON public."Journal Entries"
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can insert own journal entries"
  ON public."Journal Entries"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can update own journal entries"
  ON public."Journal Entries"
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can delete own journal entries"
  ON public."Journal Entries"
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Drop helper functions added by the change

-- RevenueCat helpers
DROP FUNCTION IF EXISTS public.get_or_create_revenuecat_customer(uuid, text);
DROP FUNCTION IF EXISTS public.get_active_revenuecat_subscriptions(uuid);

-- Auth/profile helpers
DROP FUNCTION IF EXISTS public.get_authenticated_user_id();
DROP FUNCTION IF EXISTS public.create_profile_safe(uuid, text, text);
