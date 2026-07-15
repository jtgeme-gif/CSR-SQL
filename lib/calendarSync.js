// Shared calendar-sync logic, extracted out of SchedulingTab.js so any
// feature that creates `events` rows (SchedulingTab's own Add Event/Add
// Multiple/Create Deposition, and the newer Import Scheduling Document
// feature) calls the exact same sync path instead of each reimplementing
// it slightly differently. This is what "+ Add Multiple" was missing
// entirely before its fix - centralizing it here prevents that class of
// bug from recurring in any future creation path.

const OUTLOOK_ID_FIELDS = ['outlook_event_id', 'outlook_event_id_2', 'outlook_event_id_3'];

// Which calendar slot(s) a given event type needs, and what each represents.
// Court Deadline / Discovery / timed types (Deposition, Hearing, Status
// Conference/Pre-Trial, Mediation) only ever use slot 1. Discovery's
// Sent/Received date (slot 1) deliberately never goes to the calendar -
// only Response Due (slot 2) does, since Sent/Received is a fixed historical
// record, not a deadline. Trial is one timed span using slots 1/2 as
// start/end, not two separate events. Motion/Brief is the only type where
// up to 3 independent calendar events exist, one per date, since Filed/
// Response/Reply commonly move independently of each other.
export function getSlotDefs(label, description, titlePrefix) {
  const eventPart = description?.trim() || label;
  const title = titlePrefix ? `${titlePrefix} - ${eventPart}` : eventPart;
  if (label === 'Discovery') {
    return [{ slot: 2, dateField: 'secondary_date', timed: false, title: `${title} — Response Due` }];
  }
  if (label === 'Motion / Brief') {
    return [
      { slot: 1, dateField: 'event_date', timed: false, title: `${title} — Filed` },
      { slot: 2, dateField: 'secondary_date', timed: false, title: `${title} — Response Due` },
      { slot: 3, dateField: 'tertiary_date', timed: false, title: `${title} — Reply Due` },
    ];
  }
  if (label === 'Trial') {
    return [{ slot: 1, dateField: 'event_date', endDateField: 'secondary_date', timed: true, title }];
  }
  if (label === 'Court Deadline') {
    return [{ slot: 1, dateField: 'event_date', timed: false, title }];
  }
  // Deposition, Hearing, Status Conference/Pre-Trial, Mediation
  return [{ slot: 1, dateField: 'event_date', timed: true, title }];
}

// Combines a plain date string with an optional time (defaults to 9:00 AM
// when a timed event has no time set) into an ISO datetime the PA flow
// expects.
export function toISODateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr || '09:00';
  return `${dateStr}T${time}:00`;
}
export function addHoursToTime(timeStr, hours) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const totalMin = h * 60 + m + Math.round((hours || 1) * 60);
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Postgres `time` columns come back as "HH:MM:SS" once read from the DB,
// even though the <input type="time"> that produced them only ever sends
// "HH:MM". Slicing to 5 characters normalizes either format to plain HH:MM.
export function toHHMM(timeStr) {
  if (!timeStr) return timeStr;
  return timeStr.slice(0, 5);
}

// Syncs one calendar slot: creates if no outlook id yet and a date is
// present, deletes if the date was cleared, updates if both exist and the
// type hasn't flipped, or deletes+recreates if it has - all invisible to
// the caller, who only ever gets back the resulting outlook id.
export async function syncSlot(ev, def, existingOutlookId, lastSyncedAsTimed) {
  const dateVal = ev[def.dateField];

  if (!dateVal) {
    if (existingOutlookId) {
      await fetch('/api/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', outlookEventId: existingOutlookId }),
      });
      return { outlookId: null, lastSyncedAsTimed: def.slot === 1 ? null : lastSyncedAsTimed };
    }
    return { outlookId: existingOutlookId, lastSyncedAsTimed };
  }

  const payload = def.timed
    ? {
        allDay: false,
        title: def.title,
        startDateTime: toISODateTime(dateVal, toHHMM(ev.event_time)),
        endDateTime: def.endDateField
          ? toISODateTime(ev[def.endDateField] || dateVal, toHHMM(ev.event_time))
          : toISODateTime(dateVal, addHoursToTime(toHHMM(ev.event_time), ev.duration_minutes ? ev.duration_minutes / 60 : 1)),
        location: ev.location || '',
        notes: ev.virtual_meeting_info || '',
      }
    : { allDay: true, title: def.title, date: dateVal };

  // Type flip only meaningfully applies to slot 1 (the only slot that can
  // ever be a timed type) - Motion/Brief's slots are always all-day.
  const typeFlipped = def.slot === 1 && lastSyncedAsTimed !== null && lastSyncedAsTimed !== def.timed;

  if (!existingOutlookId || typeFlipped) {
    if (existingOutlookId) {
      await fetch('/api/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', outlookEventId: existingOutlookId }),
      });
    }
    const res = await fetch('/api/calendar-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', allDay: def.timed ? false : true, ...payload }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Calendar create failed');
    return { outlookId: data.outlookEventId, lastSyncedAsTimed: def.slot === 1 ? def.timed : lastSyncedAsTimed };
  }

  const res = await fetch('/api/calendar-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', allDay: def.timed ? false : true, outlookEventId: existingOutlookId, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Calendar update failed');
  return { outlookId: existingOutlookId, lastSyncedAsTimed: def.slot === 1 ? def.timed : lastSyncedAsTimed };
}

// Runs every applicable slot for this event's type, then writes the
// resulting outlook_event_id(s) and last_synced_as_timed back to the row.
// Callers pass their own supabase client and the event's type label
// (already resolved from event_types) plus the matter's calendar title
// prefix (short_name || case_name).
export async function syncEventToCalendar(supabase, eventRow, typeLabel, titlePrefix) {
  const defs = getSlotDefs(typeLabel, eventRow.description, titlePrefix);
  const updates = {};

  for (const def of defs) {
    const idField = OUTLOOK_ID_FIELDS[def.slot - 1];
    const result = await syncSlot(eventRow, def, eventRow[idField], eventRow.last_synced_as_timed);
    updates[idField] = result.outlookId;
    if (def.slot === 1) updates.last_synced_as_timed = result.lastSyncedAsTimed;
  }

  const { error } = await supabase.from('events').update(updates).eq('id', eventRow.id);
  if (error) throw new Error('Calendar synced, but saving the Outlook link failed: ' + error.message);
}
