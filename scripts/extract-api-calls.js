/**
 * Extract all unique API endpoint calls from frontend code
 */

const fs = require('fs');
const path = require('path');

const directories = ['components', 'app', 'hooks'];
const apiCalls = new Set();
const apiPattern = /['"`]\/api\/[^'"`]*['"`]/g;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(apiPattern);
  if (matches) {
    matches.forEach(match => {
      // Remove quotes
      const endpoint = match.replace(/['"`]/g, '');
      apiCalls.add(endpoint);
    });
  }
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      scanFile(fullPath);
    }
  }
}

// Scan all directories
directories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

// Output sorted results
const sorted = Array.from(apiCalls).sort();
sorted.forEach(endpoint => console.log(endpoint));

console.error(`\nTotal unique API endpoints: ${sorted.length}`);
