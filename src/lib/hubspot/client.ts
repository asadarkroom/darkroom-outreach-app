/**
 * HubSpot CRM API client
 * Uses a Private App access token (HUBSPOT_ACCESS_TOKEN)
 */

const HUBSPOT_BASE = 'https://api.hubapi.com'

function getHeaders() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Find a HubSpot contact by email. Returns the contact ID or null.
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'EQ', value: email },
          ],
        },
      ],
      properties: ['email', 'firstname', 'lastname'],
      limit: 1,
    }),
  })

  if (!res.ok) {
    console.error('HubSpot contact search error:', await res.text())
    return null
  }

  const data = await res.json()
  if (data.results && data.results.length > 0) {
    return data.results[0].id as string
  }
  return null
}

/**
 * Check if a HubSpot deal exists for a given company name.
 * Returns true if a deal is found.
 */
export async function checkDealExists(companyName: string): Promise<boolean> {
  if (!companyName) return false

  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'dealname',
              operator: 'CONTAINS_TOKEN',
              value: companyName,
            },
          ],
        },
      ],
      properties: ['dealname', 'dealstage'],
      limit: 5,
    }),
  })

  if (!res.ok) {
    console.error('HubSpot deal search error:', await res.text())
    return false
  }

  const data = await res.json()
  return data.total > 0
}

/**
 * Log a sent email as an engagement activity in HubSpot.
 * Associates the email with the contact if hubspotContactId is provided.
 */
export async function logEmailEngagement(params: {
  hubspotContactId: string | null
  toEmail: string
  subject: string
  body: string
  sentAt?: Date
}): Promise<string | null> {
  const { hubspotContactId, toEmail, subject, body, sentAt } = params

  const properties: Record<string, string> = {
    hs_email_direction: 'OUTGOING',
    hs_email_status: 'SENT',
    hs_email_subject: subject,
    hs_email_text: body,
    hs_email_to_email: toEmail,
    hs_timestamp: (sentAt || new Date()).toISOString(),
  }

  const payload: Record<string, unknown> = { properties }

  if (hubspotContactId) {
    payload.associations = [
      {
        to: { id: hubspotContactId },
        types: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 198, // Email → Contact association
          },
        ],
      },
    ]
  }

  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/emails`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error('HubSpot email engagement error:', await res.text())
    return null
  }

  const data = await res.json()
  return data.id as string
}
