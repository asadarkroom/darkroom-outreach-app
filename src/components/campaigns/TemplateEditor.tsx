'use client'

interface TemplateEditorProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
}

export default function TemplateEditor({ value, onChange, placeholder, minRows = 6 }: TemplateEditorProps) {
  // line-height: 1.625 (leading-relaxed) × 16px base + vertical padding
  const minHeight = minRows * 1.625 * 16 + 24 // 24px = py-3 top+bottom

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
      // {{field}} merge fields
      result = result.replace(
        /(\{\{(?!ai:)[^}]*\}\})/g,
        '<span style="color:#60a5fa">$1</span>'
      )
      return result
    })

    // Trailing &nbsp; prevents the last line from collapsing to zero height
    return lines.join('<br>') + '&nbsp;'
  }

  return (
    <div className="rounded-lg border border-gray-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-gray-900">
      {/*
        The highlight div is in normal flow — it drives the container height via CSS,
        no JavaScript resize needed. The textarea is absolutely positioned on top so it
        always matches the container exactly, fixing both the cut-off and cursor issues.
      */}
      <div className="relative">
        {/* Highlight div — in normal flow, sets the height */}
        <div
          aria-hidden
          className="w-full font-mono text-sm px-3.5 py-3 leading-relaxed whitespace-pre-wrap break-words pointer-events-none text-white"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: highlight(value) }}
        />

        {/* Textarea — absolute overlay, stretches to match the highlight div's height */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="absolute inset-0 w-full h-full bg-transparent font-mono text-sm px-3.5 py-3 leading-relaxed outline-none placeholder-gray-600 resize-none overflow-hidden selection:bg-indigo-500/40"
          style={{
            color: 'transparent',
            caretColor: 'white',
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
