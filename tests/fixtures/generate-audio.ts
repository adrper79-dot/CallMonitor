/**
 * Audio Fixture Generator for Deterministic E2E Testing
 *
 * Generates synthetic WAV audio files containing known tones for each language.
 * Each fixture has a UNIQUE frequency so tests can verify the correct file was
 * processed by checking audio characteristics downstream.
 *
 * WAV format: 16-bit PCM, mono, 16kHz (telephony standard)
 * Duration: 2 seconds per fixture
 *
 * Deterministic Properties:
 *  - Same frequency → same bytes every time (no randomness)
 *  - Checksum validation ensures fixture integrity
 *  - Language-specific frequencies allow per-language audio routing verification
 *
 * Usage:
 *   npx tsx tests/fixtures/generate-audio.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

const FIXTURES_DIR = join(__dirname, 'audio')
const SAMPLE_RATE = 16000  // 16kHz - telephony standard
const DURATION_S = 2       // 2 seconds
const BIT_DEPTH = 16       // 16-bit PCM
const NUM_CHANNELS = 1     // Mono

// ── Language → Frequency Mapping ──────────────────────────────────────────
// Each language gets a unique tone frequency so we can verify which audio
// was processed at any point in the pipeline.
const LANGUAGE_FREQUENCIES: Record<string, { hz: number; label: string }> = {
  'es': { hz: 440,  label: 'Spanish (A4)' },
  'fr': { hz: 494,  label: 'French (B4)' },
  'pt': { hz: 523,  label: 'Portuguese (C5)' },
  'de': { hz: 587,  label: 'German (D5)' },
  'it': { hz: 659,  label: 'Italian (E5)' },
  'zh': { hz: 698,  label: 'Mandarin (F5)' },
  'ja': { hz: 784,  label: 'Japanese (G5)' },
  'ar': { hz: 880,  label: 'Arabic (A5)' },
  'en': { hz: 330,  label: 'English (E4)' },
  'silence': { hz: 0, label: 'Silence (control)' },
}

/**
 * Generate a WAV file buffer with a pure sine tone at the given frequency.
 * Fully deterministic — same inputs always produce identical bytes.
 */
function generateWav(frequencyHz: number, durationSec: number): Buffer {
  const numSamples = SAMPLE_RATE * durationSec
  const dataSize = numSamples * NUM_CHANNELS * (BIT_DEPTH / 8)
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  // ── WAV Header (44 bytes) ──────────────────────────────────────────────
  buffer.write('RIFF', 0)                                    // ChunkID
  buffer.writeUInt32LE(36 + dataSize, 4)                     // ChunkSize
  buffer.write('WAVE', 8)                                    // Format
  buffer.write('fmt ', 12)                                   // Subchunk1ID
  buffer.writeUInt32LE(16, 16)                               // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20)                                // AudioFormat (PCM=1)
  buffer.writeUInt16LE(NUM_CHANNELS, 22)                     // NumChannels
  buffer.writeUInt32LE(SAMPLE_RATE, 24)                      // SampleRate
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28) // ByteRate
  buffer.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32)  // BlockAlign
  buffer.writeUInt16LE(BIT_DEPTH, 34)                        // BitsPerSample
  buffer.write('data', 36)                                   // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40)                         // Subchunk2Size

  // ── PCM Audio Data ─────────────────────────────────────────────────────
  const amplitude = 0.8 * (Math.pow(2, BIT_DEPTH - 1) - 1) // 80% max to avoid clipping
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const sample = frequencyHz === 0
      ? 0  // silence
      : Math.round(amplitude * Math.sin(2 * Math.PI * frequencyHz * t))
    buffer.writeInt16LE(sample, headerSize + i * 2)
  }

  return buffer
}

/**
 * SHA-256 checksum for determinism verification
 */
function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

// ── Main Generator ────────────────────────────────────────────────────────
function main() {
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  const manifest: Record<string, { file: string; frequency: number; sha256: string; bytes: number }> = {}

  console.log('🔊 Generating deterministic audio fixtures...')
  console.log(`   Format: WAV ${SAMPLE_RATE}Hz ${BIT_DEPTH}-bit Mono`)
  console.log(`   Duration: ${DURATION_S}s per file\n`)

  for (const [langCode, { hz, label }] of Object.entries(LANGUAGE_FREQUENCIES)) {
    const wavData = generateWav(hz, DURATION_S)
    const filename = `${langCode}-tone-${hz}hz.wav`
    const filepath = join(FIXTURES_DIR, filename)

    writeFileSync(filepath, wavData)
    const checksum = sha256(wavData)

    manifest[langCode] = {
      file: filename,
      frequency: hz,
      sha256: checksum,
      bytes: wavData.length,
    }

    console.log(`  ✅ ${label.padEnd(22)} → ${filename} (${wavData.length} bytes, SHA256: ${checksum.substring(0, 12)}...)`)
  }

  // Write manifest for tests to consume
  const manifestPath = join(FIXTURES_DIR, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\n📋 Manifest written: ${manifestPath}`)

  // Generate a multi-tone fixture (all languages interleaved) for pipeline testing
  const multiToneBuffer = generateMultiTone()
  const multiTonePath = join(FIXTURES_DIR, 'multi-lang-sequence.wav')
  writeFileSync(multiTonePath, multiToneBuffer)
  console.log(`🎵 Multi-language sequence: ${multiTonePath} (${multiToneBuffer.length} bytes)`)

  console.log(`\n✅ ${Object.keys(LANGUAGE_FREQUENCIES).length + 1} audio fixtures generated`)
}

/**
 * Generate a multi-tone WAV that plays each language tone in sequence (0.5s each).
 * Useful for testing pipeline handling of multiple language segments.
 */
function generateMultiTone(): Buffer {
  const segmentDuration = 0.5 // seconds per language
  const langs = Object.entries(LANGUAGE_FREQUENCIES).filter(([k]) => k !== 'silence')
  const totalSamples = Math.floor(SAMPLE_RATE * segmentDuration * langs.length)
  const dataSize = totalSamples * NUM_CHANNELS * (BIT_DEPTH / 8)
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  // WAV header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(NUM_CHANNELS, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28)
  buffer.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32)
  buffer.writeUInt16LE(BIT_DEPTH, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // PCM data: each language segment in sequence
  const amplitude = 0.8 * (Math.pow(2, BIT_DEPTH - 1) - 1)
  const samplesPerSegment = Math.floor(SAMPLE_RATE * segmentDuration)

  langs.forEach(([, { hz }], langIndex) => {
    for (let i = 0; i < samplesPerSegment; i++) {
      const globalIndex = langIndex * samplesPerSegment + i
      if (globalIndex >= totalSamples) break
      const t = i / SAMPLE_RATE
      const sample = Math.round(amplitude * Math.sin(2 * Math.PI * hz * t))
      buffer.writeInt16LE(sample, headerSize + globalIndex * 2)
    }
  })

  return buffer
}

main()
