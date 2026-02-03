-- Campaign Stats Function
-- Migration: 20260117000002_campaign_stats_function.sql
-- Purpose: Provides aggregated statistics for campaign execution

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_campaign_stats(UUID);

-- Create function to get campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_id_param UUID)
RETURNS TABLE (
  total BIGINT,
  completed BIGINT,
  successful BIGINT,
  failed BIGINT,
  pending BIGINT,
  calling BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed,
    COUNT(*) FILTER (WHERE status = 'completed' AND outcome = 'answered')::BIGINT as successful,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending,
    COUNT(*) FILTER (WHERE status = 'calling')::BIGINT as calling
  FROM campaign_calls
  WHERE campaign_id = campaign_id_param;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION get_campaign_stats(UUID) IS 'Returns aggregated statistics for a campaign including total, completed, successful, failed, pending, and calling counts';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_campaign_stats(UUID) TO authenticated;
