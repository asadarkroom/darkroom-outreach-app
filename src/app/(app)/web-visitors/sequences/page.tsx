'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, Power, PowerOff, Send, FileText } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Sequence {
  id: string
  name: string
  description: string
  is_active: boolean
  auto_send: boolean
  sender_user_id: string | null
  users: { name: string; email: string } | null
}

export default function VisitorSequencesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/visitors/sequences')
    const data = await res.json()
    setSequences(data || [])
    setLoading(false)
  }

  async function toggleField(seq: Sequence, field: 'is_active' | 'auto_send') {
    await fetch(`/api/visitors/sequences/${seq.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !seq[field] }),
    })
    load()
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Web Visitor Sequences</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sequences for outreach to web visitors from the Google Sheet feed
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/web-visitors/sequences/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Sequence
          </Link>
        )}
      </div>

      {sequences.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 font-medium">No visitor sequences yet</p>
          <p className="text-gray-600 text-sm mt-1">A default sequence will be seeded when you run the migration.</p>
          {isAdmin && (
            <Link
              href="/web-visitors/sequences/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create sequence
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => (
            <div key={seq.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${seq.is_active ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <div>
                    <p className="font-medium text-white text-sm">{seq.name}</p>
                    <p className="text-xs text-gray-500">
                      {seq.description || 'No description'}
                      {seq.users && ` · Sender: ${seq.users.name}`}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {/* Auto-send toggle */}
                    <button
                      onClick={() => toggleField(seq, 'auto_send')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        seq.auto_send
                          ? 'bg-green-900/30 border-green-700/50 text-green-400 hover:bg-green-900/50'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700'
                      }`}
                      title={seq.auto_send ? 'Auto-send ON — click to switch to drafts' : 'Draft mode — click to enable auto-send'}
                    >
                      {seq.auto_send ? <Send className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      {seq.auto_send ? 'Auto-send' : 'Drafts'}
                    </button>
                    <button
                      onClick={() => toggleField(seq, 'is_active')}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
                      title={seq.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {seq.is_active ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/web-visitors/sequences/${seq.id}`}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
