import { describe, it, expect } from 'vitest'
import { verifySignalWireSignature, verifyAssemblyAISignature } from '@/lib/webhookSecurity'
import crypto from 'crypto'

describe('Webhook Security', () => {
  describe('verifySignalWireSignature', () => {
    it('should verify valid SignalWire signature', () => {
      const payload = 'test payload'
      const authToken = 'test-token'
      // SignalWire uses HMAC-SHA1 with Base64 encoding (like Twilio)
      const signature = crypto
        .createHmac('sha1', authToken)
        .update(payload)
        .digest('base64')

      expect(verifySignalWireSignature(payload, signature, authToken)).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = 'test payload'
      const authToken = 'test-token'
      const invalidSignature = 'invalid-signature'

      expect(verifySignalWireSignature(payload, invalidSignature, authToken)).toBe(false)
    })

    it('should reject signature with wrong token', () => {
      const payload = 'test payload'
      const authToken = 'test-token'
      const wrongToken = 'wrong-token'
      // SignalWire uses HMAC-SHA1 with Base64 encoding
      const signature = crypto
        .createHmac('sha1', wrongToken)
        .update(payload)
        .digest('base64')

      expect(verifySignalWireSignature(payload, signature, authToken)).toBe(false)
    })
  })

  describe('verifyAssemblyAISignature', () => {
    it('should verify valid AssemblyAI signature', () => {
      const payload = 'test payload'
      const apiKey = 'test-api-key'
      const signature = crypto
        .createHmac('sha256', apiKey)
        .update(payload)
        .digest('hex')

      expect(verifyAssemblyAISignature(payload, signature, apiKey)).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = 'test payload'
      const apiKey = 'test-api-key'
      const invalidSignature = 'invalid-signature'

      expect(verifyAssemblyAISignature(payload, invalidSignature, apiKey)).toBe(false)
    })
  })
})
