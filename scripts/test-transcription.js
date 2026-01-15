#!/usr/bin/env node
/**
 * Test Transcription with Existing Recording
 * 
 * This script:
 * 1. Fetches recordings from the database
 * 2. Picks one with a recording URL
 * 3. Triggers transcription via AssemblyAI
 * 4. Monitors progress
 */

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE environment variables')
  process.exit(1)
}

if (!ASSEMBLYAI_API_KEY) {
  console.error('❌ Missing ASSEMBLYAI_API_KEY')
  process.exit(1)
}

async function fetchRecordings() {
  console.log('🔍 Fetching recordings from database...\n')
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/recordings?select=id,call_id,recording_url,status,duration&limit=10`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recordings: ${response.status} ${response.statusText}`)
  }
  
  const recordings = await response.json()
  return recordings
}

async function submitToAssemblyAI(audioUrl) {
  console.log('📤 Submitting to AssemblyAI...')
  console.log(`Audio URL: ${audioUrl}\n`)
  
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: 'en',
      punctuate: true,
      format_text: true,
      speaker_labels: true
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AssemblyAI submission failed: ${response.status} ${error}`)
  }
  
  const result = await response.json()
  console.log('✅ Submitted successfully!')
  console.log(`Transcript ID: ${result.id}`)
  console.log(`Status: ${result.status}\n`)
  
  return result.id
}

async function pollTranscriptStatus(transcriptId) {
  console.log('⏳ Polling for completion...\n')
  
  let attempts = 0
  const maxAttempts = 60 // 5 minutes max
  
  while (attempts < maxAttempts) {
    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to poll status: ${response.status}`)
    }
    
    const result = await response.json()
    
    console.log(`[${new Date().toLocaleTimeString()}] Status: ${result.status}`)
    
    if (result.status === 'completed') {
      console.log('\n✅ Transcription completed!\n')
      return result
    }
    
    if (result.status === 'error') {
      console.error(`\n❌ Transcription failed: ${result.error}\n`)
      return null
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000))
    attempts++
  }
  
  console.log('\n⏰ Timeout waiting for transcription\n')
  return null
}

async function updateRecordingInDatabase(recordingId, transcriptData) {
  console.log('💾 Updating database with transcript...\n')
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/recordings?id=eq.${recordingId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      transcript_text: transcriptData.text,
      transcript_json: transcriptData,
      status: 'transcribed',
      updated_at: new Date().toISOString()
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error(`Failed to update database: ${error}`)
    return false
  }
  
  console.log('✅ Database updated successfully!\n')
  return true
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  🎤 TRANSCRIPTION TEST')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  try {
    // Step 1: Get recordings
    const recordings = await fetchRecordings()
    
    if (recordings.length === 0) {
      console.log('❌ No recordings found in database')
      console.log('💡 Make a test call first to create a recording\n')
      return
    }
    
    console.log(`Found ${recordings.length} recordings:\n`)
    recordings.forEach((rec, idx) => {
      console.log(`${idx + 1}. Recording ID: ${rec.id}`)
      console.log(`   Call ID: ${rec.call_id}`)
      console.log(`   Status: ${rec.status || 'unknown'}`)
      console.log(`   Duration: ${rec.duration || 'unknown'}s`)
      console.log(`   URL: ${rec.recording_url ? '✅ Available' : '❌ Missing'}`)
      console.log('')
    })
    
    // Step 2: Find a recording with URL
    const recordingWithUrl = recordings.find(r => r.recording_url)
    
    if (!recordingWithUrl) {
      console.log('❌ No recordings have a recording_url')
      console.log('💡 Wait for SignalWire webhook to deliver recording URL\n')
      return
    }
    
    console.log('📝 Selected recording:')
    console.log(`   ID: ${recordingWithUrl.id}`)
    console.log(`   URL: ${recordingWithUrl.recording_url}\n`)
    
    // Step 3: Submit to AssemblyAI
    const transcriptId = await submitToAssemblyAI(recordingWithUrl.recording_url)
    
    // Step 4: Poll for completion
    const transcript = await pollTranscriptStatus(transcriptId)
    
    if (!transcript) {
      console.log('❌ Transcription failed or timed out\n')
      return
    }
    
    // Step 5: Display results
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  TRANSCRIPT RESULTS')
    console.log('═══════════════════════════════════════════════════════════════\n')
    console.log(`Confidence: ${(transcript.confidence * 100).toFixed(1)}%`)
    console.log(`Word Count: ${transcript.words?.length || 0}`)
    console.log(`Duration: ${transcript.audio_duration}s\n`)
    console.log('Text:')
    console.log('─'.repeat(60))
    console.log(transcript.text)
    console.log('─'.repeat(60))
    console.log('')
    
    // Step 6: Update database
    await updateRecordingInDatabase(recordingWithUrl.id, transcript)
    
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  ✅ TEST COMPLETE')
    console.log('═══════════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('')
  }
}

main()
