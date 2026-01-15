#!/usr/bin/env node
/**
 * Test Transcription with SignalWire Recording
 * 
 * This script:
 * 1. Fetches recordings from the database
 * 2. Downloads recording from SignalWire (with auth)
 * 3. Uploads to Supabase Storage (publicly accessible)
 * 4. Submits public URL to AssemblyAI
 * 5. Monitors transcription progress
 * 6. Updates database with results
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID
const SIGNALWIRE_AUTH_TOKEN = process.env.SIGNALWIRE_AUTH_TOKEN

// Validate environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE environment variables')
  process.exit(1)
}

if (!ASSEMBLYAI_API_KEY) {
  console.error('❌ Missing ASSEMBLYAI_API_KEY')
  process.exit(1)
}

if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_AUTH_TOKEN) {
  console.error('❌ Missing SIGNALWIRE credentials (PROJECT_ID, AUTH_TOKEN)')
  process.exit(1)
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fetchRecordings() {
  console.log('🔍 Fetching recordings from database...\n')
  
  const { data: recordings, error } = await supabase
    .from('recordings')
    .select('id, call_sid, recording_url, recording_sid, status, duration_seconds, created_at, organization_id')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    throw new Error(`Failed to fetch recordings: ${error.message}`)
  }
  
  return recordings || []
}

async function downloadFromSignalWire(recordingUrl, outputPath) {
  console.log('📥 Downloading from SignalWire (with auth)...')
  
  // Create Basic Auth header
  const auth = Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_AUTH_TOKEN}`).toString('base64')
  
  const response = await fetch(recordingUrl, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  })
  
  if (!response.ok) {
    throw new Error(`SignalWire download failed: ${response.status} ${response.statusText}`)
  }
  
  // Get file as buffer
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // Save to temp file
  fs.writeFileSync(outputPath, buffer)
  
  console.log(`✅ Downloaded: ${buffer.length} bytes`)
  return buffer
}

async function uploadToSupabaseStorage(buffer, recordingId, orgId) {
  console.log('📤 Uploading to Supabase Storage...')
  
  const fileName = `${recordingId}.wav`
  const filePath = `recordings/${orgId}/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('call-recordings')
    .upload(filePath, buffer, {
      contentType: 'audio/wav',
      upsert: true
    })
  
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('call-recordings')
    .getPublicUrl(filePath)
  
  console.log(`✅ Uploaded to: ${urlData.publicUrl}\n`)
  return urlData.publicUrl
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

async function updateRecordingInDatabase(recordingId, transcriptData, publicUrl) {
  console.log('💾 Updating database with transcript...\n')
  
  const { data, error } = await supabase
    .from('recordings')
    .update({
      recording_url: publicUrl, // Update to public Supabase URL
      transcript_text: transcriptData.text,
      transcript_json: transcriptData,
      status: 'transcribed',
      updated_at: new Date().toISOString()
    })
    .eq('id', recordingId)
    .select()
  
  if (error) {
    console.error(`Failed to update database: ${error.message}`)
    return false
  }
  
  console.log('✅ Database updated successfully!\n')
  return true
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  🎤 TRANSCRIPTION TEST (with SignalWire Auth)')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  const tempDir = path.join(__dirname, '.temp')
  let tempFilePath = null
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }
    
    // Step 1: Get recordings
    const recordings = await fetchRecordings()
    
    if (recordings.length === 0) {
      console.log('❌ No recordings found in database')
      console.log('💡 Make a test call first to create a recording\n')
      return
    }
    
    console.log(`Found ${recordings.length} recordings:\n`)
    recordings.forEach((rec, idx) => {
      console.log(`${idx + 1}. Recording ID: ${rec.id.substring(0, 8)}...`)
      console.log(`   Call SID: ${rec.call_sid}`)
      console.log(`   Status: ${rec.status || 'unknown'}`)
      console.log(`   Duration: ${rec.duration_seconds || 'unknown'}s`)
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
    console.log(`   SignalWire URL: ${recordingWithUrl.recording_url}\n`)
    
    // Step 3: Download from SignalWire
    tempFilePath = path.join(tempDir, `${recordingWithUrl.id}.wav`)
    const buffer = await downloadFromSignalWire(recordingWithUrl.recording_url, tempFilePath)
    
    // Step 4: Upload to Supabase Storage (publicly accessible)
    const publicUrl = await uploadToSupabaseStorage(
      buffer, 
      recordingWithUrl.id, 
      recordingWithUrl.organization_id
    )
    
    // Step 5: Submit to AssemblyAI
    const transcriptId = await submitToAssemblyAI(publicUrl)
    
    // Step 6: Poll for completion
    const transcript = await pollTranscriptStatus(transcriptId)
    
    if (!transcript) {
      console.log('❌ Transcription failed or timed out\n')
      return
    }
    
    // Step 7: Display results
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
    
    // Step 8: Update database
    await updateRecordingInDatabase(recordingWithUrl.id, transcript, publicUrl)
    
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  ✅ TEST COMPLETE')
    console.log('═══════════════════════════════════════════════════════════════\n')
    console.log('📦 Recording now stored in Supabase Storage (publicly accessible)')
    console.log('📝 Transcript saved to database')
    console.log('')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('')
  } finally {
    // Cleanup temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
      console.log('🧹 Cleaned up temporary file\n')
    }
  }
}

main()
