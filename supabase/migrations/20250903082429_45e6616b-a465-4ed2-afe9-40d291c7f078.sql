-- Drop existing trigger if it exists to recreate properly
DROP TRIGGER IF EXISTS decrease_entry_count_on_delete ON "Journal Entries";

-- Function to decrease profile entry count on journal entry deletion
CREATE OR REPLACE FUNCTION public.decrease_profile_entry_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Decrease entry count for the user whose entry was deleted
  UPDATE profiles 
  SET 
    entry_count = GREATEST(0, COALESCE(entry_count, 0) - 1),
    updated_at = NOW()
  WHERE id = OLD.user_id;
  
  RETURN OLD;
END;
$function$;

-- Create DELETE trigger for Journal Entries
CREATE TRIGGER decrease_entry_count_on_delete
  AFTER DELETE ON "Journal Entries"
  FOR EACH ROW
  EXECUTE FUNCTION public.decrease_profile_entry_count();

-- Function to sync entry counts for all users
CREATE OR REPLACE FUNCTION public.sync_all_user_entry_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_record RECORD;
  actual_count INTEGER;
  updated_users INTEGER := 0;
  total_users INTEGER := 0;
BEGIN
  -- Loop through all profiles
  FOR user_record IN 
    SELECT id, entry_count 
    FROM profiles 
  LOOP
    total_users := total_users + 1;
    
    -- Get actual entry count from Journal Entries table
    SELECT COUNT(*) INTO actual_count
    FROM "Journal Entries" 
    WHERE user_id = user_record.id;
    
    -- Update if counts don't match
    IF COALESCE(user_record.entry_count, 0) != actual_count THEN
      UPDATE profiles 
      SET 
        entry_count = actual_count,
        updated_at = NOW()
      WHERE id = user_record.id;
      
      updated_users := updated_users + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_users_processed', total_users,
    'users_updated', updated_users,
    'timestamp', NOW()
  );
END;
$function$;

-- Function to verify entry count integrity
CREATE OR REPLACE FUNCTION public.verify_entry_count_integrity()
RETURNS TABLE(user_id uuid, profile_count integer, actual_count bigint, is_synced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.entry_count, 0) as profile_count,
    COUNT(je.id) as actual_count,
    (COALESCE(p.entry_count, 0) = COUNT(je.id)) as is_synced
  FROM profiles p
  LEFT JOIN "Journal Entries" je ON je.user_id = p.id
  GROUP BY p.id, p.entry_count
  ORDER BY is_synced, p.id;
END;
$function$;

-- Run the sync function to fix all existing users
SELECT public.sync_all_user_entry_counts();