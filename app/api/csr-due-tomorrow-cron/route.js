// Runs every day via Vercel Cron (see vercel.json). Checks whether any
// assigned attorney has a matter with csr_next_due landing exactly tomorrow.
// Unlike the weekly digest, this deliberately does NOT send a "nothing due
// tomorrow" email - a daily all-clear would just be noise. It only sends
// when there's a real match, batched into one email per attorney if more
// than one of their matters happens to land on the same day.
//
// Same env vars as the other cron routes.

import { createClient } from '@supabase/supabase-js';

const PA_DIGEST_EMAIL_URL = process.env.PA_DIGEST_EMAIL_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHtml(matters) {
  const rows = matters.map((m) => {
    const matterLink = APP_URL ? `${APP_URL}/matters/${m.id}` : null;
    const caseName = matterLink
      ? `<a href="${matterLink}">${escapeHtml(m.case_name)}</a>`
      : escapeHtml(m.case_name);
    return `<p style="margin:4px 0 12px 0;">${caseName} — ${escapeHtml(m.file_number || '')}<br/>Due: <b style="color:red">tomorrow</b> (${m.csr_next_due})</p>`;
  }).join('');
  return `<p>The CSR for the following matter${matters.length > 1 ? 's is' : ' is'} due <b>tomorrow</b>. Please submit before end of business today.</p>${rows}`;
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

    const tomorrow = tomorrowStr();

    const { data: assignments, error: assignError } = await supabase
      .from('matter_staff')
      .select('matter_id, staff(id, email, active), matters(id, case_name, file_number, case_status, csr_next_due)')
      .neq('matters.case_status', 'Closed')
      .eq('matters.csr_next_due', tomorrow);
    if (assignError) throw new Error('Failed to load matter assignments: ' + assignError.message);

    const byRecipient = {}; // email -> [matters]
    (assignments || []).forEach((a) => {
      const staff = a.staff;
      const matter = a.matters;
      if (!staff?.email || !staff.active || !matter || matter.case_status === 'Closed') return;
      if (!byRecipient[staff.email]) byRecipient[staff.email] = [];
      byRecipient[staff.email].push(matter);
    });

    const results = [];
    for (const email of Object.keys(byRecipient)) {
      const matters = byRecipient[email];
      if (matters.length === 0) continue; // no all-clear email - only send on a real match

      const html = buildEmailHtml(matters);
      const subject = matters.length > 1
        ? `CSR Due Tomorrow — ${matters.length} matters`
        : `CSR Due Tomorrow — ${matters[0].case_name}`;

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
