-- Complete Phase 1 Security Fixes: Fix the very last remaining database function search paths

CREATE OR REPLACE FUNCTION public.get_entity_emotion_statistics(user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 20)
RETURNS TABLE(entity_name text, entity_type text, emotion_name text, relationship_count bigint, avg_strength numeric, max_strength numeric, first_occurrence timestamp with time zone, last_occurrence timestamp with time zone)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH entity_emotion_data AS (
    SELECT
      ee_entity as entity_name_value,
      -- Extract entity type from entities column
      (
        SELECT entity_type_key
        FROM jsonb_each(entries.entities) as ent(entity_type_key, entity_values)
        WHERE ee_entity = ANY(
          SELECT jsonb_array_elements_text(entity_values)
        )
        LIMIT 1
      ) as entity_type_value,
      ee_emotion as emotion_name_value,
      (ee_strength::text)::numeric as strength_value,
      entries.created_at
    FROM
      "Journal Entries" entries,
      jsonb_each(entries.entityemotion) as ee(ee_entity, ee_emotions),
      jsonb_each(ee_emotions) as ee_inner(ee_emotion, ee_strength)
    WHERE 
      entries.user_id = user_id_filter
      AND entries.entityemotion IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    eed.entity_name_value as entity_name,
    COALESCE(eed.entity_type_value, 'unknown') as entity_type,
    eed.emotion_name_value as emotion_name,
    COUNT(*)::bigint as relationship_count,
    ROUND(AVG(eed.strength_value)::numeric, 2) as avg_strength,
    ROUND(MAX(eed.strength_value)::numeric, 2) as max_strength,
    MIN(eed.created_at) as first_occurrence,
    MAX(eed.created_at) as last_occurrence
  FROM
    entity_emotion_data eed
  GROUP BY
    eed.entity_name_value, eed.entity_type_value, eed.emotion_name_value
  ORDER BY
    relationship_count DESC,
    avg_strength DESC,
    last_occurrence DESC
  LIMIT limit_count;
END;
$function$;