
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local manually
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

console.log('--- Config ---');
console.log('Project ID:', SIGNALWIRE_PROJECT_ID);
console.log('Space:', SIGNALWIRE_SPACE);
console.log('Token:', SIGNALWIRE_TOKEN ? (SIGNALWIRE_TOKEN.substring(0, 5) + '...') : 'MISSING');

if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_TOKEN || !SIGNALWIRE_SPACE) {
    console.error('Missing credentials');
    process.exit(1);
}

function getSignalWireDomain() {
    const rawSpace = String(SIGNALWIRE_SPACE);
    const spaceName = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim();
    return `${spaceName}.signalwire.com`;
}

async function testJwt() {
    const signalwireDomain = getSignalWireDomain();
    console.log('Clean Domain:', signalwireDomain);

    const authHeader = `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`;
    const url = `https://${signalwireDomain}/api/relay/rest/jwt`;

    console.log('Testing JWT generation...');
    console.log('URL:', url);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                resource: 'test_resource_id',
                expires_in: 3600
            })
        });

        console.log('Status:', res.status, res.statusText);

        const text = await res.text();
        console.log('Body:', text);

        if (!res.ok) {
            console.error('FAILED to generate JWT');

            // Check if it might be a 404 (wrong domain) or 401 (wrong coords)
            if (res.status === 404) {
                console.error('Hint: 404 usually means the provided Space URL is incorrect or the API endpoint path is wrong (v3 Relay vs v2).');
            } else if (res.status === 401) {
                console.error('Hint: 401 means Authentication Failed. Check Project ID and Token.');
            }
        } else {
            console.log('SUCCESS: JWT generated.');
            const data = JSON.parse(text);
            console.log('Token preview:', data.jwt_token ? (data.jwt_token.substring(0, 10) + '...') : 'NO TOKEN IN BODY');
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

testJwt();
