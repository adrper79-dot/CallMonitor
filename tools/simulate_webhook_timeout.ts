
// Simulation of Vercel Serverless Function Behavior
async function handleWebhook(req: any) {
    console.log('[Handler] Received Request')

    // Anti-pattern: Fire and forget
    processWebhookAsync(req).catch(err => console.error(err))

    console.log('[Handler] Returning Response immediately')
    return { status: 200, body: { ok: true } }
}

async function processWebhookAsync(req: any) {
    console.log('[Async] Starting slow process (Database, API calls)...')
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulating 2s work
    console.log('[Async] Work Complete! (If you see this, the runtime stayed partial alive)')
}

async function runSimulation() {
    console.log('--- START SIMULATION ---')
    const res = await handleWebhook({})
    console.log('--- FUNCTION RETURNED ---')
    console.log('Response:', res)

    // In Vercel/AWS Lambda, the process freezes/exits HERE.
    // The [Async] log above might never happen if the runtime kills it.

    // We simulate immediate process exit
    console.log('--- SIMULATING RUNTIME FREEZE (100ms grace) ---')
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('--- END SIMULATION ---')
}

runSimulation()
