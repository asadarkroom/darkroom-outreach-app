'use client'

import { useEffect, useState } from 'react'
import { Mail, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface GmailStatus {
  connected: boolean
  email?: string
  connected_at?: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/gmail/status')
      .then(r => r.json())
      .then(setGmailStatus)
      .finally(() => setLoading(false))
  }, [])

  async function disconnect() {
    if (!confirm('Disconnect your Gmail account? Draft generation will stop working until you reconnect.')) return
    setDisconnecting(true)
    await fetch('/api/gmail/disconnect', { method: 'POST' })
    setGmailStatus({ connected: false })
    setDisconnecting(false)
  }

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account and integrations</p>
      </div>

      {/* Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-white">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-600/30 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-semibold text-lg flex-shrink-0">
            {session?.user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{session?.user?.name}</p>
            <p className="text-gray-400 text-sm">{session?.user?.email}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 bg-gray-800 text-gray-400 border border-gray-700">
              {session?.user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Gmail */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-red-900/30 border border-red-700/30 flex items-center justify-center">
            <Mail className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Gmail Connection</h2>
            <p className="text-xs text-gray-400">Used to create email drafts in your inbox</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking connection status…
          </div>
        ) : gmailStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-green-300 text-sm font-medium">Connected</p>
                <p className="text-green-400/70 text-xs">{gmailStatus.email}</p>
                {gmailStatus.connected_at && (
                  <p className="text-green-400/50 text-xs mt-0.5">
                    Since {new Date(gmailStatus.connected_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/api/gmail/connect"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reconnect
              </a>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
              >
                {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-yellow-300 text-sm font-medium">Not connected</p>
                <p className="text-yellow-400/70 text-xs">Connect Gmail to enable automatic draft generation</p>
              </div>
            </div>
            <a
              href="/api/gmail/connect"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Connect Gmail Account
            </a>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Permissions requested:</p>
              <ul className="ml-4 space-y-0.5">
                <li>• Compose emails (gmail.compose)</li>
                <li>• Read emails (gmail.readonly)</li>
                <li>• Modify emails — detect replies (gmail.modify)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
