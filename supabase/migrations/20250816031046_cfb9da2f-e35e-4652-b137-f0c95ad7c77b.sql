
-- Remove duplicate functions that use auth.uid() to fix overloading conflicts

-- Remove the 3-parameter version of match_journal_entries (uses auth.uid())
DROP FUNCTION IF EXISTS public.match_journal_entries(extensions.vector, double precision, integer);

-- Remove the 5-parameter version of match_journal_entries_with_date (uses auth.uid())
DROP FUNCTION IF EXISTS public.match_journal_entries_with_date(extensions.vector, double precision, integer, timestamp with time zone, timestamp with time zone);

-- Remove the 5-parameter version of match_journal_entries_by_theme (uses auth.uid())
DROP FUNCTION IF EXISTS public.match_journal_entries_by_theme(text, double precision, integer, timestamp with time zone, timestamp with time zone);

-- Remove the 5-parameter version of match_journal_entries_by_emotion (uses auth.uid())
DROP FUNCTION IF EXISTS public.match_journal_entries_by_emotion(text, double precision, timestamp with time zone, timestamp with time zone, integer);

-- Verify the remaining functions are properly defined
-- These are the functions we want to keep:
-- match_journal_entries(query_embedding, match_threshold, match_count, user_id_filter) - 4 params
-- match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date) - 6 params  
-- match_journal_entries_by_theme(theme_query, user_id_filter, match_threshold, match_count, start_date, end_date) - 6 params
-- match_journal_entries_by_emotion(emotion_name, user_id_filter, min_score, start_date, end_date, limit_count) - 6 params
