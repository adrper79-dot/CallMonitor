
import { SignalWire } from '@signalwire/js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const TOKEN = process.env.SIGNALWIRE_TOKEN;
const SPACE = process.env.SIGNALWIRE_SPACE;

if (!PROJECT_ID || !TOKEN || !SPACE) {
    console.error('Missing SignalWire credentials');
    process.exit(1);
}

function getSignalWireDomain() {
    const rawSpace = String(SPACE);
    const spaceName = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim();
    return `${spaceName}.signalwire.com`;
}

async function getJwt(resource) {
    const signalwireDomain = getSignalWireDomain();
    const authHeader = `Basic ${Buffer.from(`${PROJECT_ID}:${TOKEN}`).toString('base64')}`;
    const url = `https://${signalwireDomain}/api/relay/rest/jwt`;

    console.log(`Getting JWT from: ${url}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
        },
        body: JSON.stringify({
            resource: resource,
            expires_in: 3600
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error('JWT Response Error Body:', txt);
        throw new Error(`Failed to get JWT: ${res.statusText}`);
    }
    const data = await res.json();
    return data.jwt_token;
}

// Polyfill WebSocket for Node environment
global.WebSocket = WebSocket;

async function testConnection() {
    try {
        const domain = getSignalWireDomain();
        console.log(`Target Domain: ${domain}`);

        const resourceId = 'test_resource_id';
        console.log(`Generating JWT for resource: ${resourceId}`);
        const jwt = await getJwt(resourceId);
        console.log('JWT Generated successfully.');

        console.log('Initializing SignalWire Client (Node)...');
        console.log('Host:', domain);
        console.log('Token:', jwt.substring(0, 5) + '...' + jwt.substring(jwt.length - 5));

        const client = await SignalWire({
            host: domain,
            token: jwt
        });

        console.log('Client initialized. Connecting...');

        client.on('signalwire.ready', () => {
            console.log('✅ SignalWire Client Ready (Connection Successful)');
            client.disconnect();
            process.exit(0);
        });

        client.on('signalwire.error', (error) => {
            console.error('❌ SignalWire Client Error:', error);
            // Don't exit immediately, see if it retries or gives more info
        });

        await client.connect();

        // Wait a bit for connection
        setTimeout(() => {
            console.log('Timeout waiting for ready event. Status:', client?.session?.status);
            process.exit(1);
        }, 10000);

    } catch (error) {
        console.error('❌ Exception during test:', error);
        process.exit(1);
    }
}

testConnection();
