import Anthropic from '@anthropic-ai/sdk'
import type { Contact } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MERGE_FIELDS: Record<string, keyof Contact> = {
  first_name: 'first_name',
  last_name: 'last_name',
  company_name: 'company_name',
  job_title: 'job_title',
  industry: 'industry',
}

/**
 * Replaces {{field}} merge tags with contact data.
 */
function applyMergeFields(template: string, contact: Contact): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    const key = MERGE_FIELDS[field]
    if (!key) return match
    return (contact[key] as string) || ''
  })
}

/**
 * Finds all {{ai: prompt}} blocks in a template, correctly handling nested
 * {{field}} merge tags inside the prompt (e.g. {{ai: write about {{company_name}}}}).
 * The naive lazy regex stops at the first }} it finds; this parser tracks depth instead.
 */
function findAiBlocks(template: string): Array<{ full: string; prompt: string }> {
  const blocks: Array<{ full: string; prompt: string }> = []
  let i = 0
  while (i < template.length) {
    const start = template.indexOf('{{ai:', i)
    if (start === -1) break
    let depth = 1
    let j = start + 2 // step past the opening {{
    while (j < template.length && depth > 0) {
      if (template[j] === '{' && template[j + 1] === '{') {
        depth++
        j += 2
      } else if (template[j] === '}' && template[j + 1] === '}') {
        depth--
        if (depth > 0) j += 2
      } else {
        j++
      }
    }
    if (depth === 0) {
      const full = template.slice(start, j + 2)
      const prompt = template.slice(start + 5, j).trim()
      blocks.push({ full, prompt })
      i = j + 2
    } else {
      i = start + 5
    }
  }
  return blocks
}

/**
 * Calls Claude to fill a single {{ai: ...}} block.
 */
async function fillAiBlock(
  prompt: string,
  contact: Contact,
  systemPrompt: string
): Promise<string> {
  const contactContext = [
    contact.first_name && `First name: ${contact.first_name}`,
    contact.last_name && `Last name: ${contact.last_name}`,
    contact.company_name && `Company: ${contact.company_name}`,
    contact.job_title && `Title: ${contact.job_title}`,
    contact.industry && `Industry: ${contact.industry}`,
    contact.website_or_linkedin && `Website/LinkedIn: ${contact.website_or_linkedin}`,
    contact.custom_notes && `Notes: ${contact.custom_notes}`,
  ]
    .filter(Boolean)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: [
      systemPrompt,
      '',
      'You are generating personalized sections of sales outreach emails.',
      'Write ONLY the requested content — no greetings, no sign-offs, no markdown, no explanation.',
      'Be concise, natural, and human-sounding. Do not add preamble or meta-commentary.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Contact information:\n${contactContext}`,
          '',
          `Write the following for this contact:\n${prompt}`,
        ].join('\n'),
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text.trim()
}

/**
 * Renders a full email template for a given contact.
 * Handles merge fields and AI-generated sections.
 */
export async function renderTemplate(
  template: string,
  contact: Contact,
  systemPrompt: string
): Promise<string> {
  // Step 1: find AI blocks before any other replacements
  const aiBlocks = findAiBlocks(template)

  let result = template

  // Step 2: fill each AI block (run sequentially to avoid rate limits)
  for (const block of aiBlocks) {
    // Resolve merge fields inside the prompt so Claude sees the actual values
    const resolvedPrompt = applyMergeFields(block.prompt, contact)
    const filled = await fillAiBlock(resolvedPrompt, contact, systemPrompt)
    result = result.replace(block.full, filled)
  }

  // Step 3: apply standard merge fields
  result = applyMergeFields(result, contact)

  return result
}

/**
 * Generic template renderer for inbound / visitor contacts.
 * Accepts an arbitrary field map instead of a Contact object.
 *
 * @param template      - Template string with {{field}} and {{ai: prompt}} tokens
 * @param fields        - Key/value merge fields (e.g. { first_name: 'John', company_name: 'Acme' })
 * @param systemPrompt  - System prompt for AI blocks
 * @param contextNotes  - Extra context passed to Claude for AI blocks (e.g. research summary)
 */
export async function renderTemplateWithFields(
  template: string,
  fields: Record<string, string>,
  systemPrompt: string,
  contextNotes = ''
): Promise<string> {
  const aiBlocks = findAiBlocks(template)
  let result = template

  for (const block of aiBlocks) {
    // Resolve merge fields inside the prompt so Claude sees the actual values
    const resolvedPrompt = block.prompt.replace(/\{\{(\w+)\}\}/g, (match, field) => fields[field] ?? match)

    const contextLines = Object.entries(fields)
      .map(([k, v]) => v ? `${k.replace(/_/g, ' ')}: ${v}` : null)
      .filter(Boolean)
      .join('\n')

    const contextSection = [contextLines, contextNotes].filter(Boolean).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: [
        systemPrompt,
        '',
        'You are generating personalized sections of sales outreach emails.',
        'Write ONLY the requested content — no greetings, no sign-offs, no markdown, no explanation.',
        'Be concise, natural, and human-sounding.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: [
            `Contact information:\n${contextSection}`,
            '',
            `Write the following for this contact:\n${resolvedPrompt}`,
          ].join('\n'),
        },
      ],
    })

    const content = message.content[0]
    const filled = content.type === 'text' ? content.text.trim() : ''
    result = result.replace(block.full, filled)
  }

  // Apply merge fields
  result = result.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return fields[field] ?? match
  })

  return result
}

/**
 * Preview a template with a specific contact — returns subject + body.
 */
export async function previewTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  contact: Contact,
  systemPrompt: string
): Promise<{ subject: string; body: string }> {
  const [subject, body] = await Promise.all([
    renderTemplate(subjectTemplate, contact, systemPrompt),
    renderTemplate(bodyTemplate, contact, systemPrompt),
  ])
  return { subject, body }
}
