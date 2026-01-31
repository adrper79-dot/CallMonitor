-- Create function to find orphan manifests (manifests without a valid evidence bundle)
CREATE OR REPLACE FUNCTION find_orphan_manifests()
RETURNS TABLE(id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT em.id 
  FROM evidence_manifests em
  LEFT JOIN evidence_bundles eb ON eb.manifest_id = em.id AND eb.superseded_at IS NULL
  WHERE eb.id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
