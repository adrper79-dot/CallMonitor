const fs = require('fs/promises')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const FROM_VARIANTS = ['Word Is Bond', 'Word Is Bond']
const TO_NAME = 'Word Is Bond'

const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'out',
  '.vercel'
])

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.yml', '.yaml'
])

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walk(fullPath)
      }
    } else {
      yield fullPath
    }
  }
}

function shouldProcess(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

function replaceAll(content) {
  let updated = content
  for (const from of FROM_VARIANTS) {
    updated = updated.split(from).join(TO_NAME)
  }
  return updated
}

async function main() {
  let updatedFiles = 0
  for await (const filePath of walk(ROOT)) {
    if (!shouldProcess(filePath)) continue
    const content = await fs.readFile(filePath, 'utf8')
    const updated = replaceAll(content)
    if (updated !== content) {
      await fs.writeFile(filePath, updated, 'utf8')
      updatedFiles += 1
    }
  }
  console.log(`✅ Brand rename complete. Updated files: ${updatedFiles}`)
}

main().catch((err) => {
  console.error('❌ Brand rename failed:', err.message)
  process.exit(1)
})
