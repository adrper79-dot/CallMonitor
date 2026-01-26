-- Add normalized_email to users for canonical lookups
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS normalized_email text;
UPDATE public.users SET normalized_email = lower(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_normalized_email_idx ON public.users(normalized_email);
