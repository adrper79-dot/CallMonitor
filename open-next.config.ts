import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Optional: Enable R2 incremental cache for ISR/SSG caching
  // incrementalCache: r2IncrementalCache,
});