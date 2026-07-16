'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import PhoneInput from './PhoneInput';
import { formatPhoneDisplay } from '../lib/formatPhone';

const BLANK_FORM = {
  first_name: '', middle_name: '', last_name: '',
  email: '', cell_phone: '', work_phone: '', extension: '',
  active: true, is_attorney: false,
};

// staffId === null/undefined => Create mode (blank form, opens straight into editing)
export default function StaffModal({ staffId, startInEdit, onClose, onChanged }) {
  const isCreate = !staffId;
  const [staffMember, setStaffMember] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [editing, setEditing] = useState(isCreate || !!startInEdit);
  const [form, setForm] = useState(isCreate ? BLANK_FORM : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isCreate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('staff').select('*').eq('id', staffId).single();
    if (!error) {
      setStaffMember(data);
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
      first_name: form.first_name?.trim(),
      middle_name: form.middle_name?.trim() || null,
      last_name: form.last_name?.trim(),
      email: form.email?.trim() || null,
      cell_phone: form.cell_phone?.trim() || null,
      work_phone: form.work_phone?.trim() || null,
      extension: form.extension?.trim() || null,
      active: !!form.active,
      is_attorney: !!form.is_attorney,
    };
  }

  async function handleSave() {
    const payload = buildPayload();
    if (!payload.first_name || !payload.last_name) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError(null);

    if (isCreate) {
      const { error } = await supabase.from('staff').insert(payload);
      setSaving(false);
      if (error) { setError(error.message); return; }
      onChanged?.();
      onClose();
      return;
    }

    const { error } = await supabase.from('staff').update(payload).eq('id', staffId);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${staffMember.first_name} ${staffMember.last_name}? This can't be undone. Consider marking them Inactive instead if they've been on past matters.`)) return;
    const { error } = await supabase.from('staff').delete().eq('id', staffId);
    if (error) { setError(error.message); return; }
    onChanged?.();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isCreate ? 'New Staff Member' : loading ? 'Loading…' : `${staffMember?.first_name || ''} ${staffMember?.last_name || ''}`}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="error-box">{error}</div>}

        {!loading && !isCreate && staffMember && !editing && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">Email</span><span className="detail-value">{staffMember.email || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Active</span><span className="detail-value">{staffMember.active ? 'Yes' : 'No'}</span></div>
              <div className="detail-card"><span className="detail-label">Attorney</span><span className="detail-value">{staffMember.is_attorney ? 'Yes' : 'No'}</span></div>
              <div className="detail-card"><span className="detail-label">Cell Phone</span><span className="detail-value">{formatPhoneDisplay(staffMember.cell_phone) || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Work Phone</span><span className="detail-value">{formatPhoneDisplay(staffMember.work_phone) || '—'}{staffMember.extension ? ` ext. ${staffMember.extension}` : ''}</span></div>
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
              <div className="form-field"><label>First Name *</label><input value={form.first_name || ''} onChange={(e) => update('first_name', e.target.value)} /></div>
              <div className="form-field"><label>Middle Name</label><input value={form.middle_name || ''} onChange={(e) => update('middle_name', e.target.value)} /></div>
              <div className="form-field"><label>Last Name *</label><input value={form.last_name || ''} onChange={(e) => update('last_name', e.target.value)} /></div>
            </div>
            <div className="form-field"><label>Email</label><input value={form.email || ''} onChange={(e) => update('email', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-field"><label>Cell Phone</label><PhoneInput value={form.cell_phone} onChange={(v) => update('cell_phone', v)} /></div>
              <div className="form-field"><label>Work Phone</label><PhoneInput value={form.work_phone} onChange={(v) => update('work_phone', v)} /></div>
              <div className="form-field"><label>Extension</label><input value={form.extension || ''} onChange={(e) => update('extension', e.target.value)} /></div>
            </div>
            <div className="form-checkbox">
              <input type="checkbox" id="staff-active" checked={!!form.active} onChange={(e) => update('active', e.target.checked)} />
              <label htmlFor="staff-active">Active</label>
            </div>
            <div className="form-checkbox">
              <input type="checkbox" id="staff-attorney" checked={!!form.is_attorney} onChange={(e) => update('is_attorney', e.target.checked)} />
              <label htmlFor="staff-attorney">Attorney</label>
            </div>

            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create Staff Member' : 'Save'}</button>
              <button className="btn" onClick={() => { if (isCreate) { onClose(); } else { setEditing(false); setForm(staffMember); } }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
