-- Add the smartChatSwitch feature flag to enable Gemini vs GPT switching
INSERT INTO feature_flags (
  name,
  description,
  is_enabled,
  rollout_percentage,
  target_audience
) VALUES (
  'smartChatSwitch',
  'Switch between GPT-4.1-mini and Gemini 2.5 Flash for journal query planning',
  true,
  100,
  '{}'::jsonb
);