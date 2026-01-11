const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const kv = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([^=]+)=(.*)$/)
    if (!m) continue
    let key = m[1].trim()
    let val = m[2].trim()
    // strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    kv[key] = val
  }
  return kv
}

;(async function main(){
  try {
    const envPath = path.join(__dirname, '..', '.vercel', '.env')
    if (!fs.existsSync(envPath)) {
      console.error('ENV_FILE_MISSING', envPath)
      process.exit(2)
    }
    const env = parseEnvFile(envPath)
    const swProject = env.SIGNALWIRE_PROJECT_ID
    const swToken = env.SIGNALWIRE_TOKEN
    const swNumber = env.SIGNALWIRE_NUMBER
    const rawSpace = String(env.SIGNALWIRE_SPACE || '')
    const swSpace = rawSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '').trim()
    const target = env.YOUR_PHONE || '+17062677235'

    if (!(swProject && swToken && swNumber && swSpace)) {
      console.error('MISSING_SIGNALWIRE_CONFIG')
      process.exit(3)
    }

    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    const params = new URLSearchParams()
    params.append('From', swNumber)
    params.append('To', target)
    params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound`)
    params.append('StatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)

    const endpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })

    const text = await res.text()
    let out = text
    try {
      const j = JSON.parse(text)
      if (j && j.sid) j.sid = '[REDACTED]'
      out = JSON.stringify(j)
    } catch (e) {
      // non-json body, leave as text
    }

    console.log('HTTP_STATUS', res.status)
    console.log('RESPONSE', out)
    process.exit(res.ok ? 0 : 4)
  } catch (e) {
    console.error('ERROR', e.message)
    process.exit(1)
  }
})()
