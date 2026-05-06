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

  const calendlyUrl = process.env.CALENDLY_URL || 'https://calendar.app.google/AfnPvHX9VWnc13Be7'
  const senderFullName = process.env.SENDER_NAME || 'Asa Juhlin'
  const senderFirstName = senderFullName.split(' ')[0]
  const senderTitle = process.env.SENDER_TITLE || 'Associate Director, Revenue Operations at Darkroom'
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
You are ${senderFirstName} (${senderFullName}), who manages ${senderTitle}.

${agencyName} is a performance marketing agency for consumer brands. Services:
- Paid media (Meta, Google, TikTok, Amazon advertising)
- Creative production (video, photo, UGC)
- TikTok Shop & Amazon channel management
- Lifecycle / email & SMS marketing
- Full-funnel growth strategy

Minimum engagement: TikTok Shop starts at $6,500/month. Full-service paid media engagements start at $10-15k/month. Brands typically need $30k+/month total media budget to see meaningful scale.

BUDGET CLASSIFICATION:
- $30k+/month media budget → good_fit
- $10k–$30k/month → questionable
- Under $10k/month → not_fit
- Budget not stated → questionable (unless other signals clearly disqualify)

SERVICES FIT:
- Good: paid media, performance marketing, ecommerce growth, DTC, creative, TikTok, Amazon, email/SMS
- Not fit: B2B SaaS, SEO-only, web dev, PR-only, government, nonprofit

TIERS:
- good_fit: Clear services match AND strong budget signals. Shoot for booking a meeting.
- questionable: Could be a match but budget is unclear, low-ish, or not stated. Send a transparent clarifying email.
- not_fit: Wrong category OR explicitly stated budget under $10k. Disqualify.

LEAD DETAILS:
${leadContext}

---

WRITING TONE & STYLE (match this in all emails):
- Casual, direct, peer-to-peer — not salesy or corporate
- Short paragraphs, plain language
- Sign off as just "${senderFirstName}" (first name only)
- Use "Hey [first name]" greeting

---

EXAMPLE questionable email (use this as your template for questionable leads — adapt content, keep the structure and tone):

Subject: Re: Your Darkroom Inquiry

Hey [first name],

Thanks for reaching out! My name is ${senderFirstName}, and I manage ${senderTitle}.

To start our conversation, I'm sharing our Agency Overview for your review, which includes our pricing structure and portfolio of services.

Transparently, it looks like your budget is a bit low, but happy to hop on a call if you think that's incorrect. For context, our TikTok Shop offering starts at $6,500/month.

If it still makes sense for you, feel free to book 30 minutes on my calendar here: ${calendlyUrl}

Sending my best,

${senderFirstName}

---

For good_fit: Write a warm, excited email referencing what they told us. Lead with enthusiasm about their brand. Ask for a call with the booking link: ${calendlyUrl}. Keep it to 3-4 short paragraphs.

For questionable: Follow the example template above closely. Be transparent, give them an easy out, reference the pricing, include the calendar link.

For not_fit: No email. Just explain why in disqualify_reason.

CADENCE (for good_fit and questionable only — starts the day AFTER the first email):
Generate specific, realistic follow-up steps. Include actual talking points and message copy.

good_fit cadence (6-8 steps over ~2 weeks):
- Day 1: phone call with specific talking points referencing the email
- Day 2: short text message
- Day 4: follow-up email if no reply
- Day 7: phone call
- Day 10: final short "break-up" email

questionable cadence (4-5 steps):
- Day 3: follow-up email nudging them to clarify their budget
- Day 5: short phone call
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
      "title": "short label",
      "body": "full talking points or message copy",
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
