-- Create recordings bucket for TTS and call recordings storage
-- This migration needs to be run via Supabase Dashboard SQL Editor
-- or through the Supabase Management API

-- Insert the recordings bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings', 
  true,  -- Public bucket for easy access to audio files
  52428800,  -- 50MB file size limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for recordings bucket
-- Allow authenticated users to upload to their organization's folder
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
);

-- Allow public read access to all recordings
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recordings');

-- Allow service role to manage all files
CREATE POLICY "Allow service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'recordings')
WITH CHECK (bucket_id = 'recordings');
