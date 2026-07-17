'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';
import PersonPicker from './PersonPicker';
import StaffPicker from './StaffPicker';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];

// CSR-SQL's own Edit modal, replacing the "Edit in Matter Tracker" link -
// since all data lives in the same shared Supabase tables regardless of
// which app touches it, there's no real reason to force a trip to NMT just
// to fix a typo in the case name or reassign staff. View-only by default,
// same edit-gate pattern as EntityModal/StaffModal elsewhere in the app.
// Props: matterId, onClose, onSaved (called after a successful save, so the
// caller - list or detail page - can refresh).
export default function MatterEditModal({ matterId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [matter, setMatter] = useState(null);
  const [form, setForm] = useState(null);

  const [staffList, setStaffList] = useState([]);
  const [staffPick, setStaffPick] = useState({ staff_id: null, staff_name: '' });

  const [claimReps, setClaimReps] = useState([]);
  const [claimRepPick, setClaimRepPick] = useState({ person_id: null, person_name: '' });
  const [claimNumberDraft, setClaimNumberDraft] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: matterData, error: matterError } = await supabase.from('matters').select('*').eq('id', matterId).single();
    if (matterError) { setError(matterError.message); setLoading(false); return; }

    const { data: staffData } = await supabase
      .from('matter_staff')
      .select('staff_id, staff(first_name, last_name)')
      .eq('matter_id', matterId);

    const { data: crData } = await supabase
      .from('matter_claim_reps')
      .select('id, person_id, claim_number, people(first_name, last_name)')
      .eq('matter_id', matterId);

    setMatter(matterData);
    setForm(matterData);
    setStaffList((staffData || []).map((s) => ({
      staff_id: s.staff_id,
      staff_name: `${s.staff?.first_name || ''} ${s.staff?.last_name || ''}`.trim(),
    })));
    setClaimReps((crData || []).map((cr) => ({
      person_id: cr.person_id,
      person_name: `${cr.people?.first_name || ''} ${cr.people?.last_name || ''}`.trim(),
      claim_number: cr.claim_number || '',
    })));
    setLoading(false);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addStaffToList() {
    if (!staffPick.staff_id) return;
    if (staffList.some((s) => s.staff_id === staffPick.staff_id)) {
      setStaffPick({ staff_id: null, staff_name: '' });
      return;
    }
    setStaffList((s) => [...s, staffPick]);
    setStaffPick({ staff_id: null, staff_name: '' });
  }
  function removeStaffFromList(staffId) {
    setStaffList((s) => s.filter((x) => x.staff_id !== staffId));
  }

  function addClaimRepToList() {
    if (!claimRepPick.person_id) { alert('Pick or create a claims rep first.'); return; }
    setClaimReps((c) => [...c, { person_id: claimRepPick.person_id, person_name: claimRepPick.person_name, claim_number: claimNumberDraft.trim() }]);
    setClaimRepPick({ person_id: null, person_name: '' });
    setClaimNumberDraft('');
  }
  function removeClaimRepFromList(idx) {
    setClaimReps((c) => c.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      case_name: form.case_name?.trim(),
      file_number: form.file_number?.trim() || null,
      practice_group: form.practice_group || null,
      case_status: form.case_status || null,
      date_opened: form.date_opened || null,
      csr_initial_due: form.csr_initial_due || null,
      csr_next_due: form.csr_next_due || null,
    };
    if (!payload.case_name) { setError('Case Name is required.'); setSaving(false); return; }

    const { error: matterError } = await supabase.from('matters').update(payload).eq('id', matterId);
    if (matterError) { setError(matterError.message); setSaving(false); return; }

    // Simplest correct approach given low volume per matter: replace the
    // whole staff/claim-rep list rather than diffing adds/removes.
    const { error: delStaffError } = await supabase.from('matter_staff').delete().eq('matter_id', matterId);
    if (delStaffError) { setError('Saved matter, but updating assigned staff failed: ' + delStaffError.message); setSaving(false); return; }
    if (staffList.length > 0) {
      const { error: insStaffError } = await supabase.from('matter_staff').insert(
        staffList.map((s) => ({ matter_id: matterId, staff_id: s.staff_id }))
      );
      if (insStaffError) { setError('Saved matter, but updating assigned staff failed: ' + insStaffError.message); setSaving(false); return; }
    }

    const { error: delCrError } = await supabase.from('matter_claim_reps').delete().eq('matter_id', matterId);
    if (delCrError) { setError('Saved matter, but updating claims reps failed: ' + delCrError.message); setSaving(false); return; }
    if (claimReps.length > 0) {
      const { error: insCrError } = await supabase.from('matter_claim_reps').insert(
        claimReps.map((cr) => ({ matter_id: matterId, person_id: cr.person_id, claim_number: cr.claim_number || null }))
      );
      if (insCrError) { setError('Saved matter, but updating claims reps failed: ' + insCrError.message); setSaving(false); return; }
    }

    setSaving(false);
    setEditing(false);
    await load();
    onSaved?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{loading ? 'Loading…' : matter?.case_name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="error-box">{error}</div>}

        {!loading && matter && !editing && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">File Number</span><span className="detail-value">{matter.file_number || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Practice Group</span><span className="detail-value">{matter.practice_group || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Status</span><span className="detail-value">{matter.case_status || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Date Opened</span><span className="detail-value">{matter.date_opened ? formatDateSafe(matter.date_opened) : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Initial CSR Due</span><span className="detail-value">{matter.csr_initial_due ? formatDateSafe(matter.csr_initial_due) : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Next CSR Due</span><span className="detail-value">{matter.csr_next_due ? formatDateSafe(matter.csr_next_due) : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Assigned Attorneys</span><span className="detail-value">{staffList.length ? staffList.map((s) => s.staff_name).join(', ') : '—'}</span></div>
              <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
                <span className="detail-label">Claims Reps</span>
                <span className="detail-value">
                  {claimReps.length ? claimReps.map((cr, i) => (
                    <div key={i}>{cr.person_name}{cr.claim_number ? ` — ${cr.claim_number}` : ''}</div>
                  )) : '—'}
                </span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
            </div>
          </div>
        )}

        {!loading && matter && editing && form && (
          <div className="modal-body">
            <div className="form-field">
              <label>Case Name *</label>
              <input value={form.case_name || ''} onChange={(e) => update('case_name', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>File Number</label>
                <input value={form.file_number || ''} onChange={(e) => update('file_number', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Practice Group</label>
                <select value={form.practice_group || ''} onChange={(e) => update('practice_group', e.target.value)}>
                  <option value="">Select…</option>
                  {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Status</label>
                <select value={form.case_status || ''} onChange={(e) => update('case_status', e.target.value)}>
                  {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Date Opened</label>
                <input type="date" value={form.date_opened || ''} onChange={(e) => update('date_opened', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Initial CSR Due</label>
                <input type="date" value={form.csr_initial_due || ''} onChange={(e) => update('csr_initial_due', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Next CSR Due</label>
                <input type="date" value={form.csr_next_due || ''} onChange={(e) => update('csr_next_due', e.target.value)} />
              </div>
            </div>

            <div className="form-field">
              <label>Assigned Attorneys</label>
              <div className="chip-row">
                {staffList.length === 0 && <span className="muted">Nobody assigned yet.</span>}
                {staffList.map((s) => (
                  <span key={s.staff_id} className="chip chip-removable">
                    {s.staff_name}
                    <button type="button" onClick={() => removeStaffFromList(s.staff_id)}>×</button>
                  </span>
                ))}
              </div>
              <div className="inline-add-row">
                <StaffPicker
                  value={staffPick.staff_id}
                  valueName={staffPick.staff_name}
                  onChange={(id, name) => setStaffPick({ staff_id: id, staff_name: name })}
                />
                <button type="button" className="btn-small" onClick={addStaffToList}>+ Add</button>
              </div>
            </div>

            <div className="form-field">
              <label>Claims Reps</label>
              <div className="chip-row">
                {claimReps.length === 0 && <span className="muted">None added yet.</span>}
                {claimReps.map((cr, i) => (
                  <span key={i} className="chip chip-removable">
                    {cr.person_name}{cr.claim_number ? ` — ${cr.claim_number}` : ''}
                    <button type="button" onClick={() => removeClaimRepFromList(i)}>×</button>
                  </span>
                ))}
              </div>
              <div className="inline-add-row">
                <PersonPicker
                  value={claimRepPick.person_id}
                  valueName={claimRepPick.person_name}
                  onChange={(id, name) => setClaimRepPick({ person_id: id, person_name: name })}
                />
                <input
                  type="text"
                  placeholder="Claim number"
                  value={claimNumberDraft}
                  onChange={(e) => setClaimNumberDraft(e.target.value)}
                  style={{ maxWidth: '160px' }}
                />
                <button type="button" className="btn-small" onClick={addClaimRepToList}>+ Add</button>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => { setEditing(false); setForm(matter); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
