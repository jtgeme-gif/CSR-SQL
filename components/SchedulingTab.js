'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';

const FRAME_TYPES = {
  'Court Dates & Deadlines': ['Hearing', 'Status Conference/Pre-Trial', 'Trial', 'Court Deadline', 'Mediation'],
  'Discovery & Depositions': ['Discovery', 'Deposition'],
  'Motions & Briefs': ['Motion / Brief'],
};
const EVENT_TYPE_CONFIG = {
  'Court Deadline': { dateLabels: ['Date'], timed: false, hasLocation: false },
  'Discovery': { dateLabels: ['Sent/Received', 'Response Due'], timed: false, hasLocation: false },
  'Motion / Brief': { dateLabels: ['Filed', 'Response Due (optional)', 'Reply Due (optional)'], timed: false, hasLocation: false },
  'Deposition': { dateLabels: ['Date'], timed: true, hasLocation: true },
  'Hearing': { dateLabels: ['Date'], timed: true, hasLocation: true },
  'Status Conference/Pre-Trial': { dateLabels: ['Date'], timed: true, hasLocation: true },
  'Trial': { dateLabels: ['Start Date', 'End Date'], timed: true, hasLocation: true },
  'Mediation': { dateLabels: ['Date'], timed: true, hasLocation: true },
};
const DATE_FIELDS = ['event_date', 'secondary_date', 'tertiary_date'];

