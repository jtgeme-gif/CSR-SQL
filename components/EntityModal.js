'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const BLANK_FORM = { name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', website: '', notes: '' };

// entityId === null/undefined => Create mode (blank form, opens straight into editing)
export default function EntityModal({ entityId, startInEdit, onClose, onChanged }) {
  const isCreate = !entityId;
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [editing, setEditing] = useState(isCreate || !!startInEdit);
  const [form, setForm] = useState(isCreate ? BLANK_FORM : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isCreate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('entities').select('*').eq('id', entityId).single();
    if (!error) {
      setEntity(data);
      setForm(data);
    } else {
      setError(error.message);
    }
    setLoading(false);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function buildPayload() {
    return {
      name: form.name?.trim(),
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      zip: form.zip?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      website: form.website?.trim() || null,
      notes: form.notes?.trim() || null,
    };
  }

  async function handleSave() {
    const payload = buildPayload();
    if (!payload.name) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    if (isCreate) {
      const { error } = await supabase.from('entities').insert(payload);
      setSaving(false);
      if (error) { setError(error.message); return; }
      onChanged?.();
      onClose();
      return;
    }

    const { error } = await supabase.from('entities').update(payload).eq('id', entityId);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${entity.name}? This can't be undone. People linked to this entity will keep their link cleared, not be deleted.`)) return;
    const { error } = await supabase.from('entities').delete().eq('id', entityId);
    if (error) { setError(error.message); return; }
    onChanged?.();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isCreate ? 'New Entity' : loading ? 'Loading…' : entity?.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="error-box">{error}</div>}

        {!loading && !isCreate && entity && !editing && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">Address</span><span className="detail-value">{[entity.address, entity.city, entity.state, entity.zip].filter(Boolean).join(', ') || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Phone</span><span className="detail-value">{entity.phone || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Email</span><span className="detail-value">{entity.email || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Website</span><span className="detail-value">{entity.website || '—'}</span></div>
              {entity.notes && (
                <div className="detail-card" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Notes</span><span className="detail-value">{entity.notes}</span></div>
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
            <div className="form-field"><label>Name *</label><input value={form.name || ''} onChange={(e) => update('name', e.target.value)} /></div>
            <div className="form-field"><label>Address</label><input value={form.address || ''} onChange={(e) => update('address', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-field"><label>City</label><input value={form.city || ''} onChange={(e) => update('city', e.target.value)} /></div>
              <div className="form-field"><label>State</label><input value={form.state || ''} onChange={(e) => update('state', e.target.value)} /></div>
              <div className="form-field"><label>Zip</label><input value={form.zip || ''} onChange={(e) => update('zip', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label>Phone</label><input value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} /></div>
              <div className="form-field"><label>Email</label><input value={form.email || ''} onChange={(e) => update('email', e.target.value)} /></div>
            </div>
            <div className="form-field"><label>Website</label><input value={form.website || ''} onChange={(e) => update('website', e.target.value)} /></div>
            <div className="form-field"><label>Notes</label><input value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} /></div>

            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create Entity' : 'Save'}</button>
              <button className="btn" onClick={() => { if (isCreate) { onClose(); } else { setEditing(false); setForm(entity); } }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
