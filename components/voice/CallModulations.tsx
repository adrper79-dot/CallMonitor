"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

export type ModKey = 'record' | 'transcribe' | 'translate' | 'survey' | 'synthetic_caller'

export interface CallModulationsProps {
  callId: string
  initialModulations: Record<ModKey, boolean>
  onChange: (mods: Record<ModKey, boolean>) => Promise<void>
}

const TOGGLES: { key: ModKey; label: string; desc: string }[] = [
  { key: 'record', label: 'Recording', desc: 'Capture call audio' },
  { key: 'transcribe', label: 'Transcribe', desc: 'Generate transcript' },
  { key: 'translate', label: 'Translate', desc: 'Translate transcript' },
  { key: 'survey', label: 'After-call Survey', desc: 'Run after-call survey' },
  { key: 'synthetic_caller', label: 'Synthetic Caller', desc: 'Use synthetic caller voice for tests' }
]

export default function CallModulations({ callId, initialModulations, onChange }: CallModulationsProps) {
  const [mods, setMods] = useState<Record<ModKey, boolean>>(() => ({ ...initialModulations }))
  const [pending, setPending] = useState<Record<ModKey, boolean>>(() => ({ record: false, transcribe: false, translate: false, survey: false, synthetic_caller: false }))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMods({ ...initialModulations })
  }, [initialModulations])

  // gating example: replace with real capability check
  const canUseSynthetic = false

  async function handleToggle(key: ModKey) {
    setError(null)
    const prev = { ...mods }
    const next = { ...mods, [key]: !mods[key] }
    // optimistic UI
    setMods(next)
    setPending(p => ({ ...p, [key]: true }))
    try {
      await onChange(next)
    } catch (e: any) {
      // rollback
      setMods(prev)
      setError(e?.message ?? 'Update failed')
    } finally {
      setPending(p => ({ ...p, [key]: false }))
    }
  }

  return (
    <section aria-labelledby={`call-modulations-${callId}`} className="w-full p-4 bg-slate-950 rounded-md">
      <div className="flex items-center justify-between">
        <h3 id={`call-modulations-${callId}`} className="text-lg font-medium text-slate-100">Call Modulations</h3>
        <p className="text-sm text-slate-400">Preview (modulations only — no writes)</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {TOGGLES.map(t => {
          const isDisabled = t.key === 'synthetic_caller' && !canUseSynthetic
          return (
            <div key={t.key} className="flex items-center justify-between p-2 rounded-md bg-slate-800 hover:bg-slate-700">
              <div className="flex flex-col">
                <Label className="text-sm text-slate-100">{t.label}</Label>
                <span className="text-xs text-slate-400">{t.desc}</span>
              </div>

              <div className="flex items-center gap-3">
                {isDisabled ? (
                  <Tooltip content="Requires elevated permissions">
                    <div>
                      <button
                        role="switch"
                        aria-checked={!!mods[t.key]}
                        aria-label={t.label}
                        tabIndex={0}
                        disabled
                        className="inline-flex items-center h-7 w-12 rounded-full p-1 bg-gray-700 opacity-60 cursor-not-allowed"
                      >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white transform ${mods[t.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </Tooltip>
                ) : (
                  <button
                    role="switch"
                    aria-checked={!!mods[t.key]}
                    aria-label={t.label}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!pending[t.key]) handleToggle(t.key) } }}
                    onClick={() => { if (!pending[t.key]) handleToggle(t.key) }}
                    className={`inline-flex items-center h-7 w-12 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${mods[t.key] ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white transform transition-transform ${mods[t.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                )}

                <div className="text-xs text-slate-400 w-12 text-right">
                  {pending[t.key] ? <span aria-live="polite">Updating…</span> : (mods[t.key] ? 'On' : 'Off')}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error ? <div role="status" aria-live="assertive" className="mt-3 text-sm text-red-400">{error}</div> : null}

      <div className="mt-4 text-right">
        <Button variant="ghost" size="sm" onClick={() => setMods({ ...initialModulations })} className="text-xs">Reset Preview</Button>
      </div>
    </section>
  )
}