// onChanged: called after any mutation, so the parent Matter page can refresh
// its Key Deadlines card and info bar star display, which read pin/star flags
// from this same `events` table independently of this component's own state.
export default function SchedulingTab({ matterId, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [frameOpen, setFrameOpen] = useState({ 'Court Dates & Deadlines': true, 'Discovery & Depositions': true, 'Motions & Briefs': true });
  const [frameSort, setFrameSort] = useState({ 'Court Dates & Deadlines': 'date', 'Discovery & Depositions': 'date', 'Motions & Briefs': 'date' });
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventForm, setEventForm] = useState({ event_type_id: '', description: '', event_date: '', secondary_date: '', tertiary_date: '', event_time: '', duration_hours: '', location: '', notes: '' });
  const [savingEvent, setSavingEvent] = useState(false);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [multiRows, setMultiRows] = useState([{ title: '', date: '' }, { title: '', date: '' }]);
  const [savingMulti, setSavingMulti] = useState(false);
  const [viewEventId, setViewEventId] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    const { data: allEvents } = await supabase.from('events').select('*, event_types(id, label)').eq('matter_id', matterId).order('event_date');
    setEvents(allEvents || []);
    const { data: etData } = await supabase.from('event_types').select('*').order('label');
    setEventTypes(etData || []);
    setLoading(false);
  }

  function typeLabelFor(eventTypeId) {
    return eventTypes.find((t) => t.id === eventTypeId)?.label;
  }

  function openAddEvent() {
    setEditingEventId(null);
    setEventForm({ event_type_id: '', description: '', event_date: '', secondary_date: '', tertiary_date: '', event_time: '', duration_hours: '', location: '', notes: '' });
    setEventModalOpen(true);
  }

  function openEditEvent(ev) {
    setEditingEventId(ev.id);
    setEventForm({
      event_type_id: ev.event_type_id || '',
      description: ev.description || '',
      event_date: ev.event_date || '',
      secondary_date: ev.secondary_date || '',
      tertiary_date: ev.tertiary_date || '',
      event_time: ev.event_time || '',
      duration_hours: ev.duration_minutes ? String(ev.duration_minutes / 60) : '',
      location: ev.location || '',
      notes: ev.notes || '',
    });
    setEventModalOpen(true);
  }

  async function saveEvent() {
    if (!eventForm.event_type_id) { alert('Pick an event type.'); return; }
    if (!eventForm.event_date) { alert('Pick a date.'); return; }
    const label = typeLabelFor(eventForm.event_type_id);
    const cfg = EVENT_TYPE_CONFIG[label] || { dateLabels: ['Date'], timed: false, hasLocation: false };
    setSavingEvent(true);
    const payload = {
      matter_id: matterId,
      event_type_id: eventForm.event_type_id,
      description: eventForm.description?.trim() || null,
      event_date: eventForm.event_date,
      secondary_date: cfg.dateLabels.length >= 2 ? (eventForm.secondary_date || null) : null,
      tertiary_date: cfg.dateLabels.length >= 3 ? (eventForm.tertiary_date || null) : null,
      all_day: cfg.timed ? !eventForm.event_time : true,
      event_time: cfg.timed && eventForm.event_time ? eventForm.event_time : null,
      duration_minutes: cfg.timed && eventForm.duration_hours ? Math.round(parseFloat(eventForm.duration_hours) * 60) : null,
      location: cfg.hasLocation ? (eventForm.location?.trim() || null) : null,
      notes: eventForm.notes?.trim() || null,
    };
    let error;
    if (editingEventId) {
      ({ error } = await supabase.from('events').update(payload).eq('id', editingEventId));
    } else {
      ({ error } = await supabase.from('events').insert(payload));
    }
    setSavingEvent(false);
    if (error) { alert(error.message); return; }
    setEventModalOpen(false);
    load();
    onChanged?.();
  }

  async function removeEvent(id) {
    if (!confirm('Remove this event?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
    onChanged?.();
  }

  async function togglePin(ev) {
    const { error } = await supabase.from('events').update({ pin_to_overview: !ev.pin_to_overview }).eq('id', ev.id);
    if (error) { alert(error.message); return; }
    load();
    onChanged?.();
  }

  async function toggleStar(ev) {
    if (!ev.star_to_infobar) {
      const currentCount = events.filter((e) => e.star_to_infobar).length;
      if (currentCount >= 3) { alert('Only 3 items can be starred to the info bar at once. Unstar one first.'); return; }
    }
    const { error } = await supabase.from('events').update({ star_to_infobar: !ev.star_to_infobar }).eq('id', ev.id);
    if (error) { alert(error.message); return; }
    load();
    onChanged?.();
  }

  async function toggleComplete(ev) {
    const { error } = await supabase.from('events').update({ completed: !ev.completed }).eq('id', ev.id);
    if (error) { alert(error.message); return; }
    load();
    onChanged?.();
  }

  function toggleFrame(frame) { setFrameOpen((f) => ({ ...f, [frame]: !f[frame] })); }
  function setFrameSortMode(frame, mode) { setFrameSort((f) => ({ ...f, [frame]: mode })); }

  function eventsForFrame(frame) {
    const types = FRAME_TYPES[frame];
    let list = events.filter((ev) => types.includes(ev.event_types?.label));
    if (frameSort[frame] === 'type') {
      list = [...list].sort((a, b) =>
        (a.event_types?.label || '').localeCompare(b.event_types?.label || '') ||
        new Date(a.event_date) - new Date(b.event_date)
      );
    } else {
      list = [...list].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    }
    return list;
  }

  function addMultiRow() { setMultiRows((r) => [...r, { title: '', date: '' }]); }
  function updateMultiRow(i, field, val) { setMultiRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))); }
  function removeMultiRow(i) { setMultiRows((r) => r.filter((_, idx) => idx !== i)); }

  async function saveMulti() {
    const courtDeadlineType = eventTypes.find((t) => t.label === 'Court Deadline');
    if (!courtDeadlineType) { alert('Court Deadline type not found.'); return; }
    const validRows = multiRows.filter((r) => r.title.trim() && r.date);
    if (validRows.length === 0) { alert('Add at least one title and date.'); return; }
    setSavingMulti(true);
    const payload = validRows.map((r) => ({
      matter_id: matterId,
      event_type_id: courtDeadlineType.id,
      description: r.title.trim(),
      event_date: r.date,
      all_day: true,
    }));
    const { error } = await supabase.from('events').insert(payload);
    setSavingMulti(false);
    if (error) { alert(error.message); return; }
    setMultiModalOpen(false);
    setMultiRows([{ title: '', date: '' }, { title: '', date: '' }]);
    load();
    onChanged?.();
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function locationLink(location) {
    if (!location) return null;
    const trimmed = location.trim();
    const looksLikeMeetingLink = /^https?:\/\//i.test(trimmed) || /zoom\.us|teams\.microsoft\.com|meet\.google\.com/i.test(trimmed);
    if (looksLikeMeetingLink) {
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
  }

  function badgeClassForType(label) {
    if (label === 'Deposition') return 'badge-blue';
    if (label === 'Discovery') return 'badge-orange';
    return 'badge-gray';
  }

  function renderEventRow(ev) {
    const label = ev.event_types?.label;
    const cfg = EVENT_TYPE_CONFIG[label] || { dateLabels: ['Date'], timed: false, hasLocation: false };
    const dates = DATE_FIELDS.slice(0, cfg.dateLabels.length).map((f) => ev[f]).filter(Boolean);
    return (
      <div key={ev.id} className="party-row" style={{ opacity: ev.completed ? 0.55 : 1, alignItems: 'flex-start' }}>
        <span onClick={() => togglePin(ev)} style={{ cursor: 'pointer', opacity: ev.pin_to_overview ? 1 : 0.3, fontSize: '15px' }} title="Pin to Overview Key Deadlines">📌</span>
        <span onClick={() => toggleStar(ev)} style={{ cursor: 'pointer', opacity: ev.star_to_infobar ? 1 : 0.3, fontSize: '15px' }} title="Star to Info Bar">★</span>
        <input type="checkbox" checked={!!ev.completed} onChange={() => toggleComplete(ev)} title="Complete" style={{ marginTop: '3px' }} />
        <span className="muted" style={{ fontSize: '12px', minWidth: '120px', flexShrink: 0, paddingTop: '3px' }}>
          {dates.map((d) => formatDateSafe(d)).join(label === 'Trial' ? ' – ' : ' / ')}
          {cfg.timed && ev.event_time ? ` @ ${formatTime12h(ev.event_time)}` : ''}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{ev.description || '—'}</span>
            <span className={`badge ${badgeClassForType(label)}`} style={{ fontSize: '10px', fontWeight: 400 }}>{label || '—'}</span>
            {ev.notes && (
              <span className="muted" style={{ fontSize: '10px' }}>
                {ev.notes.length > 100
                  ? <a className="row-link" onClick={() => setViewEventId(ev.id)}>view record for notes</a>
                  : ev.notes}
              </span>
            )}
          </div>
          {cfg.hasLocation && ev.location && (
            <a href={locationLink(ev.location)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>{ev.location}</a>
          )}
        </div>
        <div className="row-actions">
          <button className="btn-small" onClick={() => openEditEvent(ev)}>Edit</button>
          <button className="btn-small btn-small-danger" onClick={() => removeEvent(ev.id)}>Remove</button>
        </div>
      </div>
    );
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={openAddEvent}>+ Add Event</button>
        <button className="btn" onClick={() => setMultiModalOpen(true)}>+ Add Multiple</button>
      </div>

      {Object.keys(FRAME_TYPES).map((frame) => {
        const list = eventsForFrame(frame);
        const isOpen = frameOpen[frame];
        return (
          <div className="section-card" key={frame}>
            <div className="section-card-header" style={{ cursor: 'pointer' }} onClick={() => toggleFrame(frame)}>
              <h3>{isOpen ? '▾' : '▸'} {frame} <span className="muted" style={{ fontWeight: 400, fontSize: '13px' }}>({list.length})</span></h3>
              {isOpen && (
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px' }}>
                  <button className={`btn-small ${frameSort[frame] === 'date' ? 'btn-primary' : ''}`} onClick={() => setFrameSortMode(frame, 'date')}>Sort: Date</button>
                  <button className={`btn-small ${frameSort[frame] === 'type' ? 'btn-primary' : ''}`} onClick={() => setFrameSortMode(frame, 'type')}>Sort: Type</button>
                </div>
              )}
            </div>
            {isOpen && (
              list.length === 0
                ? <p className="muted">No events yet.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{list.map((ev) => renderEventRow(ev))}</div>
            )}
          </div>
        );
      })}

      {eventModalOpen && (
        <div className="modal-overlay" onClick={() => setEventModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEventId ? 'Edit Event' : 'Add Event'}</h2>
              <button className="modal-close" onClick={() => setEventModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Event Type</label>
                <select value={eventForm.event_type_id} onChange={(e) => setEventForm((f) => ({ ...f, event_type_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {eventTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Title / Description</label>
                <input value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Hearing on Pl Motion to Compel" />
              </div>
              {(() => {
                const label = typeLabelFor(eventForm.event_type_id);
                const cfg = EVENT_TYPE_CONFIG[label] || { dateLabels: ['Date'], timed: false, hasLocation: false };
                return (
                  <>
                    <div className="form-row">
                      {cfg.dateLabels.map((dl, i) => (
                        <div className="form-field" key={DATE_FIELDS[i]}>
                          <label>{dl}</label>
                          <input type="date" value={eventForm[DATE_FIELDS[i]]} onChange={(e) => setEventForm((f) => ({ ...f, [DATE_FIELDS[i]]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    {cfg.timed && (
                      <div className="form-row">
                        <div className="form-field">
                          <label>Time (optional)</label>
                          <input type="time" value={eventForm.event_time} onChange={(e) => setEventForm((f) => ({ ...f, event_time: e.target.value }))} />
                        </div>
                        <div className="form-field">
                          <label>Duration, hours (optional)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={eventForm.duration_hours}
                            onChange={(e) => setEventForm((f) => ({ ...f, duration_hours: e.target.value }))}
                            placeholder="e.g. 1.0, 1.5, 2.0"
                          />
                        </div>
                      </div>
                    )}
                    {cfg.hasLocation && (
                      <div className="form-field">
                        <label>Location / Meeting Info</label>
                        <input
                          value={eventForm.location}
                          onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
                          placeholder="Address, Zoom link, or dial-in info"
                        />
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="form-field">
                <label>Notes (short reference, not a full record)</label>
                <textarea
                  rows={3}
                  value={eventForm.notes}
                  onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Contemplated motions in limine"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveEvent} disabled={savingEvent}>{savingEvent ? 'Saving…' : editingEventId ? 'Save' : 'Add Event'}</button>
                <button className="btn" onClick={() => setEventModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {multiModalOpen && (
        <div className="modal-overlay" onClick={() => setMultiModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>Add Multiple Court Deadlines</h2>
              <button className="modal-close" onClick={() => setMultiModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>All entries below are added as Court Deadline events.</p>
              {multiRows.map((row, i) => (
                <div className="form-row" key={i} style={{ alignItems: 'flex-end' }}>
                  <div className="form-field"><label>Title</label><input value={row.title} onChange={(e) => updateMultiRow(i, 'title', e.target.value)} placeholder="e.g. Discovery Cutoff" /></div>
                  <div className="form-field"><label>Date</label><input type="date" value={row.date} onChange={(e) => updateMultiRow(i, 'date', e.target.value)} /></div>
                  {multiRows.length > 1 && <button className="btn-small btn-small-danger" onClick={() => removeMultiRow(i)} style={{ marginBottom: '16px' }}>×</button>}
                </div>
              ))}
              <button className="btn-small" onClick={addMultiRow}>+ Add Row</button>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveMulti} disabled={savingMulti}>{savingMulti ? 'Saving…' : 'Add All'}</button>
                <button className="btn" onClick={() => setMultiModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewEventId && (() => {
        const ev = events.find((e) => e.id === viewEventId);
        if (!ev) return null;
        const label = ev.event_types?.label;
        const cfg = EVENT_TYPE_CONFIG[label] || { dateLabels: ['Date'], timed: false, hasLocation: false };
        const dates = DATE_FIELDS.slice(0, cfg.dateLabels.length).map((f) => ev[f]).filter(Boolean);
        return (
          <div className="modal-overlay" onClick={() => setViewEventId(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{ev.description || 'Event'}</h2>
                <button className="modal-close" onClick={() => setViewEventId(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-card"><span className="detail-label">Type</span><span className="detail-value">{label || '—'}</span></div>
                  <div className="detail-card">
                    <span className="detail-label">{cfg.dateLabels.join(' / ')}</span>
                    <span className="detail-value">
                      {dates.map((d) => formatDateSafe(d)).join(label === 'Trial' ? ' – ' : ' / ') || '—'}
                      {cfg.timed && ev.event_time ? ` @ ${formatTime12h(ev.event_time)}` : ''}
                    </span>
                  </div>
                  {cfg.hasLocation && (
                    <div className="detail-card">
                      <span className="detail-label">Location / Meeting Info</span>
                      <span className="detail-value">
                        {ev.location ? <a href={locationLink(ev.location)} target="_blank" rel="noopener noreferrer">{ev.location}</a> : '—'}
                      </span>
                    </div>
                  )}
                  <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
                    <span className="detail-label">Notes</span>
                    <span className="detail-value">{ev.notes || '—'}</span>
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={() => { setViewEventId(null); openEditEvent(ev); }}>Edit</button>
                  <button className="btn" onClick={() => setViewEventId(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
