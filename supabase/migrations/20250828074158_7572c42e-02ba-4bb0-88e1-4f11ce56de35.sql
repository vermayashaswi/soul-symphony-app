-- Add entry_count column to profiles table for goal achievement tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS entry_count INTEGER DEFAULT 0;

-- Create function to update entry count when journal entries are created
CREATE OR REPLACE FUNCTION update_profile_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment entry count for the user
  UPDATE profiles 
  SET entry_count = entry_count + 1,
      updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update entry count
CREATE TRIGGER update_entry_count_trigger
  AFTER INSERT ON "Journal Entries"
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_entry_count();

-- Function to calculate streak for a user
CREATE OR REPLACE FUNCTION calculate_user_streak(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  current_streak INTEGER := 0;
  check_date DATE := CURRENT_DATE;
  has_entry BOOLEAN;
BEGIN
  -- Check each day backwards from today
  LOOP
    -- Check if user has an entry on this date
    SELECT EXISTS(
      SELECT 1 FROM "Journal Entries" 
      WHERE user_id = user_id_param 
      AND DATE(created_at) = check_date
    ) INTO has_entry;
    
    -- If no entry found, break the streak
    IF NOT has_entry THEN
      EXIT;
    END IF;
    
    -- Increment streak and check previous day
    current_streak := current_streak + 1;
    check_date := check_date - INTERVAL '1 day';
    
    -- Safety limit to prevent infinite loop
    IF current_streak > 365 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN current_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users' entry counts
UPDATE profiles 
SET entry_count = (
  SELECT COUNT(*) 
  FROM "Journal Entries" 
  WHERE "Journal Entries".user_id = profiles.id
)
WHERE entry_count = 0;