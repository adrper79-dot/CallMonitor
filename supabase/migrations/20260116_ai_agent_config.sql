-- AI Agent Configuration Extension
-- Purpose: Add configuration fields for AI agent settings per organization
-- Migration: 20260116_ai_agent_config

-- Add AI Agent settings to voice_configs if not already present
-- Note: Most fields already exist from previous implementations

-- Add agent configuration fields to voice_configs
do $$ 
begin
  -- AI Agent ID reference (organization can have custom agent)
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_agent_id') then
    alter table voice_configs add column ai_agent_id text;
    comment on column voice_configs.ai_agent_id is 'Custom SignalWire AI Agent ID for this organization';
  end if;

  -- Agent prompt customization
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_agent_prompt') then
    alter table voice_configs add column ai_agent_prompt text;
    comment on column voice_configs.ai_agent_prompt is 'Custom system prompt for AI agent (overrides default)';
  end if;

  -- Agent temperature (creativity setting)
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_agent_temperature') then
    alter table voice_configs add column ai_agent_temperature numeric(3,2) default 0.3 check (ai_agent_temperature between 0 and 2);
    comment on column voice_configs.ai_agent_temperature is 'AI agent temperature (0=deterministic, 2=creative)';
  end if;

  -- Agent model selection
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_agent_model') then
    alter table voice_configs add column ai_agent_model text default 'gpt-4o-mini' check (ai_agent_model in ('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'));
    comment on column voice_configs.ai_agent_model is 'AI model for agent (gpt-4o-mini recommended)';
  end if;

  -- Post-prompt webhook URL
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_post_prompt_url') then
    alter table voice_configs add column ai_post_prompt_url text;
    comment on column voice_configs.ai_post_prompt_url is 'Webhook URL called after AI agent processing';
  end if;

  -- Enable/disable AI features per organization
  if not exists (select 1 from information_schema.columns 
                 where table_name='voice_configs' and column_name='ai_features_enabled') then
    alter table voice_configs add column ai_features_enabled boolean default true;
    comment on column voice_configs.ai_features_enabled is 'Master switch for AI features (translation, transcription, etc)';
  end if;
end $$;

-- Create index for ai_agent_id lookups
create index if not exists idx_voice_configs_ai_agent_id on voice_configs(ai_agent_id) where ai_agent_id is not null;

-- Function to get AI agent configuration for organization
create or replace function get_ai_agent_config(org_id uuid)
returns table (
  organization_id uuid,
  ai_agent_id text,
  ai_agent_prompt text,
  ai_agent_temperature numeric,
  ai_agent_model text,
  ai_post_prompt_url text,
  ai_features_enabled boolean,
  translate_from text,
  translate_to text,
  use_voice_cloning boolean,
  cloned_voice_id text
) as $$
begin
  return query
  select 
    vc.organization_id,
    vc.ai_agent_id,
    vc.ai_agent_prompt,
    vc.ai_agent_temperature,
    vc.ai_agent_model,
    vc.ai_post_prompt_url,
    vc.ai_features_enabled,
    vc.translate_from,
    vc.translate_to,
    vc.use_voice_cloning,
    vc.cloned_voice_id
  from voice_configs vc
  where vc.organization_id = org_id
  limit 1;
end;
$$ language plpgsql security definer;

-- Function to validate AI agent configuration
create or replace function validate_ai_agent_config()
returns trigger as $$
begin
  -- Validate temperature range
  if new.ai_agent_temperature is not null and (new.ai_agent_temperature < 0 or new.ai_agent_temperature > 2) then
    raise exception 'ai_agent_temperature must be between 0 and 2';
  end if;

  -- Validate model selection
  if new.ai_agent_model is not null and new.ai_agent_model not in ('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo') then
    raise exception 'ai_agent_model must be one of: gpt-4o-mini, gpt-4o, gpt-4-turbo';
  end if;

  -- Validate post-prompt URL format if provided
  if new.ai_post_prompt_url is not null and new.ai_post_prompt_url !~ '^https?://' then
    raise exception 'ai_post_prompt_url must be a valid HTTP(S) URL';
  end if;

  -- If live translation is being NEWLY enabled, require language configuration
  -- Only validate on INSERT or when enabling (allows partial updates)
  if tg_op = 'INSERT' then
    if coalesce(new.live_translate, new.translate, false) = true then
      if new.translate_from is null or new.translate_to is null then
        raise exception 'translate_from and translate_to are required when translation is enabled';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Only validate when NEWLY enabling translation
    if (coalesce(new.live_translate, new.translate, false) = true) and 
       (coalesce(old.live_translate, old.translate, false) = false) then
      if new.translate_from is null or new.translate_to is null then
        raise exception 'translate_from and translate_to are required when enabling translation';
      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- Add validation trigger if not exists
