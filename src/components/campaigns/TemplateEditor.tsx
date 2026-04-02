'use client'

import { useRef, useEffect } from 'react'

interface TemplateEditorProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
}

/**
 * A textarea with syntax-highlighted overlay for template syntax:
 *  - {{field}}   → blue
 *  - {{ai: ...}} → purple
 *  - Plain text  → white
 *
 * Auto-grows with content so no scroll-sync is needed.
 * Uses a transparent textarea over a highlight div; text selection
 * is made visible via a semi-opaque selection background.
 */
export default function TemplateEditor({ value, onChange, placeholder, minRows = 6 }: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit content
  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }

  useEffect(() => {
    autoResize()
  }, [value])

  function highlight(text: string): string {
    // Escape HTML entities before inserting as innerHTML
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Process line by line to avoid <br> interfering with regex
    const lines = escaped.split('\n').map(line => {
      let result = line
      // Color {{ai: ...}} blocks (purple)
      result = result.replace(
        /(\{\{ai:[^}]*\}\})/g,
        '<span style="color:#c084fc">$1</span>'
      )
      // Color {{field}} merge fields (blue)
      result = result.replace(
        /(\{\{(?!ai:)[^}]*\}\})/g,
        '<span style="color:#60a5fa">$1</span>'
      )
      return result
    })

    // Trailing space prevents last-line height collapse
    return lines.join('<br>') + '&nbsp;'
  }

  // line-height: 1.625 (leading-relaxed) × 16px base + vertical padding
  const minHeight = minRows * 1.625 * 16 + 24 // 24px = py-3 top+bottom

  return (
    <div className="rounded-lg border border-gray-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-gray-900">
      {/* Editor area: highlight layer + textarea stacked */}
      <div className="relative">
        {/* Highlighted background layer — same padding/font as textarea */}
        <div
          aria-hidden
          className="absolute inset-0 font-mono text-sm px-3.5 py-3 leading-relaxed whitespace-pre-wrap break-words pointer-events-none text-white"
          dangerouslySetInnerHTML={{ __html: highlight(value) }}
        />

        {/* Transparent textarea on top — drives the height */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="relative block w-full bg-transparent font-mono text-sm px-3.5 py-3 leading-relaxed outline-none placeholder-gray-600 resize-none overflow-hidden selection:bg-indigo-500/40"
          style={{
            color: 'transparent',
            caretColor: 'white',
            minHeight,
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3.5 py-2 border-t border-gray-800 text-xs text-gray-500">
        <span>
          <span style={{ color: '#60a5fa' }}>{'{{field}}'}</span>
          {' '}merge field
        </span>
        <span>
          <span style={{ color: '#c084fc' }}>{'{{ai: prompt}}'}</span>
          {' '}AI section
        </span>
      </div>
    </div>
  )
}
