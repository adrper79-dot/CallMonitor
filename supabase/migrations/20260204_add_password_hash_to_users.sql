-- Add password_hash column to users table for credential-based authentication
-- This column stores bcrypt-hashed passwords for local auth

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Comment on columns
COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt-hashed password for local authentication';
COMMENT ON COLUMN public.users.created_at IS 'Timestamp when user was created';
COMMENT ON COLUMN public.users.updated_at IS 'Timestamp when user was last updated';
