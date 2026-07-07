'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';
import PersonPicker from './PersonPicker';

const FORMATS = ['In-Person', 'Zoom', 'Teams', 'Phone'];

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
  if (looksLikeMeetingLink) return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

function formatCurrency(n) {
  if (n === null || n === undefined || n === '') return null;
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function MediationTab({ matterId }) {
  const [loading, setLoading] = useState(true);

  // Mediation Sessions
  const [mediationTypeId, setMediationTypeId] = useState(null);
  const [sessions, setSessions] = useState([]); // events of type Mediation, embedding mediation_sessions + mediator
  const [notesBySession, setNotesBySession] = useState({});
  const [expanded, setExpanded] = useState({});
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null); // event id being edited, null = create
  const [sessionForm, setSessionForm] = useState(blankSessionForm());
  const [savingSession, setSavingSession] = useState(false);
  const [newNoteText, setNewNoteText] = useState({}); // keyed by session row id
  const [addingNoteFor, setAddingNoteFor] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Demands & Offers
  const [negotiations, setNegotiations] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [negModalOpen, setNegModalOpen] = useState(false);
  const [editingNegId, setEditingNegId] = useState(null);
  const [negForm, setNegForm] = useState(blankNegForm());
  const [savingNeg, setSavingNeg] = useState(false);

  function blankSessionForm() {
    return {
      event_date: '', event_time: '',
      mediator_id: null, mediator_name: '',
      format: '', location: '',
      summary_due_date: '', mediator_response_deadline: '',
      resolved: false, settlement_amount: '',
    };
  }
  function blankNegForm() {
    return { entry_type_id: '', entry_date: '', amount: '', expiration_date: '', counter_amount: '', counter_date: '', response_deadline: '', notes: '' };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);

    const { data: mediationType } = await supabase.from('event_types').select('id').eq('label', 'Mediation').single();
    const typeId = mediationType?.id || null;
    setMediationTypeId(typeId);

    if (typeId) {
      const { data: sessionEvents } = await supabase
        .from('events')
        .select('*, mediation_sessions(*, people(first_name, last_name))')
        .eq('matter_id', matterId)
        .eq('event_type_id', typeId)
        .order('event_date');
      setSessions(sessionEvents || []);

      const sessionIds = (sessionEvents || []).map((ev) => ev.mediation_sessions?.id).filter(Boolean);
      if (sessionIds.length > 0) {
        const { data: notes } = await supabase
          .from('mediation_notes')
          .select('*')
          .in('mediation_session_id', sessionIds)
          .order('created_at', { ascending: false });
        const grouped = {};
        (notes || []).forEach((n) => {
          if (!grouped[n.mediation_session_id]) grouped[n.mediation_session_id] = [];
          grouped[n.mediation_session_id].push(n);
        });
        setNotesBySession(grouped);
      } else {
        setNotesBySession({});
      }
    } else {
      setSessions([]);
      setNotesBySession({});
    }

    const { data: negData } = await supabase
      .from('settlement_negotiations')
      .select('*, entry_types(label)')
      .eq('matter_id', matterId)
      .order('entry_date');
    setNegotiations(negData || []);

    const { data: entryTypesData } = await supabase.from('entry_types').select('*').neq('label', 'Mediation').order('label');
    setEntryTypes(entryTypesData || []);

    setLoading(false);
  }

  // ---------- Mediation Sessions ----------
  function toggleExpanded(eventId) {
    setExpanded((e) => ({ ...e, [eventId]: !e[eventId] }));
  }

  function openAddSession() {
    setEditingEventId(null);
    setSessionForm(blankSessionForm());
    setSessionModalOpen(true);
  }

  function openEditSession(ev) {
    const session = ev.mediation_sessions;
    setEditingEventId(ev.id);
    setSessionForm({
      event_date: ev.event_date || '',
      event_time: ev.event_time || '',
      mediator_id: session?.mediator_id || null,
      mediator_name: session?.people ? `${session.people.first_name || ''} ${session.people.last_name || ''}`.trim() : '',
      format: session?.format || '',
      location: ev.location || '',
      summary_due_date: session?.summary_due_date || '',
      mediator_response_deadline: session?.mediator_response_deadline || '',
      resolved: session?.resolved || false,
      settlement_amount: session?.settlement_amount ?? '',
    });
    setSessionModalOpen(true);
  }

  async function saveSession() {
    if (!sessionForm.event_date) { alert('Pick a date.'); return; }
    if (!mediationTypeId) { alert('Mediation event type not found — check the migration ran.'); return; }
    setSavingSession(true);

    const eventPayload = {
      matter_id: matterId,
      event_type_id: mediationTypeId,
      description: sessionForm.mediator_name || 'Mediation',
      event_date: sessionForm.event_date,
      all_day: !sessionForm.event_time,
      event_time: sessionForm.event_time || null,
      location: sessionForm.location?.trim() || null,
    };

    let eventId = editingEventId;
    if (editingEventId) {
      const { error } = await supabase.from('events').update(eventPayload).eq('id', editingEventId);
      if (error) { alert(error.message); setSavingSession(false); return; }
    } else {
      const { data, error } = await supabase.from('events').insert(eventPayload).select('id').single();
      if (error) { alert(error.message); setSavingSession(false); return; }
      eventId = data.id;
    }

    const sessionPayload = {
      event_id: eventId,
      mediator_id: sessionForm.mediator_id,
      format: sessionForm.format || null,
      summary_due_date: sessionForm.summary_due_date || null,
      mediator_response_deadline: sessionForm.mediator_response_deadline || null,
      resolved: !!sessionForm.resolved,
      settlement_amount: sessionForm.settlement_amount !== '' ? parseFloat(sessionForm.settlement_amount) : null,
    };

    // Upsert on event_id, since a bare event (created from Scheduling) may not
    // have a mediation_sessions row yet.
    const { error: sessionError } = await supabase.from('mediation_sessions').upsert(sessionPayload, { onConflict: 'event_id' });
    setSavingSession(false);
    if (sessionError) { alert(sessionError.message); return; }
    setSessionModalOpen(false);
    load();
  }

  async function removeSession(eventId) {
    if (!confirm('Remove this mediation session? This also removes it from the Scheduling tab.')) return;
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) { alert(error.message); return; }
    load();
  }

  async function addNote(sessionId) {
    const text = (newNoteText[sessionId] || '').trim();
    if (!text) return;
    const { data: userData } = await supabase.auth.getUser();
    const authorName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';
    const { error } = await supabase.from('mediation_notes').insert({ mediation_session_id: sessionId, note_text: text, author_name: authorName });
    if (error) { alert(error.message); return; }
    setNewNoteText((n) => ({ ...n, [sessionId]: '' }));
    setAddingNoteFor(null);
    load();
  }

  function startEditNote(note) {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note_text);
  }

  async function saveEditNote() {
    const { error } = await supabase.from('mediation_notes').update({ note_text: editingNoteText.trim() }).eq('id', editingNoteId);
    if (error) { alert(error.message); return; }
    setEditingNoteId(null);
    load();
  }

  async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    const { error } = await supabase.from('mediation_notes').delete().eq('id', noteId);
    if (error) { alert(error.message); return; }
    load();
  }

  function sessionHeaderLabel(ev) {
    const session = ev.mediation_sessions;
    const mediatorName = session?.people ? `${session.people.first_name || ''} ${session.people.last_name || ''}`.trim() : null;
    const dateStr = ev.event_date ? formatDateSafe(ev.event_date) : '—';
    const timeStr = ev.event_time ? ` ${formatTime12h(ev.event_time)}` : '';
    return `${mediatorName || 'Mediation'} - ${dateStr}${timeStr}`;
  }

  // ---------- Demands & Offers ----------
  function openAddNeg() {
    setEditingNegId(null);
    setNegForm(blankNegForm());
    setNegModalOpen(true);
  }

  function openEditNeg(n) {
    setEditingNegId(n.id);
    setNegForm({
      entry_type_id: n.entry_type_id || '',
      entry_date: n.entry_date || '',
      amount: n.amount ?? '',
      expiration_date: n.expiration_date || '',
      counter_amount: n.counter_amount ?? '',
      counter_date: n.counter_date || '',
      response_deadline: n.response_deadline || '',
      notes: n.notes || '',
    });
    setNegModalOpen(true);
  }

  async function saveNeg() {
    if (!negForm.entry_type_id) { alert('Pick a type.'); return; }
    if (!negForm.entry_date) { alert('Pick a date.'); return; }
    setSavingNeg(true);
    const payload = {
      matter_id: matterId,
      entry_type_id: negForm.entry_type_id,
      entry_date: negForm.entry_date,
      amount: negForm.amount !== '' ? parseFloat(negForm.amount) : null,
      expiration_date: negForm.expiration_date || null,
      counter_amount: negForm.counter_amount !== '' ? parseFloat(negForm.counter_amount) : null,
      counter_date: negForm.counter_date || null,
      response_deadline: negForm.response_deadline || null,
      notes: negForm.notes?.trim() || null,
    };
    let error;
    if (editingNegId) {
      ({ error } = await supabase.from('settlement_negotiations').update(payload).eq('id', editingNegId));
    } else {
      ({ error } = await supabase.from('settlement_negotiations').insert(payload));
    }
    setSavingNeg(false);
    if (error) { alert(error.message); return; }
    setNegModalOpen(false);
    load();
  }

  async function removeNeg(id) {
    if (!confirm('Remove this entry?')) return;
    const { error } = await supabase.from('settlement_negotiations').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      {/* MEDIATION SESSIONS */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Mediation Sessions</h3>
          <button className="btn btn-primary" onClick={openAddSession}>+ Add Mediation Session</button>
        </div>

        {sessions.length === 0 && <p className="muted">No mediation sessions yet.</p>}

        {sessions.map((ev) => {
          const session = ev.mediation_sessions;
          const isOpen = !!expanded[ev.id];
          const notes = session ? (notesBySession[session.id] || []) : [];
          return (
            <div key={ev.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '10px', overflow: 'hidden' }}>
              <div
                onClick={() => toggleExpanded(ev.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-bg)', cursor: 'pointer' }}
              >
                <span className="row-link" style={{ fontWeight: 600 }}>{sessionHeaderLabel(ev)}</span>
                <span>{isOpen ? '▾' : '▸'}</span>
              </div>

              {isOpen && (
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, padding: '14px', borderRight: '1px solid var(--border)' }}>
                    <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="detail-card">
                        <span className="detail-label">Mediation Date</span>
                        <span className="detail-value">{formatDateSafe(ev.event_date)}{ev.event_time ? ` ${formatTime12h(ev.event_time)}` : ''}</span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Summary Due Date</span>
                        <span className="detail-value">{session?.summary_due_date ? formatDateSafe(session.summary_due_date) : '—'}</span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Mediator Response Deadline</span>
                        <span className="detail-value">{session?.mediator_response_deadline ? formatDateSafe(session.mediator_response_deadline) : '—'}</span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Mediator</span>
                        <span className="detail-value">
                          {session?.people ? <span className="chip">{session.people.first_name} {session.people.last_name}</span> : '—'}
                        </span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Format</span>
                        <span className="detail-value">{session?.format || '—'}</span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Location/Connection Info</span>
                        <span className="detail-value">
                          {ev.location ? <a href={locationLink(ev.location)} target="_blank" rel="noopener noreferrer">{ev.location}</a> : '—'}
                        </span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Resolved</span>
                        <span className="detail-value">{session?.resolved ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="detail-card">
                        <span className="detail-label">Settlement Amount</span>
                        <span className="detail-value">{formatCurrency(session?.settlement_amount) || '—'}</span>
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button className="btn btn-primary" onClick={() => openEditSession(ev)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => removeSession(ev.id)}>Delete</button>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong>Mediation Notes</strong>
                      <button className="btn-small" onClick={() => setAddingNoteFor(session?.id)} disabled={!session}>+ Add Note</button>
                    </div>

                    {!session && <p className="muted">Fill in and save the session details first to enable notes.</p>}

                    {session && addingNoteFor === session.id && (
                      <div style={{ marginBottom: '10px' }}>
                        <textarea
                          rows={2}
                          value={newNoteText[session.id] || ''}
                          onChange={(e) => setNewNoteText((n) => ({ ...n, [session.id]: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <div className="modal-actions">
                          <button className="btn-small btn-primary" onClick={() => addNote(session.id)}>Save Note</button>
                          <button className="btn-small" onClick={() => setAddingNoteFor(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {session && notes.length === 0 && <p className="muted">No notes yet.</p>}

                    {notes.map((n) => (
                      <div key={n.id} style={{ background: 'var(--gray-bg)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span className="muted" style={{ fontSize: '11px' }}>
                            {new Date(n.created_at).toLocaleString()} • {n.author_name}
                          </span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-small" onClick={() => startEditNote(n)}>Edit</button>
                            <button className="btn-small btn-small-danger" onClick={() => deleteNote(n.id)}>Delete</button>
                          </div>
                        </div>
                        {editingNoteId === n.id ? (
                          <div style={{ marginTop: '6px' }}>
                            <textarea
                              rows={2}
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                            <div className="modal-actions">
                              <button className="btn-small btn-primary" onClick={saveEditNote}>Save</button>
                              <button className="btn-small" onClick={() => setEditingNoteId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: '4px' }}>{n.note_text}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DEMANDS & OFFERS */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Demands & Offers</h3>
          <button className="btn btn-primary" onClick={openAddNeg}>+ Add Demand/Offer</button>
        </div>

        {negotiations.length === 0 && <p className="muted">No entries yet.</p>}

        {negotiations.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Demand</th>
                <th>Expiration</th>
                <th>Counter/Offer</th>
                <th>Counter Date</th>
                <th>Response Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {negotiations.map((n) => (
                <tr key={n.id}>
                  <td>{formatDateSafe(n.entry_date)}</td>
                  <td><span className={`badge ${n.entry_types?.label === 'Demand' ? 'badge-red' : 'badge-green'}`}>{n.entry_types?.label || '—'}</span></td>
                  <td>{formatCurrency(n.amount) || '—'}</td>
                  <td>{n.expiration_date ? formatDateSafe(n.expiration_date) : '—'}</td>
                  <td>{formatCurrency(n.counter_amount) || '—'}</td>
                  <td>{n.counter_date ? formatDateSafe(n.counter_date) : '—'}</td>
                  <td>{n.response_deadline ? formatDateSafe(n.response_deadline) : '—'}</td>
                  <td className="row-actions">
                    <button className="btn-small" onClick={() => openEditNeg(n)}>Edit</button>
                    <button className="btn-small btn-small-danger" onClick={() => removeNeg(n.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD/EDIT MEDIATION SESSION MODAL */}
      {sessionModalOpen && (
        <div className="modal-overlay" onClick={() => setSessionModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEventId ? 'Edit Mediation Session' : 'Add Mediation Session'}</h2>
              <button className="modal-close" onClick={() => setSessionModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field"><label>Date</label><input type="date" value={sessionForm.event_date} onChange={(e) => setSessionForm((f) => ({ ...f, event_date: e.target.value }))} /></div>
                <div className="form-field"><label>Time (optional)</label><input type="time" value={sessionForm.event_time} onChange={(e) => setSessionForm((f) => ({ ...f, event_time: e.target.value }))} /></div>
              </div>
              <div className="form-field">
                <label>Mediator</label>
                <PersonPicker
                  value={sessionForm.mediator_id}
                  valueName={sessionForm.mediator_name}
                  onChange={(id, name) => setSessionForm((f) => ({ ...f, mediator_id: id, mediator_name: name }))}
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Format</label>
                  <select value={sessionForm.format} onChange={(e) => setSessionForm((f) => ({ ...f, format: e.target.value }))}>
                    <option value="">Select…</option>
                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Location / Connection Info</label>
                  <input value={sessionForm.location} onChange={(e) => setSessionForm((f) => ({ ...f, location: e.target.value }))} placeholder="Address, Zoom link, or dial-in info" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Summary Due Date</label><input type="date" value={sessionForm.summary_due_date} onChange={(e) => setSessionForm((f) => ({ ...f, summary_due_date: e.target.value }))} /></div>
                <div className="form-field"><label>Mediator Response Deadline</label><input type="date" value={sessionForm.mediator_response_deadline} onChange={(e) => setSessionForm((f) => ({ ...f, mediator_response_deadline: e.target.value }))} /></div>
              </div>
              <div className="form-checkbox">
                <input type="checkbox" id="session-resolved" checked={!!sessionForm.resolved} onChange={(e) => setSessionForm((f) => ({ ...f, resolved: e.target.checked }))} />
                <label htmlFor="session-resolved">Resolved</label>
              </div>
              <div className="form-field">
                <label>Settlement Amount</label>
                <input type="number" value={sessionForm.settlement_amount} onChange={(e) => setSessionForm((f) => ({ ...f, settlement_amount: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveSession} disabled={savingSession}>{savingSession ? 'Saving…' : 'Save'}</button>
                <button className="btn" onClick={() => setSessionModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT DEMAND/OFFER MODAL */}
      {negModalOpen && (
        <div className="modal-overlay" onClick={() => setNegModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNegId ? 'Edit Entry' : 'Add Demand/Offer'}</h2>
              <button className="modal-close" onClick={() => setNegModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Type</label>
                  <select value={negForm.entry_type_id} onChange={(e) => setNegForm((f) => ({ ...f, entry_type_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {entryTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Date</label><input type="date" value={negForm.entry_date} onChange={(e) => setNegForm((f) => ({ ...f, entry_date: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>{entryTypes.find((t) => t.id === negForm.entry_type_id)?.label === 'Offer' ? 'Offer Amount' : 'Demand Amount'}</label><input type="number" value={negForm.amount} onChange={(e) => setNegForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div className="form-field"><label>Expiration</label><input type="date" value={negForm.expiration_date} onChange={(e) => setNegForm((f) => ({ ...f, expiration_date: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Counter/Offer</label><input type="number" value={negForm.counter_amount} onChange={(e) => setNegForm((f) => ({ ...f, counter_amount: e.target.value }))} /></div>
                <div className="form-field"><label>Counter Date</label><input type="date" value={negForm.counter_date} onChange={(e) => setNegForm((f) => ({ ...f, counter_date: e.target.value }))} /></div>
              </div>
              <div className="form-field"><label>Response Deadline</label><input type="date" value={negForm.response_deadline} onChange={(e) => setNegForm((f) => ({ ...f, response_deadline: e.target.value }))} /></div>
              <div className="form-field">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={negForm.notes}
                  onChange={(e) => setNegForm((f) => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveNeg} disabled={savingNeg}>{savingNeg ? 'Saving…' : editingNegId ? 'Save' : 'Add Entry'}</button>
                <button className="btn" onClick={() => setNegModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
