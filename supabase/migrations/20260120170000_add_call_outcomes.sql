-- Create call_outcomes table
CREATE TABLE IF NOT EXISTS public.call_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  outcome_status text NOT NULL CHECK (outcome_status IN ('agreed', 'declined', 'partial', 'inconclusive', 'follow_up_required', 'cancelled')),
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low', 'uncertain')),
  agreed_items jsonb DEFAULT '[]'::jsonb,
  declined_items jsonb DEFAULT '[]'::jsonb,
  ambiguities jsonb DEFAULT '[]'::jsonb,
  follow_up_actions jsonb DEFAULT '[]'::jsonb,
  summary_text text DEFAULT '',
  summary_source text DEFAULT 'human' CHECK (summary_source IN ('human', 'ai_generated', 'ai_confirmed')),
  readback_confirmed boolean DEFAULT false,
  readback_timestamp timestamp with time zone,
  declared_by_user_id uuid,
  last_updated_by_user_id uuid,
  revision_number integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_outcomes_pkey PRIMARY KEY (id),
  CONSTRAINT call_outcomes_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id),
  CONSTRAINT call_outcomes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT call_outcomes_declared_by_user_id_fkey FOREIGN KEY (declared_by_user_id) REFERENCES public.users(id),
  CONSTRAINT call_outcomes_last_updated_by_user_id_fkey FOREIGN KEY (last_updated_by_user_id) REFERENCES public.users(id),
  CONSTRAINT call_outcomes_call_id_unique UNIQUE (call_id)
);

-- Create call_outcome_history table
CREATE TABLE IF NOT EXISTS public.call_outcome_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_outcome_id uuid NOT NULL,
  outcome_status text,
  summary_text text,
  revision_number integer,
  created_at timestamp with time zone DEFAULT now(),
  changed_by_user_id uuid,
  CONSTRAINT call_outcome_history_pkey PRIMARY KEY (id),
  CONSTRAINT call_outcome_history_call_outcome_id_fkey FOREIGN KEY (call_outcome_id) REFERENCES public.call_outcomes(id) ON DELETE CASCADE
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_call_outcomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_call_outcomes_updated_at
  BEFORE UPDATE ON public.call_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_call_outcomes_updated_at();

-- Trigger to save history
CREATE OR REPLACE FUNCTION save_call_outcome_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.call_outcome_history (
    call_outcome_id,
    outcome_status,
    summary_text,
    revision_number,
    created_at,
    changed_by_user_id
  ) VALUES (
    OLD.id,
    OLD.outcome_status,
    OLD.summary_text,
    OLD.revision_number,
    now(),
    OLD.last_updated_by_user_id -- Use the user who performed the LAST update? No, we want the user performing THIS update.
    -- Wait, Triggers on AFTER UPDATE see NEW and OLD. 
    -- If we use NEW.last_updated_by_user_id, it is the user who just made the change. 
    -- But the history entry usually records the state BEFORE the change or the change itself?
    -- Standard is to record the OLD version into history, or record the NEW version into a log.
    -- If we record OLD, we want to know who is archiving it? Or who created that version?
    -- The `changed_by_user_id` probably refers to who TRIGGERED the history creation (the current updater).
  );
  
  -- Let's use NEW.last_updated_by_user_id as the person responsible for the change that pushed OLD into history.
  -- Actually, let's fix the INSERT to use NEW.last_updated_by_user_id
  
  INSERT INTO public.call_outcome_history (
    call_outcome_id,
    outcome_status,
    summary_text,
    revision_number,
    created_at,
    changed_by_user_id
  ) VALUES (
    OLD.id,
    OLD.outcome_status,
    OLD.summary_text,
    OLD.revision_number,
    now(),
    NEW.last_updated_by_user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER save_call_outcome_history
  AFTER UPDATE ON public.call_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION save_call_outcome_history();
