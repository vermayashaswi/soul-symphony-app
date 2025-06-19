
-- Create feature_flags table to store all available feature flags
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_audience JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_feature_flags table to store user-specific feature flag overrides
CREATE TABLE public.user_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_flag_id)
);

-- Enable RLS for both tables
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for feature_flags (read-only for authenticated users)
CREATE POLICY "Anyone can view feature flags" 
  ON public.feature_flags 
  FOR SELECT 
  TO authenticated
  USING (true);

-- RLS policies for user_feature_flags (users can only see their own flags)
CREATE POLICY "Users can view their own feature flag overrides" 
  ON public.user_feature_flags 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feature flag overrides" 
  ON public.user_feature_flags 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature flag overrides" 
  ON public.user_feature_flags 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feature flag overrides" 
  ON public.user_feature_flags 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_feature_flags_name ON public.feature_flags(name);
CREATE INDEX idx_user_feature_flags_user_id ON public.user_feature_flags(user_id);
CREATE INDEX idx_user_feature_flags_feature_flag_id ON public.user_feature_flags(feature_flag_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_feature_flags_updated_at BEFORE UPDATE ON public.user_feature_flags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insert the existing feature flags from the codebase
INSERT INTO public.feature_flags (name, description, is_enabled, rollout_percentage) VALUES
('smartChatV2', 'Enhanced AI chat with improved conversation flow', false, 0),
('premiumMessaging', 'Premium messaging features for subscribers', false, 0),
('emotionCalendar', 'Calendar view for emotional tracking', false, 0),
('insightsV2', 'Advanced insights and analytics dashboard', false, 0),
('journalVoicePlayback', 'Voice playback functionality for journal entries', false, 0),
('otherReservedFlags', 'Reserved feature flags for future use', false, 0);
