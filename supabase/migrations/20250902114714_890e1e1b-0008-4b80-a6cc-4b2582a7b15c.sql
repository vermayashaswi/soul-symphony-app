-- Remove smartChatV2 feature flag and user overrides
DELETE FROM user_feature_flags 
WHERE feature_flag_id IN (
  SELECT id FROM feature_flags WHERE name = 'smartChatV2'
);

DELETE FROM feature_flags WHERE name = 'smartChatV2';