
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') })

const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID
const TOKEN = process.env.SIGNALWIRE_TOKEN
const SPACE = process.env.SIGNALWIRE_SPACE

if (!PROJECT_ID || !TOKEN || !SPACE) {
    console.error('Missing SignalWire credentials')
    process.exit(1)
}

function getSignalWireDomain() {
    const rawSpace = String(SPACE)
    const spaceName = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim()
    return `${spaceName}.signalwire.com`
}

async function listSubscribers() {
    const domain = getSignalWireDomain()
    const auth = Buffer.from(`${PROJECT_ID}:${TOKEN}`).toString('base64')

    console.log(`Checking subscribers for ${domain}...`)

    try {
        // Note: The endpoint might be /api/fabric/subscribers or similar
        // Based on code we saw: /api/fabric/subscribers/tokens
        // Let's try listing subscribers
        const url = `https://${domain}/api/fabric/subscribers`

        const res = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        })

        if (!res.ok) {
            console.error(`Error ${res.status}: ${await res.text()}`)
            return
        }

        const data = await res.json()
        console.log(`Found ${data.data?.length || 0} subscribers`)

        if (data.data) {
            data.data.forEach((sub: any) => {
                console.log(`- ID: ${sub.id}, Email: ${sub.email}, Reference: ${sub.reference || 'N/A'}`)
            })
        }

    } catch (e) {
        console.error('Failed to list subscribers', e)
    }
}

listSubscribers()
