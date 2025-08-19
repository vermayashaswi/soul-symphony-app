-- Update legacy timezone formats to modern IANA identifiers
UPDATE profiles 
SET 
  timezone = CASE 
    WHEN timezone = 'Asia/Calcutta' THEN 'Asia/Kolkata'
    WHEN timezone = 'US/Eastern' THEN 'America/New_York'
    WHEN timezone = 'US/Central' THEN 'America/Chicago'
    WHEN timezone = 'US/Mountain' THEN 'America/Denver'
    WHEN timezone = 'US/Pacific' THEN 'America/Los_Angeles'
    WHEN timezone = 'US/Alaska' THEN 'America/Anchorage'
    WHEN timezone = 'US/Hawaii' THEN 'Pacific/Honolulu'
    WHEN timezone = 'Europe/Kiev' THEN 'Europe/Kyiv'
    ELSE timezone
  END,
  updated_at = NOW()
WHERE timezone IN (
  'Asia/Calcutta', 
  'US/Eastern', 
  'US/Central', 
  'US/Mountain', 
  'US/Pacific', 
  'US/Alaska', 
  'US/Hawaii',
  'Europe/Kiev'
);