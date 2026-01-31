import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
    buildCommand: "npx next build",
});

console.log(JSON.stringify(config, (key, value) => {
    if (typeof value === "function") return "[Function]";
    return value;
}, 2));
