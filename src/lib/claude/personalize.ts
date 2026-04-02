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
 * Finds all {{ai: prompt}} blocks in a template.
 */
function findAiBlocks(template: string): Array<{ full: string; prompt: string }> {
  const regex = /\{\{ai:\s*([\s\S]*?)\}\}/g
  const blocks: Array<{ full: string; prompt: string }> = []
  let match
  while ((match = regex.exec(template)) !== null) {
    blocks.push({ full: match[0], prompt: match[1].trim() })
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
    const filled = await fillAiBlock(block.prompt, contact, systemPrompt)
    result = result.replace(block.full, filled)
  }

  // Step 3: apply standard merge fields
  result = applyMergeFields(result, contact)

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
