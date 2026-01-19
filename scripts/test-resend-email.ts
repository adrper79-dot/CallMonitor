
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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEST_EMAIL = process.argv[2] || 'test@example.com'; // Pass email as argument

console.log('Testing Resend Email Service');
console.log('API Key:', RESEND_API_KEY ? `${RESEND_API_KEY.substring(0, 8)}...` : 'MISSING');
console.log('To:', TEST_EMAIL);

async function testEmail() {
    if (!RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY not found');
        process.exit(1);
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Word Is Bond <onboarding@resend.dev>',
                to: [TEST_EMAIL],
                subject: 'Test Email from Word Is Bond',
                html: '<h1>Test Email</h1><p>This is a test email to verify the Resend integration.</p>'
            })
        });

        const responseText = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Body:', responseText);

        if (response.ok) {
            console.log('✅ Email sent successfully!');
        } else {
            console.log('❌ Email send failed');
        }
    } catch (error) {
        console.error('❌ Exception:', error);
    }
}

testEmail();
