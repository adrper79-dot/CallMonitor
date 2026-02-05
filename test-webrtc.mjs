import fetch from 'node-fetch';

async function testWebRTC() {
  const baseUrl = 'https://wordisbond-api.adrper79.workers.dev/api';

  try {
    console.log('Testing WebRTC connectivity and dialing...');

    // Use existing session token
    const token = '281ff36f-d31f-4544-9e48-8978aa13dab2';
    console.log('Using existing session token');

    // 3. Get WebRTC token
    console.log('Getting WebRTC token...');
    const tokenRes = await fetch(`${baseUrl}/webrtc/token`, {
      headers: {'Authorization': `Bearer ${token}`}
    });
    const tokenData = await tokenRes.json();
    console.log('WebRTC Token Response:', JSON.stringify(tokenData, null, 2));

    if (tokenData.error) {
      throw new Error(`WebRTC token error: ${tokenData.error}`);
    }

    console.log('✅ WebRTC token obtained successfully!');
    console.log('RTC Config:', tokenData.rtcConfig);

    // 4. Test dialing
    console.log('Testing phone dial to +17062677235...');
    const dialRes = await fetch(`${baseUrl}/webrtc/dial`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone_number: '+17062677235' })
    });
    const dialData = await dialRes.json();
    console.log('Dial Response:', JSON.stringify(dialData, null, 2));

    if (dialData.error) {
      throw new Error(`Dial error: ${dialData.error}`);
    }

    console.log('✅ Phone dial initiated successfully!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Full error:', err);
  }
}

testWebRTC();