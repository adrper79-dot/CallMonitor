-- Add slug column to organizations for tests and uniqueness
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.organizations SET slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'gi')) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON public.organizations(slug);
