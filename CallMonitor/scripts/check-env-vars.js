/**
 * Environment Variable Check for Transcription & Translation
 * Run locally: node scripts/check-env-vars.js
 * Or call the API: curl https://voxsouth.online/api/debug/translation-check
 */

const required = {
  // Transcription (AssemblyAI)
  'ASSEMBLYAI_API_KEY': 'Required for transcription',
  // Translation (OpenAI)
  'OPENAI_API_KEY': 'Required for translation',
  // TTS (ElevenLabs)
  'ELEVENLABS_API_KEY': 'Required for translated audio',
  // Recording storage
  'NEXT_PUBLIC_SUPABASE_URL': 'Required for storage',
  'SUPABASE_SERVICE_ROLE_KEY': 'Required for storage'
};

console.log('='.repeat(60));
console.log(' TRANSCRIPTION & TRANSLATION ENVIRONMENT CHECK');
console.log('='.repeat(60));

let allConfigured = true;

for (const [key, description] of Object.entries(required)) {
  const value = process.env[key];
  const configured = !!value;
  const preview = configured ? value.substring(0, 8) + '...' : 'NOT SET';
  
  console.log(`\n${configured ? '✅' : '❌'} ${key}`);
  console.log(`   ${description}`);
  console.log(`   Value: ${preview}`);
  
  if (!configured) {
    allConfigured = false;
  }
}

console.log('\n' + '='.repeat(60));
if (allConfigured) {
  console.log('✅ All environment variables are configured!');
} else {
  console.log('❌ Some environment variables are missing!');
  console.log('   Translation may not work correctly.');
}
console.log('='.repeat(60));
