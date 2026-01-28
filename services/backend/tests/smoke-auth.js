const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

async function run() {
  const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'
  console.log('Using backend:', backend)

  try {
    const h = await fetch(`${backend.replace(/\/$/, '')}/health`)
    console.log('/health', h.status)
    const session = await fetch(`${backend.replace(/\/$/, '')}/api/auth/session`)
    console.log('/api/auth/session', session.status)
    const text = await session.text()
    console.log('session body:', text.slice(0, 1000))
    process.exit(0)
  } catch (err) {
    console.error('smoke test failed', err)
    process.exit(2)
  }
}

run()
