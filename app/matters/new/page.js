'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import PersonPicker from '../../../components/PersonPicker';
import EntityPicker from '../../../components/EntityPicker';
import StaffPicker from '../../../components/StaffPicker';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];

export default function NewMatterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    case_name: '',
    practice_group: '',
    case_status: 'Pre-litigation Monitoring',
    date_opened: '',
    incident_date: '',
    file_number: '',
  });

  const [claimRepPick, setClaimRepPick] = useState({ person_id: null, person_name: '' });
  const [claimNumber, setClaimNumber] = useState('');

  const [staffList, setStaffList] = useState([]);
  const [staffPick, setStaffPick] = useState({ staff_id: null, staff_name: '' });

  const [defendants, setDefendants] = useState([]);
  const [defendantForm, setDefendantForm] = useState({ partyType: 'Person', person_id: null, person_name: '', entity_id: null, entity_name: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  function addDefendantToList() {
    const f = defendantForm;
    if (f.partyType === 'Person' && !f.person_id) { alert('Pick or create a person first.'); return; }
    if (f.partyType === 'Entity' && !f.entity_id) { alert('Pick or create an entity first.'); return; }
    const name = f.partyType === 'Person' ? f.person_name : f.entity_name;
    setDefendants((d) => [...d, { ...f, name }]);
    setDefendantForm({ partyType: 'Person', person_id: null, person_name: '', entity_id: null, entity_name: '' });
  }
  function removeDefendantFromList(idx) {
    setDefendants((d) => d.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.case_name.trim()) {
      setError('Case Name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      case_name: form.case_name.trim(),
      practice_group: form.practice_group || null,
      case_status: form.case_status || null,
      date_opened: form.date_opened || null,
      incident_date: form.incident_date || null,
      file_number: form.file_number.trim() || null,
    };

    const { data: matter, error: matterError } = await supabase.from('matters').insert(payload).select().single();

    if (matterError) {
      setError(matterError.message);
      setSaving(false);
      return;
    }

    const matterId = matter.id;

    if (claimRepPick.person_id) {
      const { error: crError } = await supabase.from('matter_claim_reps').insert({
        matter_id: matterId,
        person_id: claimRepPick.person_id,
        claim_number: claimNumber.trim() || null,
      });
      if (crError) alert('Matter created, but adding the claim rep failed: ' + crError.message);
    }

    if (staffList.length > 0) {
      const staffPayload = staffList.map((s) => ({ matter_id: matterId, staff_id: s.staff_id }));
      const { error: staffError } = await supabase.from('matter_staff').insert(staffPayload);
      if (staffError) alert('Matter created, but assigning staff failed: ' + staffError.message);
    }

    for (const d of defendants) {
      if (d.partyType === 'Person') {
        const { error: dError } = await supabase.from('case_people').insert({ matter_id: matterId, person_id: d.person_id, role: 'Defendant' });
        if (dError) alert(`Matter created, but adding defendant "${d.name}" failed: ` + dError.message);
      } else {
        const { error: dError } = await supabase.from('case_entities').insert({ matter_id: matterId, entity_id: d.entity_id, role: 'Defendant' });
        if (dError) alert(`Matter created, but adding defendant "${d.name}" failed: ` + dError.message);
      }
    }

    // Auto-creates the matching CSR Tracker row, flagged CreatedinMT so the
    // standalone CSR app knows to lock it from manual editing there. Not
    // fatal if this fails - the matter itself is already saved either way.
    try {
      const csrRes = await fetch('/api/csr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseName: payload.case_name,
          practiceGroup: payload.practice_group,
          fileNumber: payload.file_number,
          dateOpened: payload.date_opened,
        }),
      });
      if (!csrRes.ok) {
        const body = await csrRes.json().catch(() => ({}));
        alert('Matter created, but adding it to the CSR Tracker failed: ' + (body.error || csrRes.status));
      }
    } catch (csrErr) {
      alert('Matter created, but adding it to the CSR Tracker failed: ' + csrErr.message);
    }

    setSaving(false);
    router.push(`/matters/${matterId}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New Matter</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-box">{error}</div>}

        <div className="form-field">
          <label>Case Name *</label>
          <input
            type="text"
            value={form.case_name}
            onChange={(e) => update('case_name', e.target.value)}
            placeholder="e.g. Smith v. Jones"
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Practice Group</label>
            <select value={form.practice_group} onChange={(e) => update('practice_group', e.target.value)}>
              <option value="">Select…</option>
              {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Case Status</label>
            <select value={form.case_status} onChange={(e) => update('case_status', e.target.value)}>
              {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Date Opened</label>
            <input type="date" value={form.date_opened} onChange={(e) => update('date_opened', e.target.value)} />
          </div>

          <div className="form-field">
            <label>Incident Date</label>
            <input type="date" value={form.incident_date} onChange={(e) => update('incident_date', e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Our File Number</label>
          <input
            type="text"
            value={form.file_number}
            onChange={(e) => update('file_number', e.target.value)}
            placeholder="e.g. 1979.1807 or 1979.1807 // 1979.1810"
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Claim Rep</label>
            <PersonPicker
              value={claimRepPick.person_id}
              valueName={claimRepPick.person_name}
              onChange={(id, name) => setClaimRepPick({ person_id: id, person_name: name })}
            />
          </div>
          <div className="form-field">
            <label>Claim Number</label>
            <input type="text" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Assigned Staff</label>
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
          <label>Defendants</label>
          <div className="chip-row">
            {defendants.length === 0 && <span className="muted">None added yet.</span>}
            {defendants.map((d, i) => (
              <span key={i} className="chip chip-removable">
                {d.name} <span className="muted" style={{ fontSize: '11px' }}>({d.partyType})</span>
                <button type="button" onClick={() => removeDefendantFromList(i)}>×</button>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              type="button"
              className={`btn-small ${defendantForm.partyType === 'Person' ? 'btn-primary' : ''}`}
              onClick={() => setDefendantForm((f) => ({ ...f, partyType: 'Person' }))}
            >
              Person
            </button>
            <button
              type="button"
              className={`btn-small ${defendantForm.partyType === 'Entity' ? 'btn-primary' : ''}`}
              onClick={() => setDefendantForm((f) => ({ ...f, partyType: 'Entity' }))}
            >
              Entity
            </button>
          </div>

          <div className="inline-add-row">
            {defendantForm.partyType === 'Person' ? (
              <PersonPicker
                value={defendantForm.person_id}
                valueName={defendantForm.person_name}
                onChange={(id, name) => setDefendantForm((f) => ({ ...f, person_id: id, person_name: name }))}
              />
            ) : (
              <EntityPicker
                value={defendantForm.entity_id}
                valueName={defendantForm.entity_name}
                onChange={(id, name) => setDefendantForm((f) => ({ ...f, entity_id: id, entity_name: name }))}
              />
            )}
            <button type="button" className="btn-small" onClick={addDefendantToList}>+ Add Defendant</button>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Matter'}
          </button>
          <button type="button" className="btn" onClick={() => router.push('/')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
