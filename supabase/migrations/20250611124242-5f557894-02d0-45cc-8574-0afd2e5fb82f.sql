
-- Create the themes table to store master categories
CREATE TABLE public.themes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category_type TEXT NOT NULL DEFAULT 'life_category',
  display_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (themes are global)
CREATE POLICY "Anyone can view active themes" 
  ON public.themes 
  FOR SELECT 
  USING (is_active = true);

-- Admin policies (for future admin functionality)
CREATE POLICY "Service role can manage themes" 
  ON public.themes 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Insert the predefined master categories
INSERT INTO public.themes (name, description, display_order) VALUES
  ('Self & Identity', 'Personal growth, self-reflection, and identity exploration', 1),
  ('Body & Health', 'Physical health, fitness, body image, and medical concerns', 2),
  ('Mental Health', 'Emotional wellbeing, mental health challenges, and therapy', 3),
  ('Romantic Relationships', 'Dating, marriage, partnerships, and romantic connections', 4),
  ('Family', 'Family relationships, parenting, and family dynamics', 5),
  ('Friendships & Social Circle', 'Friendships, social connections, and community', 6),
  ('Sexuality & Gender', 'Sexual identity, gender expression, and intimate relationships', 7),
  ('Career & Workplace', 'Work, career development, and professional relationships', 8),
  ('Money & Finances', 'Financial planning, money management, and economic concerns', 9),
  ('Education & Learning', 'Formal education, skill development, and learning experiences', 10),
  ('Habits & Routines', 'Daily habits, routines, and lifestyle patterns', 11),
  ('Sleep & Rest', 'Sleep quality, rest, and recovery', 12),
  ('Creativity & Hobbies', 'Creative pursuits, hobbies, and artistic expression', 13),
  ('Spirituality & Beliefs', 'Spiritual practices, religious beliefs, and philosophy', 14),
  ('Technology & Social Media', 'Digital life, social media, and technology use', 15),
  ('Environment & Living Space', 'Home, living environment, and physical spaces', 16),
  ('Time & Productivity', 'Time management, productivity, and organization', 17),
  ('Travel & Movement', 'Travel experiences, moving, and location changes', 18),
  ('Loss & Grief', 'Dealing with loss, grief, and major life transitions', 19),
  ('Purpose & Fulfillment', 'Life purpose, meaning, and personal fulfillment', 20),
  ('Conflict & Trauma', 'Conflict resolution, trauma processing, and difficult experiences', 21),
  ('Celebration & Achievement', 'Achievements, celebrations, and positive milestones', 22);

-- Create function to get active themes
CREATE OR REPLACE FUNCTION public.get_active_themes()
RETURNS TABLE(id integer, name text, description text, display_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.display_order
  FROM public.themes t
  WHERE t.is_active = true
  ORDER BY t.display_order ASC, t.name ASC;
END;
$$;
