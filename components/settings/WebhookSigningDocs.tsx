'use client'

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'

/**
 * WebhookSigningDocs Component
 *
 * Displays documentation for webhook signature verification
 * Provides code examples for different languages
 */
export function WebhookSigningDocs() {
  const [selectedLanguage, setSelectedLanguage] = useState<'node' | 'python' | 'go' | 'php'>('node')

  const codeExamples = {
    node: `// Node.js Example
const crypto = require('crypto')

function verifyWebhookSignature(payload, signature, secret) {
  // Create HMAC-SHA256 hash of payload
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const computed = hmac.digest('hex')

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  )
}

// Express.js example
app.post('/webhooks/word-is-bond', (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const secret = process.env.WEBHOOK_SECRET // From Word Is Bond dashboard
  const rawBody = JSON.stringify(req.body)

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Process webhook event
  const { event, data } = req.body
  console.log('Received event:', event, data)

  res.json({ received: true })
})`,
    python: `# Python Example
import hmac
import hashlib

def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """
    Verify webhook signature using HMAC-SHA256
    """
    # Create HMAC-SHA256 hash
    computed = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(signature, computed)

# Flask example
from flask import Flask, request, jsonify
import os

app = Flask(__name__)

@app.route('/webhooks/word-is-bond', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    secret = os.environ['WEBHOOK_SECRET']  # From Word Is Bond dashboard
    raw_body = request.get_data(as_text=True)

    if not verify_webhook_signature(raw_body, signature, secret):
        return jsonify({'error': 'Invalid signature'}), 401

    # Process webhook event
    event_data = request.json
    print(f"Received event: {event_data['event']}")

    return jsonify({'received': True})`,
    go: `// Go Example
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "crypto/subtle"
    "encoding/hex"
    "encoding/json"
    "io"
    "net/http"
    "os"
)

func verifyWebhookSignature(payload, signature, secret string) bool {
    // Create HMAC-SHA256 hash
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(payload))
    computed := hex.EncodeToString(h.Sum(nil))

    // Constant-time comparison
    return subtle.ConstantTimeCompare(
        []byte(signature),
        []byte(computed),
    ) == 1
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-Webhook-Signature")
    secret := os.Getenv("WEBHOOK_SECRET") // From Word Is Bond dashboard

    // Read raw body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Failed to read body", http.StatusBadRequest)
        return
    }

    // Verify signature
    if !verifyWebhookSignature(string(body), signature, secret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }

    // Parse JSON
    var event map[string]interface{}
    if err := json.Unmarshal(body, &event); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    // Process webhook event
    // ...

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]bool{"received": true})
}`,
    php: `<?php
// PHP Example

function verifyWebhookSignature($payload, $signature, $secret) {
    // Create HMAC-SHA256 hash
    $computed = hash_hmac('sha256', $payload, $secret);

    // Constant-time comparison
    return hash_equals($signature, $computed);
}

// Example webhook handler
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$secret = getenv('WEBHOOK_SECRET'); // From Word Is Bond dashboard
$rawBody = file_get_contents('php://input');

if (!verifyWebhookSignature($rawBody, $signature, $secret)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Parse JSON
$event = json_decode($rawBody, true);

// Process webhook event
error_log("Received event: " . $event['event']);

// Return success
header('Content-Type: application/json');
echo json_encode(['received' => true]);
?>`,
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Webhook Security</h3>
            <p className="text-sm text-gray-500 mt-1">
              Verify webhooks using HMAC-SHA256 signatures
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            All webhook requests from Word Is Bond include an{' '}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
              X-Webhook-Signature
            </code>{' '}
            header containing an HMAC-SHA256 signature of the request body.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Word Is Bond creates HMAC-SHA256 hash of the webhook payload using your secret
              </li>
              <li>
                The hash is sent in the{' '}
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                  X-Webhook-Signature
                </code>{' '}
                header
              </li>
              <li>Your server computes the same hash using your secret</li>
              <li>Compare the hashes using constant-time comparison to prevent timing attacks</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Implementation Examples</h3>

        {/* Language Selector */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'node', label: 'Node.js' },
            { id: 'python', label: 'Python' },
            { id: 'go', label: 'Go' },
            { id: 'php', label: 'PHP' },
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLanguage(lang.id as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedLanguage === lang.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Code Block */}
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-x-auto text-sm">
            <code>{codeExamples[selectedLanguage]}</code>
          </pre>
          <button
            onClick={() => copyToClipboard(codeExamples[selectedLanguage])}
            className="absolute top-3 right-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-md transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Best Practices</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Always verify signatures</strong> - Never process
              webhooks without signature verification
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Use constant-time comparison</strong> - Prevents
              timing attacks on signature verification
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Store secrets securely</strong> - Keep webhook
              secrets in environment variables or secret managers
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Return 2xx quickly</strong> - Process webhooks
              asynchronously to avoid timeouts
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Implement idempotency</strong> - Use{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">event_id</code>{' '}
              to deduplicate events
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong className="text-gray-900">Monitor delivery logs</strong> - Track failed
              deliveries and investigate errors
            </span>
          </li>
        </ul>
      </div>

      {/* Payload Structure */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Payload Structure</h3>
        <div className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-x-auto">
          <pre className="text-sm">
            <code>{`{
  "event": "call.completed",
  "event_id": "evt_abc123def456",
  "timestamp": "2026-02-06T14:32:15Z",
  "organization_id": "org_xyz789",
  "data": {
    "call_id": "call_abc123",
    "status": "completed",
    "duration_seconds": 180,
    "recording_url": "https://...",
    "transcript_available": true
  }
}`}</code>
          </pre>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Troubleshooting</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Signature verification fails</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
              <li>
                Ensure you&apos;re using the exact raw request body (no parsing or modification)
              </li>
              <li>Verify you&apos;re using the correct secret from your webhook configuration</li>
              <li>Check that you&apos;re using HMAC-SHA256 (not SHA256 alone)</li>
              <li>Make sure you&apos;re using hexadecimal encoding for the computed hash</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Webhooks timing out</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
              <li>Return 200 response quickly (within 5 seconds)</li>
              <li>Process webhook data asynchronously using a queue</li>
              <li>Avoid blocking operations in the webhook handler</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Missing events</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
              <li>Check delivery logs in the webhooks settings page</li>
              <li>Verify your endpoint is publicly accessible (no firewalls blocking)</li>
              <li>Ensure your webhook subscription is active</li>
              <li>Verify you&apos;re subscribed to the correct event types</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
