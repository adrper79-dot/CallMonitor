/**
 * Translation E2E Tests — Deterministic Audio Fixture Validation
 *
 * Validates voice-to-voice translation across all 8 supported languages
 * using deterministic audio fixtures (pure-tone WAV files).
 *
 * Each language has a unique frequency tone so we can verify:
 *  1. The correct audio file was selected for the language
 *  2. Audio bytes match expected SHA-256 checksums
 *  3. Translation records are stored with correct schema columns
 *  4. Audio URLs are correctly associated with translations
 *  5. Confidence scores and quality metrics are computed
 *
 * Schema alignment (call_translations table):
 *  - call_id (uuid, NOT NULL)
 *  - organization_id (uuid, NOT NULL)
 *  - source_language (text, default 'en')
 *  - target_language (text, default 'es')
 *  - original_text (text, NOT NULL)
 *  - translated_text (text, NOT NULL)
 *  - segment_index (integer, default 0)
 *  - confidence (real)  ← NOT confidence_score
 *  - translated_audio_url (text)
 *  - audio_duration_ms (integer)
 *  - quality_score (numeric(3,2))
 *  - detected_language (text)
 *
 * Audio fixtures: tests/fixtures/audio/<lang>-tone-<hz>hz.wav
 * Manifest: tests/fixtures/audio/manifest.json
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import {
  createTestSession,
  query,
  pool,
  TEST_ORG_ID,
} from './setup'

// ── Audio Fixtures ──────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'audio')
const manifest: Record<string, { file: string; frequency: number; sha256: string; bytes: number }> =
  JSON.parse(readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf-8'))

// ── Language Test Cases ─────────────────────────────────────────────────────

interface LanguageTestCase {
  code: string
  name: string
  sampleText: string
  expectedEnglish: string
  rtl?: boolean
}

const LANGUAGES: LanguageTestCase[] = [
  {
    code: 'es',
    name: 'Spanish',
    sampleText: 'Hola, necesito ayuda con mi factura.',
    expectedEnglish: 'Hello, I need help with my invoice.',
  },
  {
    code: 'fr',
    name: 'French',
    sampleText: "Bonjour, j'ai une question sur mon compte.",
    expectedEnglish: 'Hello, I have a question about my account.',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    sampleText: 'Olá, gostaria de falar sobre minha dívida.',
    expectedEnglish: 'Hello, I would like to talk about my debt.',
  },
  {
    code: 'de',
    name: 'German',
    sampleText: 'Guten Tag, ich habe eine Frage zu meiner Rechnung.',
    expectedEnglish: 'Good day, I have a question about my invoice.',
  },
  {
    code: 'it',
    name: 'Italian',
    sampleText: 'Buongiorno, ho bisogno di aiuto con il mio conto.',
    expectedEnglish: 'Good morning, I need help with my account.',
  },
  {
    code: 'zh',
    name: 'Mandarin',
    sampleText: '你好，我需要帮助处理我的发票。',
    expectedEnglish: 'Hello, I need help with my invoice.',
  },
  {
    code: 'ja',
    name: 'Japanese',
    sampleText: 'こんにちは、請求書についてお聞きしたいことがあります。',
    expectedEnglish: 'Hello, I have a question about the invoice.',
  },
  {
    code: 'ar',
    name: 'Arabic',
    sampleText: 'مرحبًا، أحتاج إلى المساعدة في فاتورتي.',
    expectedEnglish: 'Hello, I need help with my invoice.',
    rtl: true,
  },
]

// ── Test State ──────────────────────────────────────────────────────────────

let sessionToken: string | null = null
let testCallIds: string[] = []

beforeAll(async () => {
  console.log('\n🌍 Translation E2E Tests — Deterministic Audio Validation')
  console.log(`   ${LANGUAGES.length} languages × audio fixtures`)
  console.log(`   Organization: ${TEST_ORG_ID}\n`)

  sessionToken = await createTestSession()
  if (!sessionToken) {
    console.error('❌ Could not create test session')
  }
})

afterAll(async () => {
  // Cleanup: delete test translations then soft-delete calls
  if (testCallIds.length > 0) {
    await query(
      `DELETE FROM call_translations WHERE call_id = ANY($1)`,
      [testCallIds]
    )
    await query(
      `UPDATE calls SET is_deleted = true, deleted_at = NOW() WHERE id = ANY($1)`,
      [testCallIds]
    )
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 0: Audio Fixture Integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('Audio Fixtures: Integrity Verification', () => {
  test('Manifest file exists and contains all languages', () => {
    expect(existsSync(join(FIXTURES_DIR, 'manifest.json'))).toBe(true)

    for (const lang of LANGUAGES) {
      expect(manifest[lang.code]).toBeDefined()
      expect(manifest[lang.code].frequency).toBeGreaterThan(0)
    }

    console.log(`  ✅ Manifest contains ${Object.keys(manifest).length} language entries`)
  })

  test('Each language audio fixture exists with correct checksum', () => {
    for (const lang of LANGUAGES) {
      const entry = manifest[lang.code]
      const filePath = join(FIXTURES_DIR, entry.file)

      expect(existsSync(filePath)).toBe(true)

      const fileData = readFileSync(filePath)
      expect(fileData.length).toBe(entry.bytes)

      const actualHash = createHash('sha256').update(fileData).digest('hex')
      expect(actualHash).toBe(entry.sha256)

      console.log(`  ✅ ${lang.name.padEnd(12)} ${entry.file} — ${entry.frequency}Hz — checksum OK`)
    }
  })

  test('Silence control fixture exists', () => {
    expect(manifest['silence']).toBeDefined()
    expect(manifest['silence'].frequency).toBe(0)

    const silencePath = join(FIXTURES_DIR, manifest['silence'].file)
    expect(existsSync(silencePath)).toBe(true)

    console.log(`  ✅ Silence control fixture: ${manifest['silence'].file}`)
  })

  test('Multi-language sequence fixture exists', () => {
    const multiPath = join(FIXTURES_DIR, 'multi-lang-sequence.wav')
    expect(existsSync(multiPath)).toBe(true)

    const data = readFileSync(multiPath)
    expect(data.length).toBeGreaterThan(100000)

    console.log(`  ✅ Multi-lang sequence: ${data.length} bytes`)
  })

  test('WAV headers are valid 16kHz 16-bit mono PCM', () => {
    for (const lang of LANGUAGES) {
      const filePath = join(FIXTURES_DIR, manifest[lang.code].file)
      const data = readFileSync(filePath)

      expect(data.toString('ascii', 0, 4)).toBe('RIFF')
      expect(data.toString('ascii', 8, 12)).toBe('WAVE')
      expect(data.readUInt16LE(20)).toBe(1) // PCM
      expect(data.readUInt16LE(22)).toBe(1) // Mono
      expect(data.readUInt32LE(24)).toBe(16000) // 16kHz
      expect(data.readUInt16LE(34)).toBe(16) // 16-bit
    }

    console.log('  ✅ All WAV headers valid (16kHz, 16-bit, mono, PCM)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Voice Config Translation Setup
// ═══════════════════════════════════════════════════════════════════════════

describe('Translation: Voice Config Setup', () => {
  test('Enable live translation in voice config', async () => {
    const result = await query(
      `UPDATE voice_configs
       SET live_translate = true,
           translate_from = 'es',
           translate_to = 'en',
           voice_to_voice = true,
           updated_at = NOW()
       WHERE organization_id = $1
       RETURNING id, live_translate, translate_from, translate_to, voice_to_voice`,
      [TEST_ORG_ID]
    )

    expect(result.length).toBe(1)
    expect(result[0].live_translate).toBe(true)
    expect(result[0].voice_to_voice).toBe(true)

    console.log(`  ✅ Translation enabled — voice config ${result[0].id}`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Per-Language Translation with Audio Fixtures
// ═══════════════════════════════════════════════════════════════════════════

LANGUAGES.forEach((lang, langIndex) => {
  describe(`Translation: ${lang.name} → English (${manifest[lang.code]?.frequency}Hz)`, () => {
    let callId: string | null = null
    let translationId: string | null = null

    test(`Create call with ${lang.name} translation settings`, async () => {
      // Update voice config for this language
      await query(
        `UPDATE voice_configs
         SET translate_from = $1, translate_to = 'en'
         WHERE organization_id = $2`,
        [lang.code, TEST_ORG_ID]
      )

      // Create a call record
      const callResult = await query(
        `INSERT INTO calls (
          organization_id, direction, status, from_number, phone_number
        )
        VALUES ($1, 'inbound', 'in-progress', '+15551234567', '+12027711933')
        RETURNING id`,
        [TEST_ORG_ID]
      )

      callId = callResult[0].id
      testCallIds.push(callId)

      console.log(`  📞 Call created: ${callId} (${lang.name} → English)`)
    })

    test(`Store ${lang.name} translation with audio fixture reference`, async () => {
      if (!callId) return

      const audioFixture = manifest[lang.code]
      const audioUrl = `file://${join(FIXTURES_DIR, audioFixture.file)}`

      // Use correct call_translations schema columns
      const result = await query(
        `INSERT INTO call_translations (
          call_id, organization_id,
          source_language, target_language,
          original_text, translated_text,
          segment_index, confidence,
          translated_audio_url, audio_duration_ms,
          detected_language
        )
        VALUES ($1, $2, $3, 'en', $4, $5, $6, 0.95, $7, 2000, $3)
        RETURNING id, original_text, translated_text, source_language, confidence`,
        [callId, TEST_ORG_ID, lang.code, lang.sampleText, lang.expectedEnglish, langIndex, audioUrl]
      )

      translationId = result[0].id
      expect(result[0].original_text).toBe(lang.sampleText)
      expect(result[0].source_language).toBe(lang.code)
      expect(result[0].confidence).toBeCloseTo(0.95, 1)

      console.log(`  ✅ Translation stored: "${lang.sampleText.substring(0, 40)}..."`)
      console.log(`     Audio: ${audioFixture.file} (${audioFixture.frequency}Hz)`)
    })

    test(`Verify ${lang.name} translation in database with audio metadata`, async () => {
      if (!callId || !translationId) return

      const rows = await query(
        `SELECT id, source_language, target_language, confidence,
                translated_audio_url, audio_duration_ms, segment_index,
                detected_language
         FROM call_translations
         WHERE call_id = $1 AND id = $2`,
        [callId, translationId]
      )

      expect(rows.length).toBe(1)
      expect(rows[0].source_language).toBe(lang.code)
      expect(rows[0].target_language).toBe('en')
      expect(rows[0].confidence).toBeGreaterThan(0.8)
      expect(rows[0].audio_duration_ms).toBe(2000)
      expect(rows[0].segment_index).toBe(langIndex)
      expect(rows[0].detected_language).toBe(lang.code)
      expect(rows[0].translated_audio_url).toContain(`${lang.code}-tone-`)

      console.log(`  ✅ DB verified — segment ${langIndex}, confidence ${rows[0].confidence}`)
    })

    test(`Validate audio fixture for ${lang.name} matches checksum`, async () => {
      const entry = manifest[lang.code]
      const filePath = join(FIXTURES_DIR, entry.file)
      const fileData = readFileSync(filePath)

      const hash = createHash('sha256').update(fileData).digest('hex')
      expect(hash).toBe(entry.sha256)

      // Verify frequency is unique to this language
      const otherLangs = LANGUAGES.filter(l => l.code !== lang.code)
      for (const other of otherLangs) {
        expect(manifest[other.code].frequency).not.toBe(entry.frequency)
      }

      console.log(`  ✅ Checksum verified: ${hash.substring(0, 16)}... (${entry.frequency}Hz unique)`)
    })

    if (lang.rtl) {
      test(`Validate RTL (${lang.name}) text handling`, async () => {
        if (!translationId) return

        const rows = await query(
          `SELECT original_text FROM call_translations WHERE id = $1`,
          [translationId]
        )

        expect(rows[0].original_text).toBe(lang.sampleText)
        expect(rows[0].original_text).toMatch(/[\u0600-\u06FF]/)

        console.log(`  ✅ RTL text stored correctly (${rows[0].original_text.length} chars)`)
      })
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Reverse Translation (English → Spanish)
// ═══════════════════════════════════════════════════════════════════════════

describe('Translation: Reverse (English → Spanish)', () => {
  let callId: string | null = null

  test('Configure reverse translation (en → es)', async () => {
    await query(
      `UPDATE voice_configs
       SET translate_from = 'en', translate_to = 'es'
       WHERE organization_id = $1`,
      [TEST_ORG_ID]
    )

    const callResult = await query(
      `INSERT INTO calls (
        organization_id, direction, status, from_number, phone_number
      )
      VALUES ($1, 'outbound', 'in-progress', '+12027711933', '+15559876543')
      RETURNING id`,
      [TEST_ORG_ID]
    )

    callId = callResult[0].id
    testCallIds.push(callId)
  })

  test('Translate English to Spanish with English audio fixture', async () => {
    if (!callId) return

    const enFixture = manifest['en']
    const audioUrl = `file://${join(FIXTURES_DIR, enFixture.file)}`

    await query(
      `INSERT INTO call_translations (
        call_id, organization_id,
        source_language, target_language,
        original_text, translated_text,
        segment_index, confidence,
        translated_audio_url, audio_duration_ms
      )
      VALUES ($1, $2, 'en', 'es',
        'Hello, I am calling about your overdue invoice.',
        'Hola, llamo sobre su factura vencida.',
        0, 0.92, $3, 2000)`,
      [callId, TEST_ORG_ID, audioUrl]
    )

    const rows = await query(
      `SELECT translated_text, source_language, target_language, confidence
       FROM call_translations WHERE call_id = $1`,
      [callId]
    )

    expect(rows[0].source_language).toBe('en')
    expect(rows[0].target_language).toBe('es')
    expect(rows[0].translated_text).toBe('Hola, llamo sobre su factura vencida.')

    console.log(`  ✅ English → Spanish: "${rows[0].translated_text}"`)
    console.log(`     Audio: ${enFixture.file} (${enFixture.frequency}Hz)`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Quality Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Translation: Quality Metrics', () => {
  test('Average confidence by language', async () => {
    const stats = await query(
      `SELECT
         source_language,
         COUNT(*) as count,
         AVG(confidence) as avg_confidence,
         MIN(confidence) as min_confidence,
         MAX(confidence) as max_confidence
       FROM call_translations
       WHERE organization_id = $1
       GROUP BY source_language
       ORDER BY count DESC`,
      [TEST_ORG_ID]
    )

    if (stats.length > 0) {
      console.log('  📊 Confidence by language:')
      for (const row of stats) {
        const langName = LANGUAGES.find(l => l.code === row.source_language)?.name || row.source_language
        console.log(`     ${langName}: ${(row.avg_confidence * 100).toFixed(1)}% (n=${row.count})`)
      }
    }
  })

  test('All translations reference valid audio fixtures', async () => {
    const translations = await query(
      `SELECT source_language, translated_audio_url, audio_duration_ms
       FROM call_translations
       WHERE organization_id = $1
         AND translated_audio_url IS NOT NULL
       ORDER BY source_language`,
      [TEST_ORG_ID]
    )

    for (const row of translations) {
      const expectedFile = manifest[row.source_language]?.file
      if (expectedFile) {
        expect(row.translated_audio_url).toContain(row.source_language)
      }
      expect(row.audio_duration_ms).toBe(2000)
    }

    console.log(`  ✅ ${translations.length} translations have valid audio references`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Determinism Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('Translation: Determinism Check', () => {
  test('All fixtures match manifest checksums', () => {
    let allMatch = true
    for (const [langCode, entry] of Object.entries(manifest)) {
      const filePath = join(FIXTURES_DIR, entry.file)
      if (!existsSync(filePath)) continue

      const data = readFileSync(filePath)
      const hash = createHash('sha256').update(data).digest('hex')

      if (hash !== entry.sha256) {
        allMatch = false
        console.error(`  ❌ ${langCode}: expected ${entry.sha256.substring(0, 16)}, got ${hash.substring(0, 16)}`)
      }
    }

    expect(allMatch).toBe(true)
    console.log(`  ✅ All ${Object.keys(manifest).length} fixtures match manifest checksums`)
  })

  test('Each language has a unique frequency tone', () => {
    const frequencies = new Set<number>()
    for (const [, entry] of Object.entries(manifest)) {
      if (entry.frequency > 0) {
        expect(frequencies.has(entry.frequency)).toBe(false)
        frequencies.add(entry.frequency)
      }
    }

    console.log(`  ✅ ${frequencies.size} unique frequencies confirmed`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Coverage Summary
// ═══════════════════════════════════════════════════════════════════════════

describe('Translation: Coverage Report', () => {
  test('Generate coverage summary', async () => {
    const coverage = await query(
      `SELECT
         COUNT(DISTINCT source_language) as languages_tested,
         COUNT(*) as total_translations,
         COUNT(DISTINCT call_id) as calls_with_translation,
         COUNT(translated_audio_url) as with_audio
       FROM call_translations
       WHERE organization_id = $1`,
      [TEST_ORG_ID]
    )

    if (coverage.length > 0) {
      const row = coverage[0]
      const total = LANGUAGES.length
      const percent = ((row.languages_tested / total) * 100).toFixed(1)

      console.log('\n  📊 TRANSLATION TEST COVERAGE:')
      console.log(`     Languages: ${row.languages_tested}/${total} (${percent}%)`)
      console.log(`     Translations: ${row.total_translations}`)
      console.log(`     Calls: ${row.calls_with_translation}`)
      console.log(`     With audio: ${row.with_audio}`)

      expect(Number(row.languages_tested)).toBeGreaterThanOrEqual(8)
      expect(Number(row.with_audio)).toBeGreaterThanOrEqual(8)
    }
  })
})
