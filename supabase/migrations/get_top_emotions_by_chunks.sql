
-- Function to get top emotions with relevant chunks
CREATE OR REPLACE FUNCTION get_top_emotions_by_chunks(
  user_id_param uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL,
  limit_count integer DEFAULT 3
)
RETURNS TABLE(
  emotion text,
  score numeric,
  sample_chunks jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score,
      entries.id,
      chunks.content as chunk_content,
      chunks.id as chunk_id,
      chunks.chunk_index,
      entries.created_at
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    JOIN
      journal_chunks chunks ON entries.id = chunks.journal_entry_id
    WHERE 
      entries.user_id = user_id_param::text
      AND entries.emotions IS NOT NULL
      AND entries.is_chunked = true
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_chunks_per_emotion AS (
    SELECT
      emotion_name,
      id as entry_id,
      chunk_id,
      chunk_content,
      created_at,
      emotion_score,
      chunk_index,
      ROW_NUMBER() OVER (PARTITION BY emotion_name ORDER BY emotion_score DESC, created_at DESC) as rank
    FROM
      emotion_data
  ),
  sample_chunks AS (
    SELECT
      emotion_name,
      jsonb_agg(
        jsonb_build_object(
          'entry_id', entry_id,
          'chunk_id', chunk_id,
          'content', chunk_content,
          'created_at', created_at,
          'score', emotion_score,
          'chunk_index', chunk_index
        )
      ) as chunks_json
    FROM
      top_chunks_per_emotion
    WHERE
      rank <= 3
    GROUP BY
      emotion_name
  ),
  aggregated_emotions AS (
    SELECT
      emotion_name as emotion,
      AVG(emotion_score) as avg_score,
      COUNT(*) as occurrence_count
    FROM
      emotion_data
    GROUP BY
      emotion_name
    ORDER BY
      avg_score DESC,
      occurrence_count DESC
    LIMIT limit_count
  )
  SELECT 
    ae.emotion,
    ROUND(ae.avg_score::numeric, 2) as score,
    COALESCE(sc.chunks_json, '[]'::jsonb) as sample_chunks
  FROM 
    aggregated_emotions ae
  LEFT JOIN
    sample_chunks sc ON ae.emotion = sc.emotion_name;
END;
$$;
