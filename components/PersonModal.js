'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import EntityPicker from './EntityPicker';

const IDENTITIES = ['Individual', 'Attorney', 'Judge', 'Client Rep'];

const BLANK_FORM = {
  first_name: '', middle_name: '', last_name: '', title: '',
  identity: 'Individual',
  entity_id: null, entity_name: '',
  address: '', city: '', state: '', zip: '',
  phone1: '', phone1_label: '', phone2: '', phone2_label: '',
  email1: '', email1_label: '', email2: '', email2_label: '',
  website: '', mediator: false, field_of_expertise: '',
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

  useEffect(() => {
    if (!isCreate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isCreate ? 'New Person' : loading ? 'Loading…' : `${person?.first_name || ''} ${person?.last_name || ''}`}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="error-box">{error}</div>}

        {!loading && !isCreate && person && !editing && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">Identity</span><span className="detail-value">{person.identity}</span></div>
              <div className="detail-card"><span className="detail-label">Title</span><span className="detail-value">{person.title || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Entity</span><span className="detail-value">{person.entities?.name || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Mediator</span><span className="detail-value">{person.mediator ? 'Yes' : 'No'}</span></div>
              <div className="detail-card"><span className="detail-label">{person.phone1_label || 'Phone 1'}</span><span className="detail-value">{person.phone1 || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">{person.phone2_label || 'Phone 2'}</span><span className="detail-value">{person.phone2 || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">{person.email1_label || 'Email 1'}</span><span className="detail-value">{person.email1 || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">{person.email2_label || 'Email 2'}</span><span className="detail-value">{person.email2 || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Address</span><span className="detail-value">{[person.address, person.city, person.state, person.zip].filter(Boolean).join(', ') || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Website</span><span className="detail-value">{person.website || '—'}</span></div>
              {person.identity === 'Judge' && (
                <>
                  <div className="detail-card"><span className="detail-label">Court Level</span><span className="detail-value">{person.court_level || '—'}</span></div>
                  <div className="detail-card"><span className="detail-label">Court Jurisdiction</span><span className="detail-value">{person.court_jurisdiction || '—'}</span></div>
                  <div className="detail-card"><span className="detail-label">Magistrate Judge</span><span className="detail-value">{person.magjudge ? 'Yes' : 'No'}</span></div>
                </>
              )}
              {person.field_of_expertise && (
                <div className="detail-card"><span className="detail-label">Expertise if Expert / Other Information</span><span className="detail-value">{person.field_of_expertise}</span></div>
              )}
              {person.notes && (
                <div className="detail-card" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Notes</span><span className="detail-value">{person.notes}</span></div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
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
                <input value={form.phone1 || ''} onChange={(e) => update('phone1', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Phone 2</label>
                <input className="field-sublabel" placeholder="Label" value={form.phone2_label || ''} onChange={(e) => update('phone2_label', e.target.value)} />
                <input value={form.phone2 || ''} onChange={(e) => update('phone2', e.target.value)} />
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
            <div className="form-field"><label>Expertise if Expert / Other Information</label><input value={form.field_of_expertise || ''} onChange={(e) => update('field_of_expertise', e.target.value)} /></div>
            <div className="form-field"><label>Notes</label><input value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} /></div>

            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create Person' : 'Save'}</button>
              <button className="btn" onClick={() => { if (isCreate) { onClose(); } else { setEditing(false); setForm({ ...person, entity_name: person.entities?.name || '' }); } }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
