-- Add survey question type metadata to voice_configs
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS survey_question_types jsonb DEFAULT '[]';

COMMENT ON COLUMN public.voice_configs.survey_question_types IS
  'Question type metadata: [{index: 0, type: "scale_1_5"}, {index: 1, type: "yes_no"}]';
