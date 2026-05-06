/**
 * Qualify an inbound lead and generate a tier-appropriate first response
 * plus a follow-up cadence.
 *
 * Tiers:
 *   good_fit    — services align, budget $30k+/mo → send meeting-request email
 *   questionable — budget unclear or $10-30k, services plausible → clarifying email
 *   not_fit     — wrong services (B2B/SEO-only) or stated budget clearly <$10k → disqualify
 */

import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type LeadTier = 'good_fit' | 'questionable' | 'not_fit' | 'unassessed'

export interface CadenceItem {
  id: string
  type: 'email' | 'call' | 'text'
  day_offset: number
  title: string
  body: string
  status: 'pending' | 'done' | 'skipped'
  done_at?: string
}

export interface QualificationResult {
  tier: LeadTier
  research_summary: string
  disqualify_reason?: string
  first_response_subject?: string
  first_response_body?: string
  cadence: CadenceItem[]
}

export async function qualifyInboundLead(params: {
  contactName: string
  companyName: string | null
  servicesInterested: string | null
  mediaBudget: string | null
  inquiryType: string | null
  pageUrl: string | null
}): Promise<QualificationResult> {
  const { contactName, companyName, servicesInterested, mediaBudget, inquiryType, pageUrl } = params

  const calendlyUrl = process.env.CALENDLY_URL || '[CALENDLY_LINK]'
  const senderName = process.env.SENDER_NAME || 'Asa'
  const agencyName = 'Darkroom'

  const leadContext = [
    `Name: ${contactName}`,
    companyName ? `Company: ${companyName}` : null,
    servicesInterested ? `Services interested in: ${servicesInterested}` : null,
    mediaBudget ? `Stated media/ad budget: ${mediaBudget}` : null,
    inquiryType ? `Inquiry type: ${inquiryType}` : null,
    pageUrl ? `Form submitted from: ${pageUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `
You are ${senderName} at ${agencyName}, a performance marketing agency for consumer brands.

${agencyName} specializes in:
- Paid media (Meta, Google, TikTok, Amazon advertising)
- Creative production (video, photo, UGC content)
- TikTok Shop & Amazon channel management
- Lifecycle / email & SMS marketing
- Full-funnel growth strategy

MINIMUM INVESTMENT: Brands need to be spending $30k+/month in media to get meaningful results with ${agencyName}.

BUDGET CLASSIFICATION:
- $30k+/month → good_fit
- $10k–$30k/month → questionable
- Under $10k/month → not_fit
- Budget not stated or vague → questionable (unless other signals clearly disqualify)

SERVICES FIT:
- Good: paid media, performance marketing, growth, ecommerce, DTC, creative, TikTok, Amazon, email/SMS
- Not fit: B2B SaaS with no consumer product, SEO-only, web development, PR only, government, nonprofit

TIER RULES:
- good_fit: Services are a clear match AND budget signals $30k+. Ready to book a meeting.
- questionable: Services could be a match but budget is unclear, low-ish ($10-30k), or not stated. Need clarification.
- not_fit: Wrong category of business (B2B, agency, etc.) OR explicitly stated budget under $10k.

LEAD DETAILS:
${leadContext}

INSTRUCTIONS:

For good_fit: Write a warm, personalized first email from ${senderName} asking for a call. Reference what they told us. Include the booking link: ${calendlyUrl}. Keep it concise — 3-4 short paragraphs max. No fluff, no corporate speak.

For questionable: Write a warm email that acknowledges their inquiry, briefly explains that ${agencyName} typically works with brands investing $30k+/mo in media, and asks them to confirm if that fits their plans. Phrase it as giving them an easy out ("totally understand if that's not the right fit right now") but also a clear path forward. Keep it short.

For not_fit: Do not generate a first response. Just explain why in disqualify_reason.

CADENCE (for good_fit and questionable only — exclude day 0 which is the first email):
Generate a realistic follow-up cadence with specific call talking points, text messages, and follow-up emails. Use real names and be specific. Vary the day offsets so they feel natural, not robotic.

For good_fit cadence (6-8 touch points over ~2 weeks):
- Day 1: phone call (specific talking points)
- Day 2: text (if they have a phone number)
- Day 4-5: follow-up email if no reply
- Day 7-8: phone call
- Day 10-11: final email ("breaking up")

For questionable cadence (4-5 touch points):
- Day 3: follow-up email if they haven't clarified
- Day 5: phone call
- Day 8: final short email

Respond with ONLY raw JSON (no markdown, no code fences):
{
  "tier": "good_fit" | "questionable" | "not_fit",
  "research_summary": "2-3 sentences about who this person/company is and why they are/aren't a fit",
  "disqualify_reason": "string — only include if tier is not_fit",
  "first_response_subject": "string — omit if not_fit",
  "first_response_body": "string — omit if not_fit",
  "cadence": [
    {
      "id": "1",
      "type": "email" | "call" | "text",
      "day_offset": 1,
      "title": "short label (e.g. 'Follow-up call')",
      "body": "full talking points or message body",
      "status": "pending"
    }
  ]
}
`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean) as {
      tier: LeadTier
      research_summary: string
      disqualify_reason?: string
      first_response_subject?: string
      first_response_body?: string
      cadence?: Array<{
        id: string
        type: 'email' | 'call' | 'text'
        day_offset: number
        title: string
        body: string
        status: 'pending' | 'done' | 'skipped'
      }>
    }

    const cadence: CadenceItem[] = (parsed.cadence || []).map(item => ({
      ...item,
      id: randomUUID(),
      status: 'pending' as const,
    }))

    return {
      tier: parsed.tier,
      research_summary: parsed.research_summary,
      disqualify_reason: parsed.disqualify_reason,
      first_response_subject: parsed.first_response_subject,
      first_response_body: parsed.first_response_body,
      cadence,
    }
  } catch (err) {
    console.error('Lead qualification error:', err)
    return {
      tier: 'questionable',
      research_summary: `Qualification failed for ${companyName || contactName}. Review manually.`,
      disqualify_reason: undefined,
      first_response_subject: undefined,
      first_response_body: undefined,
      cadence: [],
    }
  }
}
