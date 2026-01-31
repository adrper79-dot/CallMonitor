"prebuild": "npm ci && npm ls next @next/swc",
"validate": "npm run lint && tsc --noEmit && npm run build && npm test"