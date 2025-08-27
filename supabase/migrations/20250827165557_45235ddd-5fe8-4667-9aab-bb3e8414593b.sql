-- Convert existing reminder_settings from array format to key-value format
UPDATE profiles 
SET reminder_settings = (
  SELECT jsonb_object_agg(
    (reminder->>'id'), 
    jsonb_build_object(
      'time', reminder->>'time',
      'label', reminder->>'label', 
      'enabled', (reminder->>'enabled')::boolean
    )
  )
  FROM jsonb_array_elements(reminder_settings->'reminders') AS reminder
)
WHERE reminder_settings ? 'reminders' 
  AND jsonb_typeof(reminder_settings->'reminders') = 'array';