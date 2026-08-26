import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // no incremental cache binding needed for this app (no ISR-heavy pages)
});
