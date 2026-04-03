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
You are a business analyst helping assess whether companies are good prospects for Darkroom, a performance marketing agency.

Darkroom's ideal client profile:
- DTC consumer brands and ecommerce companies
- Product brands selling direct, via retail, or Amazon
- Companies with meaningful paid media spend needing performance creative, lifecycle marketing, or full-funnel growth
- Successful scale-ups like Airbnb, Spotify, etc. also qualify
- NOT a fit: universities, government, nonprofits, professional services, B2B SaaS with no consumer product

HIGH VALUE client criteria (requires draft review instead of auto-send):
- Consumer brands doing >$20M in annual revenue, OR
- Companies with >$50,000/month in advertising spend/budget

Company to evaluate:
${contextLines}

Based on your knowledge of this company, provide a JSON response (no markdown, just raw JSON):
{
  "summary": "2-3 sentences describing what the company does, their stage/size, and their relevance to Darkroom",
  "is_good_fit": true or false,
  "is_high_value": true or false,
  "fit_reason": "1 sentence explaining the fit decision",
  "confidence": "high", "medium", or "low" (low = company is unfamiliar or hard to assess)
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
    // Fall back to uncertain result so we don't block enrollment
    return {
      summary: `Unable to research ${companyName} automatically. Manual review recommended.`,
      is_good_fit: false,
      is_high_value: false,
      fit_reason: 'Research failed — defaulting to skip.',
      confidence: 'low',
    }
  }
}
