
-- Create feature_flags table
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  target_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (target_percentage >= 0 AND target_percentage <= 100),
  user_criteria JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_feature_flags table for individual user overrides
CREATE TABLE public.user_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_flag_id)
);

-- Add Row Level Security (RLS)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Feature flags are readable by all authenticated users
CREATE POLICY "Feature flags are readable by authenticated users" 
  ON public.feature_flags 
  FOR SELECT 
  TO authenticated
  USING (true);

-- User feature flags are only accessible by the user themselves
CREATE POLICY "Users can view their own feature flag overrides" 
  ON public.user_feature_flags 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Only admins can modify feature flags (we'll implement admin check later)
CREATE POLICY "Only admins can modify feature flags" 
  ON public.feature_flags 
  FOR ALL 
  USING (false) 
  WITH CHECK (false);

CREATE POLICY "Only admins can modify user feature flags" 
  ON public.user_feature_flags 
  FOR ALL 
  USING (false) 
  WITH CHECK (false);

-- Insert some sample feature flags
INSERT INTO public.feature_flags (name, description, is_enabled, target_percentage) VALUES
  ('new_voice_interface', 'New voice recording interface with enhanced features', false, 0),
  ('advanced_analytics', 'Advanced analytics dashboard with detailed insights', false, 0),
  ('ai_suggestions', 'AI-powered suggestions for journal prompts', false, 10),
  ('dark_mode_v2', 'Enhanced dark mode with better contrast', true, 100),
  ('beta_soulnet', 'Beta version of SoulNet visualization', false, 5);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON public.feature_flags 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_feature_flags_updated_at 
  BEFORE UPDATE ON public.user_feature_flags 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
