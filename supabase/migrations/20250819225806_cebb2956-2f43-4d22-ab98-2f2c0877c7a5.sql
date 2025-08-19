-- Update legacy Asia/Calcutta timezone entries to modern Asia/Kolkata
UPDATE profiles 
SET timezone = 'Asia/Kolkata', updated_at = NOW()
WHERE timezone = 'Asia/Calcutta';

-- Add logging to track the update
SELECT 'Updated ' || COUNT(*) || ' profiles from Asia/Calcutta to Asia/Kolkata' as update_summary
FROM profiles 
WHERE timezone = 'Asia/Kolkata' AND country = 'IN';