-- Fix live_translate column mismatch
-- Purpose: Add live_translate column to voice_configs table and fix triggers
-- Migration: 20260118_fix_live_translate_column
--
-- Background: The trigger validate_ai_agent_config references new.live_translate
-- but the column was originally named 'translate'. This migration adds the 
-- live_translate column and updates triggers to work correctly.

-- Step 1: Add live_translate column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_configs' AND column_name = 'live_translate'
  ) THEN
    ALTER TABLE voice_configs ADD COLUMN live_translate boolean DEFAULT false;
    COMMENT ON COLUMN voice_configs.live_translate IS 'Enable live translation during calls (requires translate_from and translate_to)';
  END IF;
END $$;

-- Step 2: Sync live_translate from translate column for existing rows
UPDATE voice_configs 
SET live_translate = COALESCE(translate, false)
WHERE live_translate IS NULL OR live_translate != COALESCE(translate, false);

-- Step 3: Recreate the validation trigger with correct column reference
CREATE OR REPLACE FUNCTION validate_ai_agent_config()
RETURNS trigger AS $$
BEGIN
  -- Validate temperature range
  IF NEW.ai_agent_temperature IS NOT NULL AND (NEW.ai_agent_temperature < 0 OR NEW.ai_agent_temperature > 2) THEN
    RAISE EXCEPTION 'ai_agent_temperature must be between 0 and 2';
  END IF;

  -- Validate model selection
  IF NEW.ai_agent_model IS NOT NULL AND NEW.ai_agent_model NOT IN ('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo') THEN
    RAISE EXCEPTION 'ai_agent_model must be one of: gpt-4o-mini, gpt-4o, gpt-4-turbo';
  END IF;

  -- Validate post-prompt URL format if provided
  IF NEW.ai_post_prompt_url IS NOT NULL AND NEW.ai_post_prompt_url !~ '^https?://' THEN
    RAISE EXCEPTION 'ai_post_prompt_url must be a valid HTTP(S) URL';
  END IF;

  -- If live translation is being NEWLY enabled, require language configuration
  -- Only check on INSERT or when enabling (not on partial updates)
  -- This allows users to update language fields one at a time
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.live_translate, NEW.translate, false) = true THEN
      IF NEW.translate_from IS NULL OR NEW.translate_to IS NULL THEN
        RAISE EXCEPTION 'translate_from and translate_to are required when translation is enabled';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only validate when NEWLY enabling translation
    IF (COALESCE(NEW.live_translate, NEW.translate, false) = true) AND 
       (COALESCE(OLD.live_translate, OLD.translate, false) = false) THEN
      IF NEW.translate_from IS NULL OR NEW.translate_to IS NULL THEN
        RAISE EXCEPTION 'translate_from and translate_to are required when enabling translation';
      END IF;
    END IF;
  END IF;

  -- Sync live_translate and translate columns
  IF NEW.live_translate IS NOT NULL AND NEW.translate IS NULL THEN
    NEW.translate := NEW.live_translate;
  ELSIF NEW.translate IS NOT NULL AND NEW.live_translate IS NULL THEN
    NEW.live_translate := NEW.translate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate the audit log trigger with correct column references
CREATE OR REPLACE FUNCTION log_ai_agent_config_change()
RETURNS trigger AS $$
DECLARE
  change_type text;
  old_config jsonb;
  new_config jsonb;
BEGIN
  -- Determine change type
  IF TG_OP = 'INSERT' THEN
    change_type := 'created';
    old_config := null;
    new_config := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if AI features were enabled/disabled
    IF OLD.ai_features_enabled = false AND NEW.ai_features_enabled = true THEN
      change_type := 'enabled';
    ELSIF OLD.ai_features_enabled = true AND NEW.ai_features_enabled = false THEN
      change_type := 'disabled';
    ELSE
      change_type := 'updated';
    END IF;
    old_config := to_jsonb(OLD);
    new_config := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    change_type := 'deleted';
    old_config := to_jsonb(OLD);
    new_config := null;
  END IF;

  -- Only log if AI-related fields changed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.ai_agent_id, OLD.ai_agent_prompt, OLD.ai_agent_temperature, OLD.ai_agent_model, 
        OLD.ai_post_prompt_url, OLD.ai_features_enabled, OLD.translate_from, OLD.translate_to,
        OLD.use_voice_cloning, COALESCE(OLD.live_translate, OLD.translate)) IS DISTINCT FROM
       (NEW.ai_agent_id, NEW.ai_agent_prompt, NEW.ai_agent_temperature, NEW.ai_agent_model,
        NEW.ai_post_prompt_url, NEW.ai_features_enabled, NEW.translate_from, NEW.translate_to,
        NEW.use_voice_cloning, COALESCE(NEW.live_translate, NEW.translate)) THEN
      
      INSERT INTO ai_agent_audit_log (
        organization_id,
        changed_by,
        change_type,
        old_config,
        new_config
      ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        NEW.updated_by,
        change_type,
        old_config,
        new_config
      );
    END IF;
  ELSE
    INSERT INTO ai_agent_audit_log (
      organization_id,
      changed_by,
      change_type,
      old_config,
      new_config
    ) VALUES (
      COALESCE(NEW.organization_id, OLD.organization_id),
      COALESCE(NEW.updated_by, OLD.updated_by),
      change_type,
      old_config,
      new_config
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create index for live_translate if not exists
CREATE INDEX IF NOT EXISTS idx_voice_configs_live_translate 
ON voice_configs(live_translate) 
WHERE live_translate = true;

-- Verification query (can be run manually to verify)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'voice_configs' 
-- AND column_name IN ('translate', 'live_translate', 'translate_from', 'translate_to');
