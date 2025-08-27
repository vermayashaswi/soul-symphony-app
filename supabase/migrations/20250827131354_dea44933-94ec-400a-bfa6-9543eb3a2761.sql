-- Add foreign key relationship between user_notifications and profiles
ALTER TABLE user_notifications 
ADD CONSTRAINT fk_user_notifications_profiles 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;