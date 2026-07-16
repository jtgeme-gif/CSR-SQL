import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fires once, right after a new matter is created. Only sends to staff on
// the assignment list who are flagged as attorneys (support staff never
// get these) - if nobody assigned turns out to be an attorney, this is a
// silent no-op, same as the client-side check that avoids calling this
// route at all in that case. Reuses the same generic digest-email PA flow
// every other NMT email already goes through, extended with an
// attachments field specifically for this.
export async function POST(req) {
  try {
    const { matterId, caseName, staffIds } = await req.json();

    if (!matterId || !caseName || !Array.isArray(staffIds) || staffIds.length === 0) {
      return NextResponse.json({ error: 'Missing matterId, caseName, or staffIds' }, { status: 400 });
    }

    const { data: attorneys, error: staffError } = await supabase
      .from('staff')
      .select('id, first_name, last_name, email')
      .in('id', staffIds)
      .eq('is_attorney', true);

    if (staffError) throw new Error(staffError.message);

    if (!attorneys || attorneys.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'No assigned staff are flagged as attorneys.' });
    }

    const csrPath = path.join(process.cwd(), 'public', 'blank-csr-form.docx');
    const budgetPath = path.join(process.cwd(), 'public', 'blank-budget-form.xlsx');

    const attachments = [
      { name: 'Blank CSR Form.docx', contentBytes: fs.readFileSync(csrPath).toString('base64') },
      { name: 'Blank Litigation Budget.xlsx', contentBytes: fs.readFileSync(budgetPath).toString('base64') },
    ];

    const sendResults = [];
    for (const attorney of attorneys) {
      if (!attorney.email) {
        sendResults.push({ staffId: attorney.id, sent: false, reason: 'No email on file' });
        continue;
      }
      const resp = await fetch(process.env.PA_DIGEST_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: attorney.email,
          subject: `New Matter Opened — ${caseName} — CSR & Budget Forms`,
          body: `<p>A new matter has been opened: <strong>${caseName}</strong>.</p><p>Attached are the blank Case Status Report and Litigation Budget forms to be completed for this matter.</p>`,
          attachments,
        }),
      });
      sendResults.push({ staffId: attorney.id, sent: resp.ok });
    }

    const anyFailed = sendResults.some((r) => !r.sent);
    if (anyFailed) {
      return NextResponse.json({ success: true, warning: 'Forms sent, but one or more attorneys may not have received them.', sendResults });
    }

    return NextResponse.json({ success: true, sendResults });

  } catch (err) {
    console.error('Send new matter forms error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
