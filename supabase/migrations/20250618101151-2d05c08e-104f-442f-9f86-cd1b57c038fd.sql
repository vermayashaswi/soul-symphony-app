
-- Ensure the feature_flags table exists with correct structure
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the maintenanceBanner feature flag if it doesn't exist
INSERT INTO public.feature_flags (name, is_enabled, description)
VALUES ('maintenanceBanner', false, 'Controls the display of the maintenance banner')
ON CONFLICT (name) DO NOTHING;

-- Also ensure we have other feature flags that might be referenced
INSERT INTO public.feature_flags (name, is_enabled, description) VALUES
  ('smartChatV2', false, 'Enhanced smart chat functionality'),
  ('premiumMessaging', false, 'Premium messaging features'),
  ('emotionCalendar', false, 'Emotion calendar feature'),
  ('insightsV2', false, 'Enhanced insights dashboard'),
  ('journalVoicePlayback', false, 'Voice playback for journal entries'),
  ('otherReservedFlags', false, 'Reserved for future features')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Allow public read access to feature flags" ON public.feature_flags;

-- Create policy to allow read access to feature flags (they are public configuration)
CREATE POLICY "Allow public read access to feature flags" 
  ON public.feature_flags 
  FOR SELECT 
  USING (true);
