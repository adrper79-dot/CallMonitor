
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Load .vercel/.env
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') });

const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SIGNALWIRE_TOKEN = process.env.SIGNALWIRE_TOKEN;
const SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE;

function getSignalWireDomain() {
    if (!SIGNALWIRE_SPACE) return null;
    return SIGNALWIRE_SPACE
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim() + '.signalwire.com';
}

async function testTokenGeneration() {
    console.log('Testing SignalWire Token Generation...');
    console.log('Project:', SIGNALWIRE_PROJECT_ID);
    console.log('Space:', SIGNALWIRE_SPACE);

    const domain = getSignalWireDomain();
    if (!domain) {
        console.error('Invalid SignalWire Domain');
        return;
    }

    const userId = '28d68e05-ab20-40ee-b935-b19e8927ae68'; // Dev/Test Actor ID
    console.log('Using UserId:', userId);

    const authHeader = `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`;

    // 1. Try Fabric SAT
    console.log('\n--- Attempting Fabric SAT ---');
    try {
        const url = `https://${domain}/api/fabric/subscribers/tokens`;
        console.log('POST', url);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                reference: userId,
                expires_in: 3600
            })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fabric Error:', e);
    }

    // 2. Try Relay JWT
    console.log('\n--- Attempting Relay JWT ---');
    try {
        const url = `https://${domain}/api/relay/rest/jwt`;
        console.log('POST', url);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                resource: 'test_session_id',
                expires_in: 3600
            })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Relay Error:', e);
    }
}

testTokenGeneration();
