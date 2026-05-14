'use client'

import { useRef, useLayoutEffect } from 'react'

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

  // line-height: 1.625 (leading-relaxed) × 16px base + vertical padding
  const minHeight = minRows * 1.625 * 16 + 24 // 24px = py-3 top+bottom

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    // Collapse to zero so scrollHeight reflects true content height
    // (setting 'auto' fights with minHeight and gives wrong reads)
    ta.style.height = '0'
    ta.style.height = ta.scrollHeight + 'px'
  }

  // useLayoutEffect runs synchronously after DOM mutations, before paint —
  // prevents the flash of incorrect height on initial load or large pastes
  useLayoutEffect(() => {
    autoResize()
  }, [value])

  function highlight(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const lines = escaped.split('\n').map(line => {
      let result = line
      // {{ai: ...}} — tempered greedy token handles nested {{field}} inside the prompt
      result = result.replace(
        /(\{\{ai:(?:(?!\}\})[^])*\}\})/g,
        '<span style="color:#c084fc">$1</span>'
      )
      // {{field}} merge fields (must come after ai blocks so inner fields aren't double-wrapped)
      result = result.replace(
        /(\{\{(?!ai:)[^}]*\}\})/g,
        '<span style="color:#60a5fa">$1</span>'
      )
      return result
    })

    return lines.join('<br>') + '&nbsp;'
  }

  return (
    <div className="rounded-lg border border-gray-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-gray-900">
      {/* overflow-hidden clips the highlight layer so it never bleeds outside the box */}
      <div className="relative overflow-hidden">
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
            overflowWrap: 'break-word',
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
