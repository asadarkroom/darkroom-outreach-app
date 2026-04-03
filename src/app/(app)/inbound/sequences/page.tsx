'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, Users, Power, PowerOff } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Sequence {
  id: string
  name: string
  description: string
  is_active: boolean
  sender_user_id: string | null
  users: { name: string; email: string } | null
  created_at: string
}

export default function InboundSequencesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/inbound/sequences')
    const data = await res.json()
    setSequences(data || [])
    setLoading(false)
  }

  async function toggleActive(seq: Sequence) {
    await fetch(`/api/inbound/sequences/${seq.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !seq.is_active }),
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
          <h1 className="text-xl font-semibold text-white">Inbound Sequences</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Email sequences sent to HubSpot form submissions
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/inbound/sequences/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Sequence
          </Link>
        )}
      </div>

      {sequences.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No inbound sequences yet</p>
          {isAdmin && (
            <Link
              href="/inbound/sequences/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first sequence
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
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
                  <button
                    onClick={() => toggleActive(seq)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                    title={seq.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {seq.is_active ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/inbound/sequences/${seq.id}`}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
