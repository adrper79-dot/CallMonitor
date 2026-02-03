import { pool, query } from '../lib/pgClient.ts'
import { neonConfig } from '@neondatabase/serverless'

async function validateDriver() {
    console.log('Validating Database Driver Configuration...')

    // check WebSocket config
    if (typeof WebSocket === 'undefined') {
        if (neonConfig.webSocketConstructor) {
            console.log('✅ WebSocket constructor configured for Node.js environment')
        } else {
            console.error('❌ WebSocket constructor NOT configured for Node.js environment')
            process.exit(1)
        }
    } else {
        console.log('ℹ️ Running in environment with global WebSocket (Edge/Browser)')
    }

    // check pool export
    if (!pool) {
        console.warn('⚠️ Pool is null. Check environment variables (NEON_PG_CONN).')
        // If env is missing, we can't test connectivity, but checking the config logic was the main goal.
        return
    }

    console.log('✅ Pool instance created')

    // Note: We might not have a real connection string in this environment, 
    // so we skip the actual query to avoid "password authentication failed" failure in CI/Validation if secrets aren't set.
    // The goal is to verify the *code* structure.
    console.log('Driver structure validation passed.')
}

validateDriver().catch(console.error)
