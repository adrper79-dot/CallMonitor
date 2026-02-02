CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title text,  -- AI-generated summary
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text CHECK (role IN ('user', 'assistant')),  -- OpenAI format
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS/Audit
CREATE POLICY chat_rls ON chat_sessions USING (organization_id = current_org_id());
CREATE TRIGGER audit_chat AFTER INSERT ON chat_messages EXECUTE PROCEDURE audit_trigger();
