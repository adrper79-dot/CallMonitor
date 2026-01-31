-- ============================================================================
-- SETUP: Create Supabase Storage Bucket for Call Recordings
-- Run this ONCE in Supabase SQL Editor
-- ============================================================================

-- Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
CREATE POLICY "Allow authenticated users to read recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'call-recordings');

CREATE POLICY "Allow service role to manage recordings"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'call-recordings');

-- Verify bucket was created
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE id = 'call-recordings';
