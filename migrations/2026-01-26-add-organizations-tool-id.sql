-- Add missing tool_id column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tool_id UUID;