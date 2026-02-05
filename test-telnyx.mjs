import fetch from 'node-fetch';

async function testTelnyxAPI() {
  const apiKey = process.env.TELNYX_API_KEY || 'YOUR_TELNYX_API_KEY_HERE';
  const connectionId = process.env.TELNYX_CONNECTION_ID || 'YOUR_CONNECTION_ID_HERE';

  try {
    console.log('Testing Telnyx API directly...');

    const response = await fetch('https://api.telnyx.com/v2/telephony_credentials', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: connectionId,
        name: 'test-user-123',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      console.error('Telnyx API error:', responseText);
    } else {
      const tokenData = JSON.parse(responseText);
      console.log('✅ Telnyx API success:', tokenData);
    }

  } catch (err) {
    console.error('❌ Telnyx API test failed:', err.message);
  }
}

testTelnyxAPI();