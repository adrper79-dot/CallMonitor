-- Insert default feature flags
-- Global flags for AI providers

INSERT INTO global_feature_flags (feature, enabled) VALUES
  ('grok_chat_enabled', true),
  ('openai_chat_enabled', true),
  ('grok_tts_enabled', true),
  ('elevenlabs_tts_enabled', true)
ON CONFLICT (feature) DO NOTHING;