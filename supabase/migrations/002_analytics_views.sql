-- ============================================================
-- Analytics Views — server-side metric computation
-- All views are user-scoped for RLS safety
-- ============================================================

-- Campaign overview metrics
create or replace view public.campaign_overview as
select
  c.id                                                as campaign_id,
  c.user_id,
  c.name,
  c.status,
  c.created_at,
  c.launched_at,
  count(distinct co.id)                               as total_enrolled,
  count(distinct co.id) filter (where co.status = 'active')     as active_contacts,
  count(distinct co.id) filter (where co.status = 'completed')  as completed_contacts,
  count(distinct co.id) filter (where co.status = 'unenrolled') as unenrolled_contacts,
  round(
    count(distinct co.id) filter (where co.unenroll_reason = 'replied')::numeric
    / nullif(count(distinct co.id), 0) * 100, 1
  )                                                   as reply_rate,
  count(se.id) filter (
    where se.status = 'drafted' and se.send_date = current_date
  )                                                   as drafts_today,
  count(se.id) filter (where se.status = 'error')     as error_count
from public.campaigns c
left join public.contacts co on co.campaign_id = c.id
left join public.scheduled_emails se on se.campaign_id = c.id
group by c.id, c.user_id, c.name, c.status, c.created_at, c.launched_at;

-- Step performance metrics
create or replace view public.step_performance as
select
  ss.id                                               as step_id,
  ss.campaign_id,
  c.user_id,
  ss.step_number,
  ss.day_offset,
  count(se.id)                                        as total_scheduled,
  count(se.id) filter (where se.status = 'drafted')   as drafted_count,
  count(se.id) filter (where se.status = 'error')     as error_count,
  -- A reply is "attributed" to this step when the contact replied
  -- and this was the last drafted step before they were unenrolled
  count(distinct co.id) filter (
    where co.unenroll_reason = 'replied'
    and not exists (
      select 1 from public.scheduled_emails se2
      where se2.contact_id = co.id
        and se2.status = 'drafted'
        and se2.step_id != ss.id
        and se2.send_date > se.send_date
    )
  )                                                   as replies_attributed,
  round(
    count(distinct co.id) filter (
      where co.unenroll_reason = 'replied'
      and not exists (
        select 1 from public.scheduled_emails se2
        where se2.contact_id = co.id
          and se2.status = 'drafted'
          and se2.step_id != ss.id
          and se2.send_date > se.send_date
      )
    )::numeric
    / nullif(count(se.id) filter (where se.status = 'drafted'), 0) * 100, 1
  )                                                   as reply_rate
from public.sequence_steps ss
join public.campaigns c on c.id = ss.campaign_id
left join public.scheduled_emails se on se.step_id = ss.id
left join public.contacts co on co.id = se.contact_id
group by ss.id, ss.campaign_id, c.user_id, ss.step_number, ss.day_offset;

-- Global user-level metrics
create or replace view public.global_analytics as
select
  c.user_id,
  count(distinct co.id)                                as total_enrolled,
  count(se.id) filter (where se.status = 'drafted')    as total_drafted,
  round(
    count(distinct co.id) filter (where co.unenroll_reason = 'replied')::numeric
    / nullif(count(distinct co.id), 0) * 100, 1
  )                                                    as overall_reply_rate,
  count(distinct c.id) filter (where c.status = 'active') as active_campaigns
from public.campaigns c
left join public.contacts co on co.campaign_id = c.id
left join public.scheduled_emails se on se.campaign_id = c.id
group by c.user_id;

-- Weekly reply trend (last 12 weeks)
create or replace view public.weekly_reply_trend as
select
  co.user_id,
  date_trunc('week', co.reply_detected_at)::date  as week_start,
  count(*)                                         as reply_count
from public.contacts co
where co.reply_detected_at is not null
  and co.reply_detected_at >= now() - interval '12 weeks'
group by co.user_id, date_trunc('week', co.reply_detected_at);
