
// This script simulates the check performed in the webhook
// Run this locally to verify your local environment, but we suspect the issue is in Vercel Prod.

const apiKey = process.env.ASSEMBLYAI_API_KEY
console.log('Checking ASSEMBLYAI_API_KEY...')

if (apiKey) {
    console.log('✅ ASSEMBLYAI_API_KEY is present.')
    console.log('Length:', apiKey.length)
    console.log('Prefix:', apiKey.substring(0, 4) + '...')
} else {
    console.log('❌ ASSEMBLYAI_API_KEY is MISSING.')
}

// Also check OpenAI key as it is a dependency for translation
const openaiKey = process.env.OPENAI_API_KEY
if (openaiKey) {
    console.log('✅ OPENAI_API_KEY is present.')
} else {
    console.log('❌ OPENAI_API_KEY is MISSING.')
}
