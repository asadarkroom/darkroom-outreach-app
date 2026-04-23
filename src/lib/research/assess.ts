/**
 * Company research and fit assessment using Claude.
 *
 * Good fit for Darkroom: DTC consumer brands, ecommerce, product brands,
 * companies with meaningful paid media spend needing performance creative,
 * lifecycle marketing, or full-funnel growth.
 *
 * High value: consumer brands doing >$20M revenue or >$50k/month in ad spend.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ResearchResult {
  summary: string
  is_good_fit: boolean
  is_high_value: boolean
  fit_reason: string
  confidence: 'high' | 'medium' | 'low'
}

export async function assessCompany(params: {
  companyName: string
  companyUrl?: string | null
  industry?: string | null
  mediaBudget?: string | null
}): Promise<ResearchResult> {
  const { companyName, companyUrl, industry, mediaBudget } = params

  const contextLines = [
    `Company: ${companyName}`,
    companyUrl ? `Website: ${companyUrl}` : null,
    industry ? `Industry: ${industry}` : null,
    mediaBudget ? `Stated media budget: ${mediaBudget}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `
You are a business analyst helping assess whether companies are good prospects for Darkroom, a full-service performance marketing agency specializing in paid media, creative, TikTok, Amazon, and lifecycle marketing for consumer brands.

GOOD FIT — say is_good_fit: true for:
- DTC consumer brands (beauty, wellness, food/bev, apparel, home, pet, etc.)
- Ecommerce brands selling on their own site, Amazon, TikTok Shop, or retail
- Consumer product companies at any stage that run paid ads (Meta, TikTok, Google, Amazon)
- Established consumer brands like Lancôme, Cole Haan, Force of Nature, Primal Kitchen, Graza, Spotify
- Venture-backed consumer startups with ad spend
- Retail brands with digital marketing operations
- Multi-location consumer-facing businesses (restaurants, fitness, etc.)

NOT a fit — say is_good_fit: false for:
- Universities, schools, or educational institutions
- Government agencies or nonprofits
- Pure B2B companies with no consumer product (law firms, accounting, industrial)
- Financial services (banks, hedge funds, private equity) unless they have a consumer product
- Healthcare systems or hospitals (unless selling direct consumer products)

WHEN IN DOUBT — lean toward is_good_fit: true. It is much better to draft an email for a borderline case than to silently skip a good prospect.

HIGH VALUE (is_high_value: true):
- Consumer brands doing >$20M in annual revenue, OR >$50k/month ad spend

Company to evaluate:
${contextLines}

Respond with ONLY raw JSON (no markdown, no code fences):
{
  "summary": "2-3 sentences: what they do, their stage/size, why they are or are not a Darkroom fit",
  "is_good_fit": true or false,
  "is_high_value": true or false,
  "fit_reason": "1 sentence explaining the fit decision",
  "confidence": "high", "medium", or "low"
}
`.trim()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

    // Strip any markdown code fences if present
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean) as ResearchResult
    return parsed
  } catch (err) {
    console.error('Research assess error:', err)
    // Default to good_fit so we don't silently skip prospects on research failures
    return {
      summary: `Research unavailable for ${companyName}. Defaulting to draft — review before sending.`,
      is_good_fit: true,
      is_high_value: false,
      fit_reason: 'Research failed — defaulting to include. Verify manually.',
      confidence: 'low',
    }
  }
}
