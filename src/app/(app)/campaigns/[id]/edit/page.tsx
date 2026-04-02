'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react'
import TemplateEditor from '@/components/campaigns/TemplateEditor'

interface Step {
  id?: string
  step_number: number
  day_offset: number
  subject_template: string
  body_template: string
}

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [fromName, setFromName] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}`).then(r => r.json()),
      fetch(`/api/campaigns/${id}/steps`).then(r => r.json()),
    ]).then(([c, s]) => {
      setName(c.name || '')
      setSystemPrompt(c.system_prompt || '')
      setFromName(c.from_name || '')
      setSteps(Array.isArray(s) ? s : [])
    }).finally(() => setLoading(false))
  }, [id])

  function addStep() {
    const last = steps[steps.length - 1]
    setSteps(prev => [...prev, {
      step_number: prev.length + 1,
      day_offset: (last?.day_offset || 0) + 3,
      subject_template: '',
      body_template: '',
    }])
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })))
  }

  function updateStep(i: number, key: keyof Step, value: string | number) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: value } : s))
  }

  async function save() {
    setError('')
    if (!name.trim()) { setError('Campaign name required'); return }
    setSaving(true)
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), system_prompt: systemPrompt, from_name: fromName }),
      })
      await fetch(`/api/campaigns/${id}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steps),
      })
      router.push(`/campaigns/${id}`)
    } catch {
      setError('Failed to save changes')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-gray-800 animate-pulse rounded" />
        <div className="h-48 bg-gray-800 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-white">Edit Campaign</h1>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-8">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Campaign Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">From Name</label>
            <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="e.g. Alex from Darkroom" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Campaign Context (AI)</label>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Sequence Steps</h2>
            <button onClick={addStep} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              <Plus className="w-4 h-4" />Add Step
            </button>
          </div>

          {steps.map((step, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-white">Step {i + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Day offset:</label>
                    <input type="number" value={step.day_offset} onChange={e => updateStep(i, 'day_offset', parseInt(e.target.value) || 0)} min={0}
                      className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center" />
                  </div>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject Line</label>
                <input type="text" value={step.subject_template} onChange={e => updateStep(i, 'subject_template', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Body</label>
                <TemplateEditor value={step.body_template} onChange={v => updateStep(i, 'body_template', v)} minRows={8} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
