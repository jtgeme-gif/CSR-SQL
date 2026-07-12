// Runs every Wednesday at 9:00 UTC (5am Eastern/EDT summer, 4am EST winter)
// via Vercel Cron (see vercel.json) - accepted seasonal drift, no DST
// handling. NMT does all the work here - querying, grouping, sorting,
// building the actual HTML email content - and PA's "SQL - Subpoena Digest"
// flow does nothing but send exactly what it's handed. Same division of
// labor as calendar sync.
//
// Env vars required (Vercel + .env.local):
//   PA_DIGEST_EMAIL_URL  - the "SQL - Subpoena Digest" flow's trigger URL
//   CRON_SECRET          - shared secret Vercel sends as a Bearer token when
//                          it invokes this route; protects it from being
//                          called by anyone who guesses the URL. Add this as
//                          its own env var (any random string) - Vercel
//                          automatically attaches it as an Authorization
//                          header on scheduled cron invocations.
//   NEXT_PUBLIC_APP_URL  - base URL used to build the "open in NMT" links in
//                          the email (e.g. https://sql-tracker.vercel.app).
//                          Update this if/when the site's domain changes.

import { createClient } from '@supabase/supabase-js';

const PA_DIGEST_EMAIL_URL = process.env.PA_DIGEST_EMAIL_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

// Server-side Supabase client - cron has no logged-in user/session, so this
// uses the anon key directly. If RLS blocks reads without a session, this
// will need a service-role key instead (flagged in the build notes).
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// "Overdue 6 days" in bold red; otherwise plain "6 days".
function daysRemainingHtml(dateDue, today) {
  if (!dateDue) return '—';
  const days = daysBetween(today, dateDue);
  if (days < 0) return `<b style="color:red">Overdue ${Math.abs(days)} days</b>`;
  return `${days} days`;
}

function buildEmailHtml(matterGroups, today) {
  if (matterGroups.length === 0) {
    return '<p>Nothing outstanding this week. No open subpoena/FOIA requests on your assigned matters.</p>';
  }

  const sections = matterGroups.map((group) => {
    const matterLink = APP_URL ? `${APP_URL}/matters/${group.matterId}` : null;
    const caseHeader = matterLink
      ? `<a href="${matterLink}">${escapeHtml(group.caseName)}</a> — ${escapeHtml(group.fileNumber || '')}`
      : `${escapeHtml(group.caseName)} — ${escapeHtml(group.fileNumber || '')}`;

    const rows = group.requests.map((r) => `
      <p style="margin:4px 0 12px 0;">
        Target: ${escapeHtml(r.target)}<br/>
        Date Submitted: ${r.date_submitted || '—'}<br/>
        Response Due: ${r.date_due || '—'}<br/>
        Days Remaining: ${daysRemainingHtml(r.date_due, today)}
      </p>
    `).join('');

    return `<h3 style="margin-bottom:4px;">${caseHeader}</h3>${rows}`;
  }).join('<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;"/>');

  return `<p>The following records requests are outstanding and require your attention.</p>${sections}`;
}

export async function GET(request) {
  try {
    // Verify this is really Vercel's own cron invocation, not a random caller.
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    if (!PA_DIGEST_EMAIL_URL) {
      return Response.json({ error: 'PA_DIGEST_EMAIL_URL is not configured yet (missing environment variable).' }, { status: 500 });
    }

    const today = todayStr();

    // Every active staff member's matter assignments, across every non-Closed
    // matter - this is the full recipient roster, whether or not they
    // currently have any open requests (so "all clear" emails still go out).
    const { data: assignments, error: assignError } = await supabase
      .from('matter_staff')
      .select('matter_id, staff(id, email, active), matters(id, case_name, file_number, case_status)')
      .neq('matters.case_status', 'Closed');
    if (assignError) throw new Error('Failed to load matter assignments: ' + assignError.message);

    // Build recipient -> matter map first (seeds every attorney with an empty list).
    const byRecipient = {}; // email -> { matterId: { caseName, fileNumber, requests: [] } }
    (assignments || []).forEach((a) => {
      const staff = a.staff;
      const matter = a.matters;
      if (!staff?.email || !staff.active || !matter || matter.case_status === 'Closed') return;
      if (!byRecipient[staff.email]) byRecipient[staff.email] = {};
      if (!byRecipient[staff.email][matter.id]) {
        byRecipient[staff.email][matter.id] = { caseName: matter.case_name, fileNumber: matter.file_number, requests: [] };
      }
    });

    // Every open request, attached to whichever assigned recipients' buckets apply.
    const { data: openRequests, error: reqError } = await supabase
      .from('case_requests')
      .select('matter_id, target, date_submitted, date_due, status')
      .eq('status', 'Open');
    if (reqError) throw new Error('Failed to load open requests: ' + reqError.message);

    (openRequests || []).forEach((r) => {
      Object.keys(byRecipient).forEach((email) => {
        if (byRecipient[email][r.matter_id]) {
          byRecipient[email][r.matter_id].requests.push(r);
        }
      });
    });

    const results = [];
    for (const email of Object.keys(byRecipient)) {
      const matterGroups = Object.entries(byRecipient[email])
        .map(([matterId, g]) => ({ matterId, ...g, requests: g.requests.slice().sort((a, b) => (a.date_due || '9999').localeCompare(b.date_due || '9999')) }))
        .filter((g) => g.requests.length > 0)
        .sort((a, b) => (a.requests[0].date_due || '9999').localeCompare(b.requests[0].date_due || '9999'));

      const html = buildEmailHtml(matterGroups, today);
      const subject = matterGroups.length > 0
        ? `Weekly Records Request Status — ${matterGroups.reduce((n, g) => n + g.requests.length, 0)} outstanding`
        : 'Weekly Records Request Status — Nothing outstanding';

      try {
        const res = await fetch(PA_DIGEST_EMAIL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toEmail: email, subject, body: html }),
        });
        results.push({ email, ok: res.ok, status: res.status });
      } catch (sendErr) {
        results.push({ email, ok: false, error: sendErr.message });
      }
    }

    return Response.json({ success: true, sent: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
