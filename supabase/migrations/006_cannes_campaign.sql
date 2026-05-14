-- Cannes Brand Outreach campaign seed
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)

DO $$
DECLARE
  v_user_id   uuid;
  v_campaign_id uuid;
BEGIN
  -- Resolve Asa's user ID
  SELECT id INTO v_user_id FROM public.users WHERE email = 'asa@darkroomagency.com' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User asa@darkroomagency.com not found — check the email address';
  END IF;

  -- Create campaign
  INSERT INTO public.campaigns (user_id, name, system_prompt, from_name, status)
  VALUES (
    v_user_id,
    'Cannes Brand Outreach',
    'This is outreach for The Darkroom Villa at Cannes Lions 2026, a brand partnership opportunity hosted by Darkroom Agency. The goal is to secure brand partnership commitments from established consumer brands ($50M+ in revenue) across categories like beauty, beverage, CPG, tech, fashion, and DTC. Recipients are typically VPs and Heads of Marketing, CMOs, Brand Directors, and Heads of Growth.

The offer: Darkroom has secured a private villa on the French Riviera for the week of June 21-25, 2026 (Cannes Lions week). We are curating a residency of 10+ top marketing creators including Sammi Cohen, Oren John, Dara Denney, Preston Konrad, JT Barnett, Clayton Chambers, Internet Anthropology, Shwinnabego, Tatum Brandt, and a surprise guest. Combined reach is 4M+ followers and 100M+ impressions across marketing, strategy, technology, design, and culture.

What brand partners get: native content production with creators on-site, brand integration across villa programming, access to private dinners and high-signal networking throughout the week, and co-distribution across the creator network. This is a curated, limited-spots opportunity, not a paid festival sponsorship. A handful of brands are being selected across non-competing categories.

About Darkroom: we are an AI-native commerce agency, the first vertically integrated software-agency hybrid built to grow consumer brands. We operate $250M+ in annual media spend, have driven $5B in trackable revenue, and generated $10B in enterprise value for clients. Forbes 30 Under 30 and Inc. 5000 recognized.

Tone for personalization: peer-to-peer, confident but not pushy. These are sophisticated marketing leaders at established brands, so avoid hype, flattery, or salesy language. Be clear, friendly, and professional. Never use em dashes. When writing personalized openers, reference specific recent work, campaigns, launches, or brand moments rather than generic praise.',
    'Asa Juhlin',
    'draft'
  )
  RETURNING id INTO v_campaign_id;

  -- Step 1 — Day 0
  INSERT INTO public.sequence_steps (campaign_id, step_number, day_offset, subject_template, body_template)
  VALUES (
    v_campaign_id, 1, 0,
    'A villa in Cannes + 10 marketing creators',
    'Hi {{first_name}},

{{ai: Write a one-line personalized opener referencing something specific and recent about {{company_name}} — a campaign, product launch, brand moment, or growth milestone. Keep it natural and observational, not flattering.}}

Wanted to put something on your radar for Cannes Lions 2026.

We''ve secured a private villa on the French Riviera for the week of June 21-25 and are curating a residency of 10+ of the most influential voices in marketing. Sammi Cohen, Oren John, Dara Denney, Preston Konrad, JT Barnett, Clayton Chambers, and others. Combined reach is 4M+ followers and 100M+ impressions across marketing, strategy, and culture.

We''re opening a limited number of brand partnership spots. Native content with the creator roster, brand presence throughout the week, and access to the rooms where the industry actually meets.

Worth a quick call to walk through it?

All my best,
{{from_name}}'
  );

  -- Step 2 — Day 5
  INSERT INTO public.sequence_steps (campaign_id, step_number, day_offset, subject_template, body_template)
  VALUES (
    v_campaign_id, 2, 5,
    're: A villa in Cannes + 10 marketing creators',
    'Hi {{first_name}},

Circling back on the Darkroom Villa.

Quick framing on why we built this and who it tends to work for. Cannes Lions is the one week a year when every decision-maker in marketing, media, and the creator economy is in the same place. Most brand activations at the festival are paid sponsorships that buy presence but not influence. Our villa flips that. You get embedded with the creators who actually shape how the industry talks about brands, with content and relationships you can use long after the week ends.

{{ai: Write 2 sentences connecting {{company_name}}''s likely 2026 marketing priorities (brand awareness, creator partnerships, category perception, talent or retailer relationships) to what they''d get out of being in this room. Be specific to the brand, not generic.}}

20 minutes this week or next?

All my best,
{{from_name}}'
  );

  -- Step 3 — Day 10
  INSERT INTO public.sequence_steps (campaign_id, step_number, day_offset, subject_template, body_template)
  VALUES (
    v_campaign_id, 3, 10,
    'Cannes spots filling',
    'Hi {{first_name}},

Wanted to flag this is moving. We''re in active conversations across beauty, beverage, tech, and CPG, and a few spots have been claimed.

Quick rundown of what partners get:

- Dedicated content production with the creator roster on-site
- Brand integration across villa programming and dinners
- Access to private panels and high-signal networking throughout the week
- Co-distribution across the creator network (100M+ combined impressions)

For context on us, Darkroom operates over $250M in annual media spend, has driven $5B in trackable revenue for consumer brands, and is behind {{ai: Insert 1-2 Darkroom case study brands most relevant to {{company_name}}''s category or growth stage. Reference them naturally in the sentence.}}.

Happy to send the full partnership deck. Want me to share it?

All my best,
{{from_name}}'
  );

  -- Step 4 — Day 16
  INSERT INTO public.sequence_steps (campaign_id, step_number, day_offset, subject_template, body_template)
  VALUES (
    v_campaign_id, 4, 16,
    'One more thought on Cannes',
    'Hi {{first_name}},

Know you''re heads down. One last thought on this.

The brands who get the most out of Cannes are the ones who plan the activation, not just the attendance. Our villa is built around that. A structured way to leave the week with content, relationships, and reach instead of just photos from the Croisette.

If 2026 isn''t the year, completely understand. If it is, I''d love to find 15 minutes.

All my best,
{{from_name}}'
  );

  -- Step 5 — Day 23
  INSERT INTO public.sequence_steps (campaign_id, step_number, day_offset, subject_template, body_template)
  VALUES (
    v_campaign_id, 5, 23,
    'Closing the loop on Cannes',
    'Hi {{first_name}},

I''ll stop reaching out on this one. We''re locking the final partner roster over the next couple weeks and don''t want to keep cluttering your inbox.

If Cannes 2026 is on the table for {{company_name}}, reply here and I''ll send the deck and hold time. If the timing is off, no worries. Happy to circle back when something else is a better fit.

All my best,
{{from_name}}'
  );

  RAISE NOTICE 'Campaign created: % (id: %)', 'Cannes Brand Outreach', v_campaign_id;
END $$;