drop trigger if exists validate_ai_agent_config_trigger on voice_configs;
create trigger validate_ai_agent_config_trigger
  before insert or update on voice_configs
  for each row execute function validate_ai_agent_config();

-- Create audit log for AI agent configuration changes
create table if not exists ai_agent_audit_log (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  changed_by uuid references users(id),
  change_type text not null check (change_type in ('created', 'updated', 'deleted', 'enabled', 'disabled')),
  old_config jsonb,
  new_config jsonb,
  change_reason text,
  created_at timestamptz not null default now()
);

-- Index for audit log queries
create index if not exists idx_ai_agent_audit_org_id on ai_agent_audit_log(organization_id);
create index if not exists idx_ai_agent_audit_created_at on ai_agent_audit_log(created_at desc);

-- RLS for audit log
alter table ai_agent_audit_log enable row level security;

create policy "Users can view own organization AI audit logs"
  on ai_agent_audit_log for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage AI audit logs"
  on ai_agent_audit_log for all
  using (auth.jwt()->>'role' = 'service_role');

-- Function to log AI agent config changes
create or replace function log_ai_agent_config_change()
returns trigger as $$
declare
  change_type text;
  old_config jsonb;
  new_config jsonb;
begin
  -- Determine change type
  if tg_op = 'INSERT' then
    change_type := 'created';
    old_config := null;
    new_config := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    -- Check if AI features were enabled/disabled
    if old.ai_features_enabled = false and new.ai_features_enabled = true then
      change_type := 'enabled';
    elsif old.ai_features_enabled = true and new.ai_features_enabled = false then
      change_type := 'disabled';
    else
      change_type := 'updated';
    end if;
    old_config := to_jsonb(old);
    new_config := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    change_type := 'deleted';
    old_config := to_jsonb(old);
    new_config := null;
  end if;

  -- Only log if AI-related fields changed
  if tg_op = 'UPDATE' then
    if (old.ai_agent_id, old.ai_agent_prompt, old.ai_agent_temperature, old.ai_agent_model, 
        old.ai_post_prompt_url, old.ai_features_enabled, old.translate_from, old.translate_to,
        old.use_voice_cloning, old.live_translate) is distinct from
       (new.ai_agent_id, new.ai_agent_prompt, new.ai_agent_temperature, new.ai_agent_model,
        new.ai_post_prompt_url, new.ai_features_enabled, new.translate_from, new.translate_to,
        new.use_voice_cloning, new.live_translate) then
      
      insert into ai_agent_audit_log (
        organization_id,
        changed_by,
        change_type,
        old_config,
        new_config
      ) values (
        coalesce(new.organization_id, old.organization_id),
        new.updated_by,
        change_type,
        old_config,
        new_config
      );
    end if;
  else
    insert into ai_agent_audit_log (
      organization_id,
      changed_by,
      change_type,
      old_config,
      new_config
    ) values (
      coalesce(new.organization_id, old.organization_id),
      new.updated_by,
      change_type,
      old_config,
      new_config
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Add audit logging trigger if not exists
drop trigger if exists log_ai_agent_config_trigger on voice_configs;
create trigger log_ai_agent_config_trigger
  after insert or update or delete on voice_configs
  for each row execute function log_ai_agent_config_change();

-- Comments for documentation
comment on function get_ai_agent_config(uuid) is 'Returns AI agent configuration for an organization';
comment on function validate_ai_agent_config() is 'Validates AI agent configuration before insert/update';
comment on function log_ai_agent_config_change() is 'Logs all changes to AI agent configuration for audit trail';
comment on table ai_agent_audit_log is 'Audit trail for AI agent configuration changes';
