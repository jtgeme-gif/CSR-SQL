// Runs every Wednesday at 9:00 UTC (5am EDT summer / 4am EST winter) via
// Vercel Cron (see vercel.json) - same schedule and division of labor as
// the subpoena digest: NMT does all the querying/grouping/formatting, PA's
// "SQL - Subpoena Digest" flow (reused here - it's generic toEmail/subject/
// body, doesn't care what the content is about) just sends the final email.
//
// Reads matters.csr_next_due, NOT the SharePoint CSR Tracker - this route
// will show nothing until Submit CSR is rewired to write into
// csr_submissions/matters.csr_next_due instead of SharePoint.
//
// Env vars required (same as digest-cron.js):
//   PA_DIGEST_EMAIL_URL, CRON_SECRET, NEXT_PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const PA_DIGEST_EMAIL_URL = process.env.PA_DIGEST_EMAIL_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Bucket definitions, in display order. Each matter lands in exactly one,
// based on days remaining until matters.csr_next_due.
const BUCKETS = [
  { key: 'overdue', label: 'Overdue', color: 'red', test: (d) => d < 0 },
  { key: 'lt7', label: 'Less Than 7 Days', color: 'orange', test: (d) => d >= 0 && d < 7 },
  { key: '7to14', label: '7–14 Days', color: 'orange', test: (d) => d >= 7 && d <= 14 },
  { key: '15to29', label: '15–29 Days', color: 'gold', test: (d) => d >= 15 && d <= 29 },
  { key: '30plus', label: '30+ Days', color: 'blue', test: (d) => d >= 30 },
];

function bucketFor(days) {
  return BUCKETS.find((b) => b.test(days)) || BUCKETS[BUCKETS.length - 1];
}

function buildEmailHtml(bucketedMatters) {
  const anyMatters = Object.values(bucketedMatters).some((list) => list.length > 0);
  if (!anyMatters) {
    return '<p>Nothing outstanding this week. No open CSRs on your assigned matters.</p>';
  }

  const sections = BUCKETS.map((b) => {
    const list = bucketedMatters[b.key] || [];
    if (list.length === 0) return '';
    const rows = list.map((m) => {
      const matterLink = APP_URL ? `${APP_URL}/matters/${m.id}` : null;
      const caseName = matterLink
        ? `<a href="${matterLink}">${escapeHtml(m.case_name)}</a>`
        : escapeHtml(m.case_name);
      const dueDisplay = b.key === 'overdue'
        ? `<b style="color:red">${m.csr_next_due} (${Math.abs(m.daysOut)} days overdue)</b>`
        : m.csr_next_due;
      return `<p style="margin:4px 0 12px 0;">${caseName} — ${escapeHtml(m.file_number || '')}<br/>Next CSR Due: ${dueDisplay}</p>`;
    }).join('');
    return `<h3 style="margin-bottom:4px;">${b.label}</h3>${rows}`;
  }).filter(Boolean).join('<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;"/>');

  return `<p>The following CSRs remain open as of today, grouped by how soon they're due.</p>${sections}`;
}

export async function GET(request) {
  try {
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

    // Every active staff member's assignments to non-Closed matters that
    // actually have a csr_next_due set - matters with no CSR data yet
    // (not yet migrated off SharePoint) simply won't appear.
    const { data: assignments, error: assignError } = await supabase
      .from('matter_staff')
      .select('matter_id, staff(id, email, active), matters(id, case_name, file_number, case_status, csr_next_due)')
      .neq('matters.case_status', 'Closed');
    if (assignError) throw new Error('Failed to load matter assignments: ' + assignError.message);

    const byRecipient = {}; // email -> { bucketKey: [matters] }
    (assignments || []).forEach((a) => {
      const staff = a.staff;
      const matter = a.matters;
      if (!staff?.email || !staff.active || !matter || matter.case_status === 'Closed' || !matter.csr_next_due) return;

      const daysOut = daysBetween(today, matter.csr_next_due);
      const bucket = bucketFor(daysOut);

      if (!byRecipient[staff.email]) {
        byRecipient[staff.email] = Object.fromEntries(BUCKETS.map((b) => [b.key, []]));
      }
      byRecipient[staff.email][bucket.key].push({ ...matter, daysOut });
    });

    const results = [];
    for (const email of Object.keys(byRecipient)) {
      // Sort each bucket soonest-first (overdue: most-overdue first).
      BUCKETS.forEach((b) => {
        byRecipient[email][b.key].sort((x, y) => x.daysOut - y.daysOut);
      });

      const html = buildEmailHtml(byRecipient[email]);
      const totalCount = BUCKETS.reduce((n, b) => n + byRecipient[email][b.key].length, 0);
      const subject = totalCount > 0
        ? `Weekly CSR Status — ${totalCount} outstanding`
        : 'Weekly CSR Status — Nothing outstanding';

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
