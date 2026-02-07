import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

interface PinnedVersion {
  frontend: Record<string, string>
  backend: Record<string, string>
}

const PINNED: PinnedVersion = {
  frontend: {
    next: '15.5.7',
    react: '19.2.4',
    'react-dom': '19.2.4',
    tailwindcss: '4.1.18',
    typescript: '5.9.3',
    wrangler: '4.61.1',
  },
  backend: {
    hono: '4.7.4',
    '@neondatabase/serverless': '1.0.2',
    typescript: '5.7.3',
    wrangler: '4.61.1',
  },
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
}

function checkVersions() {
  console.log('🔍 Checking pinned versions...\n')

  const pkg = readJson('package.json')
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [pkgName, version] of Object.entries(PINNED.frontend)) {
    const actual = deps[pkgName]
    if (!actual || actual !== version) {
      console.log(`❌ Frontend ${pkgName}: expected ${version}, got ${actual}`)
    } else {
      console.log(`✅ Frontend ${pkgName}: ${version}`)
    }
  }

  const workersPkg = readJson('workers/package.json')
  const workersDeps = { ...workersPkg.dependencies, ...workersPkg.devDependencies }
  for (const [pkgName, version] of Object.entries(PINNED.backend)) {
    const actual = workersDeps[pkgName]
    if (!actual || actual !== version) {
      console.log(`❌ Backend ${pkgName}: expected ${version}, got ${actual}`)
    } else {
      console.log(`✅ Backend ${pkgName}: ${version}`)
    }
  }
}

function checkAuthMigration() {
  console.log('\n🔍 Checking for raw fetch calls (auth migration)...\n')

  const tsxFiles = []
  function scanDir(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && !file.startsWith('.')) scanDir(full)
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        tsxFiles.push(full)
      }
    }
  }
  scanDir(path.join(ROOT, 'app'))
  scanDir(path.join(ROOT, 'components'))
  scanDir(path.join(ROOT, 'hooks'))

  let rawFetch = 0
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8')
    if (
      content.includes('fetch(') &&
      !content.includes('apiGet') &&
      !content.includes('apiPost') &&
      !content.includes('apiPut') &&
      !content.includes('apiDelete')
    ) {
      console.log(`⚠️  Potential raw fetch: ${path.relative(ROOT, file)}`)
      rawFetch++
    }
  }
  console.log(`Total potential raw fetch files: ${rawFetch}`)
}

function listApiRoutes() {
  console.log('\n📋 Backend API Routes:\n')
  const routesDir = path.join(ROOT, 'workers/src/routes')
  for (const file of fs.readdirSync(routesDir)) {
    if (file.endsWith('.ts')) {
      console.log(`- /api/${file.replace('.ts', '')}`)
    }
  }
}

checkVersions()
checkAuthMigration()
listApiRoutes()

console.log('\n✅ Compliance check complete.')
