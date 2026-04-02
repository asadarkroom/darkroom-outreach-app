'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, GripVertical, ArrowRight } from 'lucide-react'
import TemplateEditor from '@/components/campaigns/TemplateEditor'

interface Step {
  day_offset: number
  subject_template: string
  body_template: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [fromName, setFromName] = useState('')
  const [steps, setSteps] = useState<Step[]>([
    { day_offset: 0, subject_template: '', body_template: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addStep() {
    const lastOffset = steps[steps.length - 1]?.day_offset || 0
    setSteps(prev => [...prev, { day_offset: lastOffset + 3, subject_template: '', body_template: '' }])
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateStep(i: number, key: keyof Step, value: string | number) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Campaign name is required'); return }
    if (steps.length === 0) { setError('Add at least one sequence step'); return }
    for (const [i, s] of steps.entries()) {
      if (!s.subject_template.trim()) { setError(`Step ${i + 1} needs a subject line`); return }
      if (!s.body_template.trim()) { setError(`Step ${i + 1} needs a body`); return }
    }

    setSaving(true)
    try {
      // Create campaign
      const campRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), system_prompt: systemPrompt, from_name: fromName }),
      })
      const campaign = await campRes.json()
      if (!campRes.ok) throw new Error(campaign.error)

      // Save steps
      const stepsRes = await fetch(`/api/campaigns/${campaign.id}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steps),
      })
      if (!stepsRes.ok) throw new Error('Failed to save steps')

      router.push(`/campaigns/${campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">New Campaign</h1>
        <p className="text-gray-400 text-sm mt-1">Build your outreach sequence, then upload contacts.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Campaign settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Campaign Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Campaign Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="e.g. Coachella Brand Outreach Q2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">From Name</label>
            <input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="e.g. Alex from Darkroom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Campaign Context (for AI)
              <span className="ml-1.5 text-gray-500 font-normal text-xs">— gives Claude background on this campaign</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
              placeholder="e.g. This is outreach for a Coachella brand activation with TikTok Shop. The goal is to get a brand sponsorship commitment from consumer brands in the beauty and fashion space..."
            />
          </div>
        </div>

        {/* Sequence steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Sequence Steps</h2>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Step
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
                    <input
                      type="number"
                      value={step.day_offset}
                      onChange={e => updateStep(i, 'day_offset', parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject Line</label>
                <input
                  type="text"
                  value={step.subject_template}
                  onChange={e => updateStep(i, 'subject_template', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                  placeholder="e.g. Quick question for {{first_name}} at {{company_name}}"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Body</label>
                <TemplateEditor
                  value={step.body_template}
                  onChange={v => updateStep(i, 'body_template', v)}
                  placeholder={`Hi {{first_name}},\n\n{{ai: Write a personalized opening about their work at {{company_name}} in the {{industry}} space}}\n\nI'd love to chat about a potential partnership...\n\nBest,\n{{from_name}}`}
                  minRows={8}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Creating…' : 'Create Campaign'}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
