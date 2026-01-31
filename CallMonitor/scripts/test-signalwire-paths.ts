
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

function getSignalWireDomain() {
    const rawSpace = String(SPACE);
    const spaceName = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim();
    return `${spaceName}.signalwire.com`;
}

async function testPath(path) {
    const domain = getSignalWireDomain();
    const url = `wss://${domain}${path}`;
    console.log(`Testing: ${url}`);

    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        let status = 'timeout';

        const timer = setTimeout(() => {
            if (status === 'timeout') {
                console.log(`   ❌ Timeout on ${path}`);
                ws.terminate();
                resolve(false);
            }
        }, 3000);

        ws.on('open', () => {
            console.log(`   ✅ Connected to ${path}!`);
            status = 'success';
            ws.close();
            resolve(true);
        });

        ws.on('error', (err) => {
            console.log(`   ❌ Error on ${path}: ${err.message}`);
            status = 'error';
            resolve(false);
        });

        ws.on('unexpected-response', (req, res) => {
            console.log(`   ❌ Unexpected response on ${path}: ${res.statusCode}`);
            status = 'error';
            resolve(false);
        });
    });
}

async function main() {
    console.log('Testing alternative WebSocket paths...');
    const paths = [
        '/',
        '/socket',
        '/ws',
        '/api/relay/ws',
        '/api/relay',
        '/api/transport',
        '/socket.io/?EIO=3&transport=websocket'
    ];

    for (const p of paths) {
        await testPath(p);
    }
}

main();
