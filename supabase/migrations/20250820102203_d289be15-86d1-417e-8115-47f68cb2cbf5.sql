-- Comprehensive timezone normalization for all supported countries
-- Covers all 24 pricing regions plus common legacy formats

UPDATE profiles 
SET 
  timezone = CASE 
    -- India
    WHEN timezone = 'Asia/Calcutta' THEN 'Asia/Kolkata'
    
    -- United States legacy formats
    WHEN timezone = 'US/Eastern' THEN 'America/New_York'
    WHEN timezone = 'US/Central' THEN 'America/Chicago'
    WHEN timezone = 'US/Mountain' THEN 'America/Denver'
    WHEN timezone = 'US/Pacific' THEN 'America/Los_Angeles'
    WHEN timezone = 'US/Alaska' THEN 'America/Anchorage'
    WHEN timezone = 'US/Hawaii' THEN 'Pacific/Honolulu'
    WHEN timezone = 'EST' THEN 'America/New_York'
    WHEN timezone = 'CST' THEN 'America/Chicago'
    WHEN timezone = 'MST' THEN 'America/Denver'
    WHEN timezone = 'PST' THEN 'America/Los_Angeles'
    WHEN timezone = 'EDT' THEN 'America/New_York'
    WHEN timezone = 'CDT' THEN 'America/Chicago'
    WHEN timezone = 'MDT' THEN 'America/Denver'
    WHEN timezone = 'PDT' THEN 'America/Los_Angeles'
    
    -- Canada legacy formats
    WHEN timezone = 'Canada/Eastern' THEN 'America/Toronto'
    WHEN timezone = 'Canada/Central' THEN 'America/Winnipeg'
    WHEN timezone = 'Canada/Mountain' THEN 'America/Edmonton'
    WHEN timezone = 'Canada/Pacific' THEN 'America/Vancouver'
    WHEN timezone = 'Canada/Atlantic' THEN 'America/Halifax'
    
    -- Europe legacy formats
    WHEN timezone = 'Europe/Kiev' THEN 'Europe/Kyiv'
    WHEN timezone = 'CET' THEN 'Europe/Berlin'
    WHEN timezone = 'EET' THEN 'Europe/Athens'
    WHEN timezone = 'WET' THEN 'Europe/London'
    WHEN timezone = 'CEST' THEN 'Europe/Berlin'
    WHEN timezone = 'EEST' THEN 'Europe/Athens'
    WHEN timezone = 'WEST' THEN 'Europe/London'
    WHEN timezone = 'BST' THEN 'Europe/London'
    
    -- Australia legacy formats
    WHEN timezone = 'Australia/ACT' THEN 'Australia/Sydney'
    WHEN timezone = 'Australia/NSW' THEN 'Australia/Sydney'
    WHEN timezone = 'Australia/Victoria' THEN 'Australia/Melbourne'
    WHEN timezone = 'Australia/Queensland' THEN 'Australia/Brisbane'
    WHEN timezone = 'Australia/South' THEN 'Australia/Adelaide'
    WHEN timezone = 'Australia/West' THEN 'Australia/Perth'
    WHEN timezone = 'Australia/Tasmania' THEN 'Australia/Hobart'
    WHEN timezone = 'Australia/North' THEN 'Australia/Darwin'
    WHEN timezone = 'AEST' THEN 'Australia/Sydney'
    WHEN timezone = 'AEDT' THEN 'Australia/Sydney'
    WHEN timezone = 'AWST' THEN 'Australia/Perth'
    WHEN timezone = 'ACST' THEN 'Australia/Adelaide'
    WHEN timezone = 'ACDT' THEN 'Australia/Adelaide'
    
    -- Asia legacy formats
    WHEN timezone = 'JST' THEN 'Asia/Tokyo'
    WHEN timezone = 'KST' THEN 'Asia/Seoul'
    WHEN timezone = 'SGT' THEN 'Asia/Singapore'
    WHEN timezone = 'MYT' THEN 'Asia/Kuala_Lumpur'
    WHEN timezone = 'ICT' THEN 'Asia/Bangkok'
    WHEN timezone = 'GST' THEN 'Asia/Dubai'
    WHEN timezone = 'AST' THEN 'Asia/Riyadh'
    WHEN timezone = 'IST' THEN 'Asia/Kolkata'
    
    -- Mexico legacy formats
    WHEN timezone = 'Mexico/General' THEN 'America/Mexico_City'
    WHEN timezone = 'Mexico/BajaNorte' THEN 'America/Tijuana'
    WHEN timezone = 'Mexico/BajaSur' THEN 'America/Mazatlan'
    
    -- Brazil legacy formats
    WHEN timezone = 'Brazil/East' THEN 'America/Sao_Paulo'
    WHEN timezone = 'Brazil/West' THEN 'America/Manaus'
    WHEN timezone = 'Brazil/Acre' THEN 'America/Rio_Branco'
    WHEN timezone = 'BRT' THEN 'America/Sao_Paulo'
    WHEN timezone = 'BRST' THEN 'America/Sao_Paulo'
    
    -- Africa legacy formats
    WHEN timezone = 'CAT' THEN 'Africa/Johannesburg'
    WHEN timezone = 'WAT' THEN 'Africa/Lagos'
    WHEN timezone = 'SAST' THEN 'Africa/Johannesburg'
    
    -- GMT variations
    WHEN timezone IN ('GMT', 'GMT+0', 'GMT-0', 'UTC+0', 'UTC-0', 'Z') THEN 'UTC'
    
    ELSE timezone
  END,
  updated_at = NOW()
WHERE timezone IN (
  -- Legacy formats to normalize
  'Asia/Calcutta',
  'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Alaska', 'US/Hawaii',
  'EST', 'CST', 'MST', 'PST', 'EDT', 'CDT', 'MDT', 'PDT',
  'Canada/Eastern', 'Canada/Central', 'Canada/Mountain', 'Canada/Pacific', 'Canada/Atlantic',
  'Europe/Kiev', 'CET', 'EET', 'WET', 'CEST', 'EEST', 'WEST', 'BST',
  'Australia/ACT', 'Australia/NSW', 'Australia/Victoria', 'Australia/Queensland',
  'Australia/South', 'Australia/West', 'Australia/Tasmania', 'Australia/North',
  'AEST', 'AEDT', 'AWST', 'ACST', 'ACDT',
  'JST', 'KST', 'SGT', 'MYT', 'ICT', 'GST', 'AST', 'IST',
  'Mexico/General', 'Mexico/BajaNorte', 'Mexico/BajaSur',
  'Brazil/East', 'Brazil/West', 'Brazil/Acre', 'BRT', 'BRST',
  'CAT', 'WAT', 'SAST',
  'GMT', 'GMT+0', 'GMT-0', 'UTC+0', 'UTC-0', 'Z'
);