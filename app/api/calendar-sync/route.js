// Server-side only - the PA flow trigger URLs each have a signature baked in
// (functions like an API key), so they must never reach the browser. This
// route is the single place that holds them, same pattern as /api/csr.
//
// Env vars required (Vercel + .env.local):
//   PA_CREATE_TIMED_URL   - CONFIRMED (title, startDateTime, endDateTime, location, notes)
//   PA_CREATE_ALLDAY_URL  - CONFIRMED (discoveryId, title, eventDate, location)
//   PA_UPDATE_TIMED_URL   - CONFIRMED (title, startDateTime, endDateTime, location, outlookEventId, notes)
//   PA_UPDATE_ALLDAY_URL  - CONFIRMED (discoveryId, title, eventDate, location, outlookEventId)
//   PA_DELETE_URL         - CONFIRMED (outlookEventId only)
//
// depositionId was a dead placeholder field, never used inside either timed
// flow - removed from both trigger schemas entirely, along with the code
// that used to send it. notes was added to both timed flows' schemas and
// wired to the Outlook event's Body field, carrying Virtual Meeting Info
// (Zoom/Teams links, dial-in numbers) - all-day types never have this field
// in NMT, so the two all-day flows were left untouched.

const PA_CREATE_TIMED_URL = process.env.PA_CREATE_TIMED_URL;
const PA_CREATE_ALLDAY_URL = process.env.PA_CREATE_ALLDAY_URL;
const PA_UPDATE_TIMED_URL = process.env.PA_UPDATE_TIMED_URL;
const PA_UPDATE_ALLDAY_URL = process.env.PA_UPDATE_ALLDAY_URL;
const PA_DELETE_URL = process.env.PA_DELETE_URL;

function checkConfigured(url, label) {
  if (!url) throw new Error(`${label} is not configured yet (missing environment variable).`);
}

async function callFlow(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`PA flow request failed: ${res.status} ${text}`);
  }
  return data;
}

// action: 'create' | 'update' | 'delete'
// allDay: bool - which of the 5 flows to call (ignored for delete, which is one flow regardless)
// outlookEventId: existing Outlook item id - required for update/delete, absent for create
// title, startDateTime, endDateTime, date, location: event fields, shape depends on allDay
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, allDay, outlookEventId, title, startDateTime, endDateTime, date, location, notes } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    if (action === 'delete') {
      if (!outlookEventId) {
        // Nothing on the calendar to remove - per design, skip PA entirely.
        return Response.json({ success: true, skipped: true });
      }
      checkConfigured(PA_DELETE_URL, 'PA_DELETE_URL');
      // Confirmed from the real flow's trigger schema: just outlookEventId, nothing else.
      await callFlow(PA_DELETE_URL, { outlookEventId });
      return Response.json({ success: true });
    }

    if (action === 'create') {
      if (allDay) {
        checkConfigured(PA_CREATE_ALLDAY_URL, 'PA_CREATE_ALLDAY_URL');
        // Confirmed from the real flow's trigger schema: discoveryId (generic
        // id field, same reused-name pattern as depositionId), title, eventDate, location.
        const result = await callFlow(PA_CREATE_ALLDAY_URL, {
          title,
          eventDate: date,
          location: location || '',
        });
        return Response.json({ success: true, outlookEventId: result.eventId });
      } else {
        checkConfigured(PA_CREATE_TIMED_URL, 'PA_CREATE_TIMED_URL');
        const result = await callFlow(PA_CREATE_TIMED_URL, {
          title,
          startDateTime,
          endDateTime,
          location: location || '',
          notes: notes || '',
        });
        return Response.json({ success: true, outlookEventId: result.eventId });
      }
    }

    if (action === 'update') {
      if (!outlookEventId) {
        return Response.json({ error: 'outlookEventId is required for update' }, { status: 400 });
      }
      if (allDay) {
        checkConfigured(PA_UPDATE_ALLDAY_URL, 'PA_UPDATE_ALLDAY_URL');
        // Confirmed from the real flow's trigger schema: discoveryId, title, eventDate, location, outlookEventId.
        await callFlow(PA_UPDATE_ALLDAY_URL, {
          title,
          eventDate: date,
          location: location || '',
          outlookEventId,
        });
        return Response.json({ success: true, outlookEventId });
      } else {
        checkConfigured(PA_UPDATE_TIMED_URL, 'PA_UPDATE_TIMED_URL');
        // Confirmed from the real flow's trigger schema: title, startDateTime,
        // endDateTime, location, outlookEventId, notes.
        await callFlow(PA_UPDATE_TIMED_URL, {
          title,
          startDateTime,
          endDateTime,
          location: location || '',
          outlookEventId,
          notes: notes || '',
        });
        return Response.json({ success: true, outlookEventId });
      }
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
