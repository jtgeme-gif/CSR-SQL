'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import EntityPicker from './EntityPicker';
import PersonPicker from './PersonPicker';
import PhoneInput from './PhoneInput';
import { formatPhoneDisplay } from '../lib/formatPhone';
import { formatDateSafe } from '../lib/formatDate';

const IDENTITIES = ['Individual', 'Attorney', 'Judge', 'Client Rep'];

const BLANK_FORM = {
  first_name: '', middle_name: '', last_name: '', title: '',
  identity: 'Individual',
  entity_id: null, entity_name: '',
  department: '',
  address: '', city: '', state: '', zip: '',
  phone1: '', phone1_label: '', phone2: '', phone2_label: '',
  email1: '', email1_label: '', email2: '', email2_label: '',
  website: '', mediator: false, expert: false, field_of_expertise: '',
  court_level: '', court_jurisdiction: '', magjudge: false,
  notes: '',
};

// personId === null/undefined => Create mode (blank form, opens straight into editing)
export default function PersonModal({ personId, startInEdit, onClose, onChanged }) {
  const isCreate = !personId;
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [editing, setEditing] = useState(isCreate || !!startInEdit);
  const [form, setForm] = useState(isCreate ? BLANK_FORM : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(!isCreate);
  const [showHistory, setShowHistory] = useState(false);
  const [depositionHistory, setDepositionHistory] = useState([]);
  const [linkedPeople, setLinkedPeople] = useState([]);
  const [linkedLoading, setLinkedLoading] = useState(!isCreate);
  const [linkPick, setLinkPick] = useState({ person_id: null, person_name: '' });
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!isCreate) { load(); loadHistory(); loadLinkedPeople(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  // Mutual, one row per pair - query both directions and combine, since a
  // link could have this person stored as either person_a_id or person_b_id.
  async function loadLinkedPeople() {
    setLinkedLoading(true);
    const [{ data: asA }, { data: asB }] = await Promise.all([
      supabase.from('person_links').select('id, person_b_id, people:person_b_id(id, first_name, last_name, identity, title)').eq('person_a_id', personId),
      supabase.from('person_links').select('id, person_a_id, people:person_a_id(id, first_name, last_name, identity, title)').eq('person_b_id', personId),
    ]);
    const combined = [
      ...(asA || []).map((r) => ({ linkId: r.id, ...r.people })),
      ...(asB || []).map((r) => ({ linkId: r.id, ...r.people })),
    ];
    setLinkedPeople(combined);
    setLinkedLoading(false);
  }

  async function addLink() {
    if (!linkPick.person_id) return;
    if (linkPick.person_id === personId) { alert('A person can\'t be linked to themselves.'); return; }
    setLinking(true);
    // Canonically order the pair (smaller id first) so the unique
    // constraint actually catches a duplicate regardless of which person
    // initiated the link.
    const [a, b] = [personId, linkPick.person_id].sort();
    const { error } = await supabase.from('person_links').insert({ person_a_id: a, person_b_id: b });
    setLinking(false);
    if (error) {
      if (error.code === '23505') { alert('These two people are already linked.'); }
      else { alert(error.message); }
      return;
    }
    setLinkPick({ person_id: null, person_name: '' });
    loadLinkedPeople();
  }

  async function removeLink(linkId) {
    const { error } = await supabase.from('person_links').delete().eq('id', linkId);
    if (error) { alert(error.message); return; }
    loadLinkedPeople();
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const { data: rows } = await supabase
      .from('case_people')
      .select('id, role, capacity, pro_se, matter_id, matters(id, case_name, created_at)')
      .eq('person_id', personId);

    const partyIds = (rows || []).map((r) => r.id);
    let repMap = {};
    if (partyIds.length > 0) {
      const { data: reps } = await supabase
        .from('case_people')
        .select('represents_case_person_id, people(first_name, last_name)')
        .in('represents_case_person_id', partyIds);
      (reps || []).forEach((r) => {
        const name = `${r.people?.first_name || ''} ${r.people?.last_name || ''}`.trim();
        if (!repMap[r.represents_case_person_id]) repMap[r.represents_case_person_id] = [];
        repMap[r.represents_case_person_id].push(name);
      });
    }

    const enriched = (rows || [])
      .map((r) => ({ ...r, repNames: repMap[r.id] || [] }))
      .sort((a, b) => new Date(b.matters?.created_at || 0) - new Date(a.matters?.created_at || 0));
    setHistoryRows(enriched);

    let depositions = [];
    if (partyIds.length > 0) {
      const { data: depType } = await supabase.from('event_types').select('id').eq('label', 'Deposition').single();
      if (depType?.id) {
        const { data: depEvents } = await supabase
          .from('events')
          .select('*, matters(case_name)')
          .eq('event_type_id', depType.id)
          .in('case_people_id', partyIds)
          .order('event_date', { ascending: false });
        depositions = depEvents || [];
      }
    }
    setDepositionHistory(depositions);

    setHistoryLoading(false);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('people')
      .select('*, entities(id, name)')
      .eq('id', personId)
      .single();
    if (!error) {
      setPerson(data);
      setForm({ ...data, entity_name: data.entities?.name || '' });
    } else {
      setError(error.message);
    }
    setLoading(false);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleEntityChange(id, name, entityRecord) {
    update('entity_id', id);
    update('entity_name', name);
    if (entityRecord) {
      update('address', entityRecord.address || '');
      update('city', entityRecord.city || '');
      update('state', entityRecord.state || '');
      update('zip', entityRecord.zip || '');
    }
  }

  function buildPayload() {
    return {
      first_name: form.first_name?.trim() || null,
      middle_name: form.middle_name?.trim() || null,
      last_name: form.last_name?.trim() || null,
      title: form.title?.trim() || null,
      identity: form.identity,
      entity_id: form.entity_id,
      department: form.department?.trim() || null,
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      zip: form.zip?.trim() || null,
      phone1: form.phone1?.trim() || null,
      phone1_label: form.phone1_label?.trim() || null,
      phone2: form.phone2?.trim() || null,
      phone2_label: form.phone2_label?.trim() || null,
      email1: form.email1?.trim() || null,
      email1_label: form.email1_label?.trim() || null,
      email2: form.email2?.trim() || null,
      email2_label: form.email2_label?.trim() || null,
      website: form.website?.trim() || null,
      mediator: !!form.mediator,
      expert: !!form.expert,
      field_of_expertise: form.field_of_expertise?.trim() || null,
      court_level: form.identity === 'Judge' ? (form.court_level?.trim() || null) : null,
      court_jurisdiction: form.identity === 'Judge' ? (form.court_jurisdiction?.trim() || null) : null,
      magjudge: form.identity === 'Judge' ? !!form.magjudge : false,
      notes: form.notes?.trim() || null,
    };
  }

  async function handleSave() {
    if (!form.first_name?.trim() && !form.last_name?.trim()) {
      setError('First or last name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = buildPayload();

    if (isCreate) {
      const { error } = await supabase.from('people').insert(payload);
      setSaving(false);
      if (error) { setError(error.message); return; }
      onChanged?.();
      onClose();
      return;
    }

    const { error } = await supabase.from('people').update(payload).eq('id', personId);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${person.first_name} ${person.last_name}? This can't be undone.`)) return;
    const { error } = await supabase.from('people').delete().eq('id', personId);
    if (error) { setError(error.message); return; }
    onChanged?.();
    onClose();
  }

  const everPlaintiff = historyRows.some((r) => r.role === 'Plaintiff');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ color: !isCreate && everPlaintiff ? 'var(--red)' : undefined }}>
            {isCreate ? 'New Person' : loading ? 'Loading…' : `${person?.first_name || ''} ${person?.last_name || ''}`}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="error-box">{error}</div>}

        {!loading && !isCreate && person && !editing && (
          <div className="modal-body">
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0, lineHeight: 1.5 }}>
                {person.title && <div style={{ color: 'var(--text-muted)' }}>{person.title}</div>}
                {(person.entities?.name || person.department) && (
                  <div style={{ color: 'var(--text-muted)' }}>
                    {[person.entities?.name, person.department].filter(Boolean).join(' – ')}
                  </div>
                )}
                {person.address && <div>{person.address}</div>}
                {(person.city || person.state || person.zip) && (
                  <div>{[person.city, person.state, person.zip].filter(Boolean).join(', ')}</div>
                )}
                {(person.phone1 || person.phone2) && (
                  <div>
                    {[formatPhoneDisplay(person.phone1), formatPhoneDisplay(person.phone2)].filter(Boolean).join('  /  ')}
                  </div>
                )}
                {(person.email1 || person.email2) && (
                  <div>{[person.email1, person.email2].filter(Boolean).join('  /  ')}</div>
                )}
                {person.website && (
                  <div>
                    <a href={person.website.startsWith('http') ? person.website : `https://${person.website}`} target="_blank" rel="noreferrer">{person.website}</a>
                  </div>
                )}

                {(person.mediator || person.expert || person.identity === 'Judge') && (
                  <div className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>
                    {[
                      person.mediator ? 'Mediator' : null,
                      person.expert ? 'Expert' : null,
                      person.identity === 'Judge' ? [person.court_level, person.court_jurisdiction].filter(Boolean).join(', ') + (person.magjudge ? ' (Magistrate)' : '') : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                {person.field_of_expertise && (
                  <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>{person.field_of_expertise}</div>
                )}
                {person.notes && (
                  <div className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>{person.notes}</div>
                )}
              </div>

              {!historyLoading && historyRows.length > 0 && (
                <div style={{ flex: '0 0 220px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>RECENT MATTERS</div>
                  {historyRows.slice(0, 3).map((r) => (
                    <div key={r.id} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.matters?.case_name || 'Unknown Matter'}</div>
                      <div className="muted" style={{ fontSize: '12px' }}>
                        {r.role}
                        {r.repNames.length > 0 ? ` — Represented by ${r.repNames.join(', ')}` : r.pro_se ? ' — Pro Se' : ''}
                      </div>
                    </div>
                  ))}
                  {historyRows.length > 3 && (
                    <button type="button" className="btn-small" onClick={() => setShowHistory(true)}>
                      +{historyRows.length - 3} more
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn" onClick={() => setShowHistory(true)}>History</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        )}

        {(isCreate || editing) && form && (
          <div className="modal-body">
            <div className="form-row">
              <div className="form-field"><label>First Name</label><input value={form.first_name || ''} onChange={(e) => update('first_name', e.target.value)} /></div>
              <div className="form-field"><label>Middle Name</label><input value={form.middle_name || ''} onChange={(e) => update('middle_name', e.target.value)} /></div>
              <div className="form-field"><label>Last Name</label><input value={form.last_name || ''} onChange={(e) => update('last_name', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Identity</label>
                <select value={form.identity} onChange={(e) => update('identity', e.target.value)}>
                  {IDENTITIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-field"><label>Title</label><input value={form.title || ''} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Chief of Police" /></div>
            </div>
            <div className="form-field">
              <label>Entity</label>
              <EntityPicker value={form.entity_id} valueName={form.entity_name} onChange={handleEntityChange} />
            </div>
            <div className="form-field">
              <label>Department</label>
              <input value={form.department || ''} onChange={(e) => update('department', e.target.value)} placeholder="e.g. Police Department, City Attorney's Office" />
            </div>
            {form.identity === 'Judge' && (
              <div className="form-row">
                <div className="form-field"><label>Court Level</label><input value={form.court_level || ''} onChange={(e) => update('court_level', e.target.value)} /></div>
                <div className="form-field"><label>Court Jurisdiction</label><input value={form.court_jurisdiction || ''} onChange={(e) => update('court_jurisdiction', e.target.value)} /></div>
              </div>
            )}
            {form.identity === 'Judge' && (
              <div className="form-checkbox">
                <input type="checkbox" id="edit-magjudge" checked={!!form.magjudge} onChange={(e) => update('magjudge', e.target.checked)} />
                <label htmlFor="edit-magjudge">Magistrate Judge</label>
              </div>
            )}
            <div className="form-field"><label>Address</label><input value={form.address || ''} onChange={(e) => update('address', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-field"><label>City</label><input value={form.city || ''} onChange={(e) => update('city', e.target.value)} /></div>
              <div className="form-field"><label>State</label><input value={form.state || ''} onChange={(e) => update('state', e.target.value)} /></div>
              <div className="form-field"><label>Zip</label><input value={form.zip || ''} onChange={(e) => update('zip', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Phone 1</label>
                <input className="field-sublabel" placeholder="Label" value={form.phone1_label || ''} onChange={(e) => update('phone1_label', e.target.value)} />
                <PhoneInput value={form.phone1} onChange={(v) => update('phone1', v)} />
              </div>
              <div className="form-field">
                <label>Phone 2</label>
                <input className="field-sublabel" placeholder="Label" value={form.phone2_label || ''} onChange={(e) => update('phone2_label', e.target.value)} />
                <PhoneInput value={form.phone2} onChange={(v) => update('phone2', v)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Email 1</label>
                <input className="field-sublabel" placeholder="Label" value={form.email1_label || ''} onChange={(e) => update('email1_label', e.target.value)} />
                <input value={form.email1 || ''} onChange={(e) => update('email1', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Email 2</label>
                <input className="field-sublabel" placeholder="Label" value={form.email2_label || ''} onChange={(e) => update('email2_label', e.target.value)} />
                <input value={form.email2 || ''} onChange={(e) => update('email2', e.target.value)} />
              </div>
            </div>
            <div className="form-field"><label>Website</label><input value={form.website || ''} onChange={(e) => update('website', e.target.value)} /></div>
            <div className="form-checkbox">
              <input type="checkbox" id="edit-mediator" checked={!!form.mediator} onChange={(e) => update('mediator', e.target.checked)} />
              <label htmlFor="edit-mediator">Mediator</label>
            </div>
            <div className="form-checkbox">
              <input type="checkbox" id="edit-expert" checked={!!form.expert} onChange={(e) => update('expert', e.target.checked)} />
              <label htmlFor="edit-expert">Expert</label>
            </div>
            <div className="form-field"><label>Expertise if Expert / Other Information</label><input value={form.field_of_expertise || ''} onChange={(e) => update('field_of_expertise', e.target.value)} /></div>
            <div className="form-field"><label>Notes</label><input value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} /></div>

            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create Person' : 'Save'}</button>
              <button className="btn" onClick={() => { if (isCreate) { onClose(); } else { setEditing(false); setForm({ ...person, entity_name: person.entities?.name || '' }); } }}>Cancel</button>
            </div>
          </div>
        )}

        {!isCreate && person && (
          <div className="modal-body" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Linked People
            </label>
            <div className="chip-row" style={{ marginBottom: '8px' }}>
              {!linkedLoading && linkedPeople.length === 0 && <span className="muted">Nobody linked yet.</span>}
              {linkedPeople.map((p) => (
                <span key={p.linkId} className="chip chip-removable">
                  {p.first_name} {p.last_name}
                  <span className="muted" style={{ fontSize: '11px' }}> — {p.title || p.identity}</span>
                  <button onClick={() => removeLink(p.linkId)}>×</button>
                </span>
              ))}
            </div>
            <div className="inline-add-row">
              <PersonPicker
                value={linkPick.person_id}
                valueName={linkPick.person_name}
                onChange={(id, name) => setLinkPick({ person_id: id, person_name: name })}
              />
              <button type="button" className="btn-small" onClick={addLink} disabled={linking}>{linking ? 'Linking…' : '+ Link'}</button>
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>History — {person?.first_name} {person?.last_name}</h2>
              <button className="modal-close" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="modal-body">
              {historyLoading && <p className="muted">Loading…</p>}
              {!historyLoading && historyRows.length === 0 && <p className="muted">No matter history yet.</p>}
              {!historyLoading && historyRows.map((r) => (
                <div key={r.id} className="party-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.matters?.case_name || 'Unknown Matter'}</div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      {r.role}{r.capacity ? ` ${r.capacity}` : ''}{r.pro_se ? ' — Pro Se' : ''}
                      {r.repNames.length > 0 ? ` — Represented by ${r.repNames.join(', ')}` : ''}
                    </div>
                  </div>
                </div>
              ))}

              {!historyLoading && depositionHistory.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, marginTop: '14px', marginBottom: '6px' }}>Depositions</div>
                  {depositionHistory.map((ev) => (
                    <div key={ev.id} className="party-row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{ev.matters?.case_name || 'Unknown Matter'}</div>
                        <div className="muted" style={{ fontSize: '12px' }}>
                          {formatDateSafe(ev.event_date)} — {ev.completed ? 'Deposition taken' : 'Scheduled, not yet taken'}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
