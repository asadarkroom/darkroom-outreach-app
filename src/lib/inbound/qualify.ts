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

export type LeadTier = 'good_fit' | 'questionable' | 'not_fit' | 'unassessed' | 'manually_qualified' | 'manually_on_fence'

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
  manualOverride?: 'qualified' | 'on_the_fence'
}): Promise<QualificationResult> {
  const { contactName, companyName, servicesInterested, mediaBudget, inquiryType, pageUrl, manualOverride } = params

  // Manual override: skip AI tier assessment, generate targeted meeting-request email + 5-step cadence
  if (manualOverride) {
    return generateManualOverrideResult({
      contactName, companyName, servicesInterested, mediaBudget, inquiryType, pageUrl, manualOverride,
    })
  }

  const calendlyUrl = process.env.CALENDLY_URL || 'https://calendar.app.google/Qm4TytjzXZA14k7N9'
  const calendly15MinUrl = process.env.CALENDLY_URL_15MIN || 'https://calendar.app.google/REJbeudrwjkKzsWt8'
  const agencyOverviewUrl = process.env.AGENCY_OVERVIEW_URL || 'https://darkroom.docsend.com/view/svxjbhtf2fdbnck4'
  const senderFullName = process.env.SENDER_NAME || 'Asa Juhlin'
  const senderFirstName = senderFullName.split(' ')[0]
  const senderTitle = process.env.SENDER_TITLE || 'Associate Director, Revenue Operations at Darkroom'
  const agencyName = 'Darkroom'
  const agencyOverviewLine = agencyOverviewUrl
    ? `In the meantime, also check out our [Agency Overview deck](${agencyOverviewUrl}) for more info on the breadth of our services.`
    : `In the meantime, I'm happy to share our Agency Overview deck if you'd like more info on our services.`

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
- good_fit: Clear services match AND strong budget signals ($30k+/mo). Shoot for booking a 30-min meeting.
- questionable: Budget unclear, low-ish, or not stated — but services could be a match. Send an on-the-fence email.
- not_fit: Wrong category (B2B, SEO-only, etc.) OR explicitly under $10k budget. Still send an on-the-fence email.

LEAD DETAILS:
${leadContext}

---

TONE & STYLE RULES (strictly follow these):
- Casual, direct, peer-to-peer — never salesy or corporate
- Short paragraphs, plain conversational language
- Greet with "Hey [first name],"
- Introduce as: "My name is ${senderFirstName}, and I manage our partnerships here."
- Sign off: "Sending my best,\n\n${senderFirstName}"
- NEVER paste raw URLs — always use markdown hyperlinks: [link text](url)
- good_fit calendar link: [grab 30 minutes on my calendar here](${calendlyUrl})
- questionable/not_fit calendar link: [grab 15 minutes on my calendar here](${calendly15MinUrl})
- Agency Overview must be written as: ${agencyOverviewLine}

---

EXAMPLE good_fit email (match this tone and structure exactly — substitute their actual details):

Subject: Re: [Their inquiry topic]

Hey [first name],

Thanks for reaching out to Darkroom. My name is ${senderFirstName}, and I manage our partnerships here.

[Service they mentioned] is something we're really deep on right now. It's one of our strongest offerings and where we see the biggest lift for brands at your stage. Would love to learn more about what [company] is working on and where you're feeling the gaps.

I'd love to walk you through how we approach [service] and how it ties directly into [relevant outcome]. Feel free to [grab 30 minutes on my calendar here](${calendlyUrl}) or send me some times that work for you.

${agencyOverviewLine}

Sending my best,

${senderFirstName}

---

EXAMPLE questionable/not_fit email (use for BOTH questionable and not_fit — match this tone exactly):

Subject: Re: Your Darkroom Inquiry

Hey [first name],

Thanks for reaching out to Darkroom. My name is ${senderFirstName}, and I manage our partnerships here.

Based on what you've shared, your current budget may be below our minimum investment threshold — so we're going to pass for now. Our paid media engagements start at $10–15k/month in agency fees, and we typically work with brands running $30k+ in monthly ad spend to drive meaningful scale.

That said, if we're making an incorrect assumption about your budget or where [company] is headed, I'd love to be corrected. Feel free to [grab 15 minutes on my calendar here](${calendly15MinUrl}) and walk us through your situation — we're happy to revisit if the fit is there.

${agencyOverviewLine}

Sending my best,

${senderFirstName}

---

For good_fit: Follow the good_fit example above. Be specific to their services interest and company. Show genuine enthusiasm. Keep it 4 short paragraphs.

For questionable: Follow the questionable/not_fit example above. Use "may be below" language — leaving some uncertainty. Use the 15-min calendar link.

For not_fit: Follow the questionable/not_fit example above. Be slightly more direct about the budget threshold. Use the 15-min calendar link. Set disqualify_reason explaining why they don't fit, but still generate the email and a cadence.

CADENCE (all tiers — starts the day AFTER the first email):
Generate specific, realistic follow-up steps. Include actual talking points and message copy.

good_fit cadence (5-6 steps over ~2 weeks):
- Day 1: phone call with specific talking points referencing the email
- Day 2: short text message
- Day 4: follow-up email if no reply
- Day 7: phone call
- Day 10: final short "break-up" email

questionable/not_fit cadence (4-5 steps):
- Day 2: follow-up email nudging them to clarify budget/situation
- Day 4: short phone call
- Day 6: short text
- Day 9: final short email

Respond with ONLY raw JSON (no markdown, no code fences):
{
  "tier": "good_fit" | "questionable" | "not_fit",
  "research_summary": "2-3 sentences about who this person/company is and why they are/aren't a fit",
  "disqualify_reason": "string — only include if tier is not_fit",
  "first_response_subject": "string",
  "first_response_body": "string",
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
    // Generate a minimal on-the-fence email so the lead doesn't get stuck with no response
    const firstName = contactName.split(' ')[0]
    const fallbackSubject = `Re: Your ${companyName || 'Darkroom'} Inquiry`
    const fallbackBody = [
      `Hey ${firstName},`,
      '',
      `Thanks for reaching out to Darkroom. My name is ${senderFirstName}, and I manage our partnerships here.`,
      '',
      `I'd love to learn a bit more about what ${companyName || 'your brand'} is working on. Feel free to [grab 15 minutes on my calendar here](${calendly15MinUrl}) and we can go from there.`,
      '',
      `Sending my best,`,
      '',
      senderFirstName,
    ].join('\n')
    return {
      tier: 'questionable',
      research_summary: `Qualification failed for ${companyName || contactName}. Review manually.`,
      disqualify_reason: undefined,
      first_response_subject: fallbackSubject,
      first_response_body: fallbackBody,
      cadence: [],
    }
  }
}

