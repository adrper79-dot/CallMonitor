
import WebSocket from 'ws';
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

const SPACE = process.env.SIGNALWIRE_SPACE;
const PROJECT = process.env.SIGNALWIRE_PROJECT_ID;
const TOKEN = process.env.SIGNALWIRE_TOKEN;

if (!SPACE || !PROJECT || !TOKEN) {
    console.error('Missing credentials');
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

async function main() {
    const domain = getSignalWireDomain();
    const url = `wss://${domain}/`;
    // SignalWire usually connects to wss://<space>.signalwire.com or wss://<space>.signalwire.com/socket
    // The SDK documentation implies it connects to certain endpoints.
    // Let's try root first, but also observe if SDK uses a specific path. 
    // A generic Socket.io or Relay socket might be at / or /socket ...
    // But standard WebSocket usually responds to the raw handshake.

    console.log(`Testing raw WebSocket connection to: ${url}`);

    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log('✅ Connected to WebSocket!');
        console.log('Closing...');
        ws.close();
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error('❌ WebSocket Error:', err.message);
        // Try adding /api/transport path which some SW versions use?
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} - ${reason}`);
    });

    // Timeout
    setTimeout(() => {
        console.log('Timeout connecting to raw WebSocket');
        ws.terminate();
        process.exit(1);
    }, 5000);
}

main();
