'use client'

import { useRef, useEffect, useState } from 'react'

interface TemplateEditorProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
}

/**
 * A textarea that renders a color-coded preview of the template syntax:
 *  - {{field}}   → blue
 *  - {{ai: ...}} → purple
 *  - Plain text  → white
 *
 * Implementation: we overlay a div with colored spans on top of a transparent textarea.
 */
export default function TemplateEditor({ value, onChange, placeholder, minRows = 6 }: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  function syncScroll() {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  function highlight(text: string): string {
    // Escape HTML
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')

    // Color {{ai: ...}} blocks first (greedy so nested braces work)
    const withAi = escaped.replace(
      /(\{\{ai:[\s\S]*?\}\})/g,
      '<span class="text-purple-400">$1</span>'
    )

    // Color {{field}} merge fields
    const withFields = withAi.replace(
      /(\{\{(?!ai:)[^}]+\}\})/g,
      '<span class="text-blue-400">$1</span>'
    )

    return withFields + ' ' // trailing space prevents last-line collapse
  }

  return (
    <div className="relative font-mono text-sm rounded-lg border border-gray-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 overflow-hidden bg-gray-900">
      {/* Highlighted background layer */}
      <div
        ref={highlightRef}
        aria-hidden
        className="absolute inset-0 px-3.5 py-3 text-white whitespace-pre-wrap break-words overflow-hidden pointer-events-none leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlight(value) }}
      />

      {/* Transparent textarea on top */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        rows={minRows}
        placeholder={placeholder}
        className="relative w-full bg-transparent text-transparent caret-white resize-none px-3.5 py-3 leading-relaxed outline-none placeholder-gray-600 placeholder:text-opacity-100"
        style={{ color: 'transparent', caretColor: 'white' }}
        spellCheck={false}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-3.5 py-2 border-t border-gray-800 bg-gray-900/80 text-xs text-gray-500">
        <span><span className="text-blue-400">&#123;&#123;field&#125;&#125;</span> merge field</span>
        <span><span className="text-purple-400">&#123;&#123;ai: prompt&#125;&#125;</span> AI section</span>
      </div>
    </div>
  )
}
