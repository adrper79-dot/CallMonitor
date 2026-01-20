
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SIGNALWIRE_TOKEN = process.env.SIGNALWIRE_TOKEN;
const SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE;

console.log('--- SignalWire Config ---');
console.log('Project ID:', SIGNALWIRE_PROJECT_ID);
console.log('Space:', SIGNALWIRE_SPACE);
console.log('Token Length:', SIGNALWIRE_TOKEN ? SIGNALWIRE_TOKEN.length : 'MISSING');

function getSignalWireDomain() {
    if (!SIGNALWIRE_SPACE) return null;
    const rawSpace = String(SIGNALWIRE_SPACE);
    const spaceName = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim();
    return `${spaceName}.signalwire.com`;
}

async function testTokenGeneration() {
    const domain = getSignalWireDomain();
    const authHeader = `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`;
    const sessionId = `test_session_${Date.now()}`;

    console.log('\n--- Testing Fabric Token (SAT) ---');
    try {
        const response = await fetch(`https://${domain}/api/fabric/subscribers/tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                reference: sessionId,
                expires_in: 3600
            })
        });

        console.log('Status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Success! Token generated.');
            console.log('Token preview:', data.token.substring(0, 20) + '...');
        } else {
            const text = await response.text();
            console.log('Failed:', text);
        }
    } catch (e) {
        console.error('Error:', e);
    }

    console.log('\n--- Testing Relay JWT (Legacy) ---');
    try {
        const response = await fetch(`https://${domain}/api/relay/rest/jwt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                resource: sessionId,
                expires_in: 3600
            })
        });

        console.log('Status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Success! JWT generated.');
            console.log('JWT preview:', data.jwt_token.substring(0, 20) + '...');
        } else {
            const text = await response.text();
            console.log('Failed:', text);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testTokenGeneration();
