'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import dynamic from 'next/dynamic'

const TemplateEditor = dynamic(() => import('@/components/campaigns/TemplateEditor'), { ssr: false })

interface Step {
  id?: string
  step_number: number
  step_type: 'email' | 'linkedin'
  day_offset: number
  subject_template: string
  body_template: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Sequence {
  id: string
  name: string
  description: string
  system_prompt: string
  sender_user_id: string | null
  auto_send: boolean
  is_active: boolean
}

export default function VisitorSequenceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const router = useRouter()

  const [sequence, setSequence] = useState<Sequence>({
    id: '', name: '', description: '', system_prompt: '',
    sender_user_id: null, auto_send: true, is_active: true,
  })
  const [steps, setSteps] = useState<Step[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d || [])).catch(() => {})

    if (!isNew) {
      Promise.all([
        fetch(`/api/visitors/sequences/${id}`).then(r => r.json()),
        fetch(`/api/visitors/sequences/${id}/steps`).then(r => r.json()),
      ]).then(([seq, stps]) => {
        setSequence(seq)
        setSteps(stps || [])
        setLoading(false)
      })
    }
  }, [id, isNew])

  function addStep() {
    const maxOffset = steps.length > 0 ? Math.max(...steps.map(s => s.day_offset)) : 0
    setSteps([...steps, {
      step_number: steps.length + 1,
      step_type: 'email',
      day_offset: maxOffset + (steps.length === 0 ? 0 : 3),
      subject_template: '',
      body_template: '',
    }])
    setActiveStep(steps.length)
  }

  function removeStep(idx: number) {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 }))
    setSteps(updated)
    setActiveStep(Math.min(activeStep, updated.length - 1))
  }

  function updateStep(idx: number, field: keyof Step, value: string | number) {
    setSteps(steps.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      let seqId = id

      if (isNew) {
        const res = await fetch('/api/visitors/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sequence),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
        const created = await res.json()
        seqId = created.id
      } else {
        const res = await fetch(`/api/visitors/sequences/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sequence),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      }

      await fetch(`/api/visitors/sequences/${seqId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })

      router.push('/web-visitors/sequences')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentStep = steps[activeStep]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/web-visitors/sequences" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1">
          {isNew ? 'New Visitor Sequence' : `Edit: ${sequence.name}`}
        </h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-white">Sequence Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Sequence Name</label>
            <input
              value={sequence.name}
              onChange={e => setSequence({ ...sequence, name: e.target.value })}
              placeholder="e.g. Web Visitor Outreach"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Sender (Gmail Account)</label>
            <select
              value={sequence.sender_user_id || ''}
              onChange={e => setSequence({ ...sequence, sender_user_id: e.target.value || null })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select sender —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Description</label>
          <input
            value={sequence.description}
            onChange={e => setSequence({ ...sequence, description: e.target.value })}
            placeholder="Optional"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">AI System Prompt</label>
          <textarea
            value={sequence.system_prompt}
            onChange={e => setSequence({ ...sequence, system_prompt: e.target.value })}
            rows={3}
            placeholder="e.g. You are Asa at Darkroom, a performance marketing agency..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sequence.auto_send}
              onChange={e => setSequence({ ...sequence, auto_send: e.target.checked })}
              className="rounded border-gray-600"
            />
            <span className="text-sm text-gray-400">
              Auto-send emails{' '}
              <span className="text-gray-600">(uncheck to create Gmail drafts instead)</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sequence.is_active}
              onChange={e => setSequence({ ...sequence, is_active: e.target.checked })}
              className="rounded border-gray-600"
            />
            <span className="text-sm text-gray-400">Active</span>
          </label>
        </div>
      </div>

      {/* Steps Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-white">Sequence Steps</h2>
          <button
            onClick={addStep}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No steps yet.</p>
          </div>
        ) : (
          <div className="flex">
            <div className="w-48 border-r border-gray-800 flex-shrink-0">
              {steps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    activeStep === idx ? 'bg-indigo-900/30 text-indigo-300' : 'text-gray-400 hover:bg-gray-800/50'
                  }`}
                >
                  <p className="text-xs font-medium">Step {step.step_number}</p>
                  <p className="text-xs opacity-60 mt-0.5">Day {step.day_offset} · {step.step_type}</p>
                </button>
              ))}
            </div>

            {currentStep && (
              <div className="flex-1 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">Step {currentStep.step_number}</h3>
                  <button
                    onClick={() => removeStep(activeStep)}
                    className="p-1.5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Step Type</label>
                    <select
                      value={currentStep.step_type}
                      onChange={e => updateStep(activeStep, 'step_type', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="email">Email</option>
                      <option value="linkedin">LinkedIn (manual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Day Offset</label>
                    <input
                      type="number"
                      min={0}
                      value={currentStep.day_offset}
                      onChange={e => updateStep(activeStep, 'day_offset', parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {currentStep.step_type === 'email' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Subject</label>
                      <input
                        value={currentStep.subject_template}
                        onChange={e => updateStep(activeStep, 'subject_template', e.target.value)}
                        placeholder="ideas to drive growth at {{company_name}}"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Body</label>
                      <TemplateEditor
                        value={currentStep.body_template}
                        onChange={val => updateStep(activeStep, 'body_template', val)}
                        placeholder={'Hi {{first_name}},\n\n...\n\nAsa'}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Merge fields: {'{{first_name}}'}, {'{{company_name}}'}, {'{{industry}}'}, {'{{visited_page}}'} · AI: {'{{ai: write a custom hook}}'}
                    </p>
                  </>
                )}

                {currentStep.step_type === 'linkedin' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">LinkedIn Message (shown as manual reminder)</label>
                    <TemplateEditor
                      value={currentStep.body_template}
                      onChange={val => updateStep(activeStep, 'body_template', val)}
                      placeholder={'Hey {{first_name}}, quick note to connect...'}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