async function generateManualOverrideResult(params: {
  contactName: string
  companyName: string | null
  servicesInterested: string | null
  mediaBudget: string | null
  inquiryType: string | null
  pageUrl: string | null
  manualOverride: 'qualified' | 'on_the_fence'
}): Promise<QualificationResult> {
  const { contactName, companyName, servicesInterested, manualOverride } = params

  const calendlyUrl = process.env.CALENDLY_URL || 'https://calendar.app.google/Qm4TytjzXZA14k7N9'
  const calendly15MinUrl = process.env.CALENDLY_URL_15MIN || 'https://calendar.app.google/REJbeudrwjkKzsWt8'
  const agencyOverviewUrl = process.env.AGENCY_OVERVIEW_URL || 'https://darkroom.docsend.com/view/svxjbhtf2fdbnck4'
  const senderFullName = process.env.SENDER_NAME || 'Asa Juhlin'
  const senderFirstName = senderFullName.split(' ')[0]
  const peterName = 'Peter'
  const peterEmail = 'peter@darkroomagency.com'

  const agencyOverviewLine = agencyOverviewUrl
    ? `In the meantime, also check out our [Agency Overview deck](${agencyOverviewUrl}) for more info on the breadth of our services.`
    : `In the meantime, I'm happy to share our Agency Overview deck if you'd like more info on our services.`

  const firstName = contactName.split(' ')[0]
  const companyLine = companyName ? ` at ${companyName}` : ''
  const serviceLine = servicesInterested
    ? `It sounds like you're interested in ${servicesInterested.toLowerCase()}, which is`
    : 'Darkroom is'

  if (manualOverride === 'qualified') {
    const prompt = `
You are ${senderFirstName} (${senderFullName}), Associate Director, Revenue Operations at Darkroom.

Write a short, casual, peer-to-peer email to ${contactName}${companyLine} requesting a 30-minute meeting to explore working together. My colleague ${peterName} (${peterEmail}) will be CC'd on this email and will join the call.

Lead details:
- Name: ${contactName}
${companyName ? `- Company: ${companyName}` : ''}
${servicesInterested ? `- Services interested in: ${servicesInterested}` : ''}

Guidelines:
- Greet: "Hey ${firstName},"
- Intro: "My name is ${senderFirstName}, and I manage our partnerships here."
- Mention that ${serviceLine} one of Darkroom's strongest offerings
- Ask for 30 min with "me and ${peterName}" — [grab 30 minutes on our calendar here](${calendlyUrl})
- ${agencyOverviewLine}
- Sign off: "Sending my best,\n\n${senderFirstName}"
- Casual, direct, 3-4 short paragraphs, no corporate language

Respond with ONLY raw JSON (no markdown, no code fences):
{
  "subject": "string",
  "body": "string"
}
`.trim()

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed = JSON.parse(clean) as { subject: string; body: string }

      const cadence: CadenceItem[] = [
        {
          id: randomUUID(), type: 'call', day_offset: 1, status: 'pending',
          title: 'Follow-up call',
          body: `Call ${contactName}${companyLine} to follow up on the meeting request email.\n\nTalking points:\n- Introduce yourself briefly\n- Reference the email you just sent\n- Ask if they had a chance to look at the calendar link\n- Confirm a 30-min slot with you and ${peterName}`,
        },
        {
          id: randomUUID(), type: 'text', day_offset: 3, status: 'pending',
          title: 'Text follow-up',
          body: `Hey ${firstName} — Asa from Darkroom. Wanted to follow up on my email about connecting with our team. Would love to find 30 min this week. Let me know!`,
        },
        {
          id: randomUUID(), type: 'email', day_offset: 5, status: 'pending',
          title: 'Follow-up email',
          body: `Subject: Re: ${parsed.subject}\n\nHey ${firstName},\n\nJust wanted to bump this to the top of your inbox in case it got buried.\n\nWould still love to find 30 minutes to connect with you and ${peterName} — feel free to [grab time on our calendar here](${calendlyUrl}) or just reply with a couple times that work.\n\nSending my best,\n\n${senderFirstName}`,
        },
        {
          id: randomUUID(), type: 'call', day_offset: 8, status: 'pending',
          title: 'Second follow-up call',
          body: `Second attempt to reach ${contactName}${companyLine}.\n\nIf they answer:\n- Casual check-in, not pushy\n- "Hey, just wanted to make sure my emails weren't going to spam"\n- Confirm interest and book the 30-min slot`,
        },
        {
          id: randomUUID(), type: 'email', day_offset: 12, status: 'pending',
          title: 'Break-up email',
          body: `Subject: Re: ${parsed.subject}\n\nHey ${firstName},\n\nI'll stop filling up your inbox after this one — but wanted to reach out one last time before moving on.\n\nIf timing is ever right to explore what we could do together, feel free to [grab time on my calendar](${calendlyUrl}) anytime.\n\nWishing you the best,\n\n${senderFirstName}`,
        },
      ]

      return {
        tier: 'manually_qualified',
        research_summary: `Manually qualified by team. ${companyName || contactName} flagged as a strong fit for a 30-min intro call with ${senderFirstName} and ${peterName}. First response requests a meeting; ${peterName} is CC'd.`,
        first_response_subject: parsed.subject,
        first_response_body: parsed.body,
        cadence,
      }
    } catch (err) {
      console.error('Manual qualified email generation error:', err)
      return manualOverrideFallback(contactName, companyName, 'manually_qualified')
    }
  }

  // on_the_fence: 15-min ASAP, just Asa
  const prompt = `
You are ${senderFirstName} (${senderFullName}), Associate Director, Revenue Operations at Darkroom.

Write a short, casual email to ${contactName}${companyLine} requesting a quick 15-minute call to learn more about their situation and see if there's a fit. Just you — no mention of other team members.

Lead details:
- Name: ${contactName}
${companyName ? `- Company: ${companyName}` : ''}
${servicesInterested ? `- Services interested in: ${servicesInterested}` : ''}

Guidelines:
- Greet: "Hey ${firstName},"
- Intro: "My name is ${senderFirstName}, and I manage our partnerships here."
- Express curiosity about their situation — you want to learn more before assuming fit
- Ask for 15 min "as soon as this week" — [grab 15 minutes on my calendar here](${calendly15MinUrl})
- Keep it warm but brief — 2-3 short paragraphs
- Sign off: "Sending my best,\n\n${senderFirstName}"
- No agency overview link needed for this one

Respond with ONLY raw JSON (no markdown, no code fences):
{
  "subject": "string",
  "body": "string"
}
`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean) as { subject: string; body: string }

    const cadence: CadenceItem[] = [
      {
        id: randomUUID(), type: 'call', day_offset: 1, status: 'pending',
        title: 'Follow-up call',
        body: `Call ${contactName}${companyLine} to follow up on the 15-min call request.\n\nTalking points:\n- Quick intro\n- "Just following up on my email — wanted to see if a 15-min call this week works"\n- Keep it light, no hard sell`,
      },
      {
        id: randomUUID(), type: 'text', day_offset: 2, status: 'pending',
        title: 'Text follow-up',
        body: `Hey ${firstName} — Asa from Darkroom. Sent you an email about a quick 15-min call. Would love to connect this week if you're open to it!`,
      },
      {
        id: randomUUID(), type: 'email', day_offset: 4, status: 'pending',
        title: 'Follow-up email',
        body: `Subject: Re: ${parsed.subject}\n\nHey ${firstName},\n\nJust following up in case my last email got lost.\n\nWould still love to find 15 minutes to chat — feel free to [grab a quick slot here](${calendly15MinUrl}) or just reply with a time that works.\n\nSending my best,\n\n${senderFirstName}`,
      },
      {
        id: randomUUID(), type: 'call', day_offset: 6, status: 'pending',
        title: 'Second follow-up call',
        body: `Second attempt to reach ${contactName}.\n\nIf they answer:\n- "Hey, I know my timing might be off — just wanted to make sure my email landed"\n- Keep it to 2 minutes, ask if they're open to a 15-min call this week`,
      },
      {
        id: randomUUID(), type: 'email', day_offset: 9, status: 'pending',
        title: 'Break-up email',
        body: `Subject: Re: ${parsed.subject}\n\nHey ${firstName},\n\nLast note from me — I don't want to clog up your inbox.\n\nIf the timing ever makes sense to chat, feel free to [grab 15 minutes here](${calendly15MinUrl}).\n\nWishing you the best,\n\n${senderFirstName}`,
      },
    ]

    return {
      tier: 'manually_on_fence',
      research_summary: `Manually flagged as on the fence. ${companyName || contactName} may be a fit — ${senderFirstName} wants to learn more before committing. First response is a 15-min exploratory call request.`,
      first_response_subject: parsed.subject,
      first_response_body: parsed.body,
      cadence,
    }
  } catch (err) {
    console.error('Manual on_the_fence email generation error:', err)
    return manualOverrideFallback(contactName, companyName, 'manually_on_fence')
  }
}

function manualOverrideFallback(
  contactName: string,
  companyName: string | null,
  tier: 'manually_qualified' | 'manually_on_fence'
): QualificationResult {
  return {
    tier,
    research_summary: `Manually overridden to ${tier}. Email generation failed — edit and send manually.`,
    cadence: [],
  }
}
