import fetch from 'node-fetch';

async function testDial() {
  const baseUrl = 'https://wordisbond-api.adrper79.workers.dev/api';

  try {
    // 1. Get CSRF
    const csrfRes = await fetch(`${baseUrl}/auth/csrf`);
    const csrfData = await csrfRes.json();
    console.log('CSRF:', csrfData);

    // 2. Login (using snake_case per API standard)
    const loginRes = await fetch(`${baseUrl}/auth/callback/credentials`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: 'demo@wordisbond.com',
        password: 'demo12345',
        csrf_token: csrfData.csrf_token
      })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData);
    const token = loginData.session_token;

    if (!token) throw new Error('No token');

    // 3. Token
    const tokenRes = await fetch(`${baseUrl}/webrtc/token`, {
      headers: {'Authorization': `Bearer ${token}`}
    });
    const tokenData = await tokenRes.json();
    console.log('WebRTC Token:', tokenData);

    // 4. Dial
    const dialRes = await fetch(`${baseUrl}/webrtc/dial`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone_number: '+17062677235' })
    });
    const dialData = await dialRes.json();
    console.log('Dial:', dialData);

  } catch (err) {
    console.error('Error:', err);
  }
}

testDial();