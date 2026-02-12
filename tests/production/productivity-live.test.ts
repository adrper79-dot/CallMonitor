import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiCall, createTestSession, cleanupTestData, TEST_ORG_ID } from './setup'

const rand = () => Math.random().toString(36).substring(2, 8)

let sessionToken: string | null = null

beforeAll(async () => {
  sessionToken = await createTestSession()
  if (!sessionToken) throw new Error('No session token available for productivity tests')
})

afterAll(async () => {
  await cleanupTestData()
})

describe('Productivity routes (live)', () => {
  it('creates, lists, updates, and deletes a note template', async () => {
    const shortcode = `/t-${rand()}`

    const createRes = await apiCall('POST', '/api/productivity/note-templates', {
      sessionToken: sessionToken!,
      body: {
        shortcode,
        title: 'Live test note',
        content: 'This is a live productivity note template',
        tags: ['test', 'productivity'],
      },
    })
    expect(createRes.status).toBe(201)
    expect(createRes.data?.template?.shortcode).toBe(shortcode)

    const listRes = await apiCall('GET', '/api/productivity/note-templates', {
      sessionToken: sessionToken!,
    })
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.data?.templates)).toBe(true)

    const createdId = createRes.data?.template?.id
    expect(createdId).toBeTruthy()

    const updateRes = await apiCall('PUT', `/api/productivity/note-templates/${createdId}`, {
      sessionToken: sessionToken!,
      body: {
        title: 'Live test note (updated)',
      },
    })
    expect(updateRes.status).toBe(200)
    expect(updateRes.data?.template?.title).toContain('updated')

    const deleteRes = await apiCall('DELETE', `/api/productivity/note-templates/${createdId}`, {
      sessionToken: sessionToken!,
    })
    expect(deleteRes.status).toBe(200)
  })

  it('creates, lists, updates, and deletes an objection rebuttal', async () => {
    const body = {
      category: 'collections',
      objection_text: 'I already paid',
      rebuttal_text: 'Let me verify your payment and confirm the balance.',
      compliance_note: 'Stay within CFPB guidelines',
    }

    const createRes = await apiCall('POST', '/api/productivity/objection-rebuttals', {
      sessionToken: sessionToken!,
      body,
    })
    expect(createRes.status).toBe(201)
    const objId = createRes.data?.rebuttal?.id
    expect(objId).toBeTruthy()

    const listRes = await apiCall('GET', '/api/productivity/objection-rebuttals', {
      sessionToken: sessionToken!,
    })
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.data?.rebuttals)).toBe(true)

    const updateRes = await apiCall('PUT', `/api/productivity/objection-rebuttals/${objId}`, {
      sessionToken: sessionToken!,
      body: { rebuttal_text: 'I can check your last payment now.' },
    })
    expect(updateRes.status).toBe(200)
    expect(updateRes.data?.rebuttal?.rebuttal_text).toContain('check')

    const deleteRes = await apiCall('DELETE', `/api/productivity/objection-rebuttals/${objId}`, {
      sessionToken: sessionToken!,
    })
    expect(deleteRes.status).toBe(200)
  })

  it('returns a daily planner payload (even if empty)', async () => {
    const res = await apiCall('GET', '/api/productivity/daily-planner', {
      sessionToken: sessionToken!,
    })
    expect(res.status).toBe(200)
    expect(res.data?.success).toBe(true)
    expect(res.data?.planner).toBeDefined()
  })
})
