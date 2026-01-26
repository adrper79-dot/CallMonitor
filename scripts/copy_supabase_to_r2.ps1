param()

# PowerShell script to copy Supabase storage objects to Cloudflare R2 using rclone or AWS CLI
# Requires: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET

if (-not $env:R2_ACCESS_KEY_ID -or -not $env:R2_SECRET_ACCESS_KEY -or -not $env:R2_ENDPOINT -or -not $env:R2_BUCKET) {
  Write-Error 'Missing one of R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_ENDPOINT/R2_BUCKET'
  exit 2
}

Write-Host 'Use migrations/rclone.conf.template to create a rclone config for R2 (S3 compatible).'
Write-Host 'Dry-run example:'
Write-Host "  rclone --config migrations/rclone.conf sync supabase:bucketname r2:$($env:R2_BUCKET) --dry-run --progress"
Write-Host 'Run actual sync after dry-run:'
Write-Host "  rclone --config migrations/rclone.conf sync supabase:bucketname r2:$($env:R2_BUCKET) --progress"

Write-Host 'Or use AWS CLI with --endpoint-url set to R2 endpoint (requires aws cli configured)'
Write-Host "  aws s3 cp s3://<supabase-bucket> s3://$($env:R2_BUCKET) --recursive --endpoint-url $($env:R2_ENDPOINT)"

Write-Host 'Script done. Verify checksums by sampling or comparing object lists.'
