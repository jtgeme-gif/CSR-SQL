'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import PersonPicker from '../../../components/PersonPicker';
import StaffPicker from '../../../components/StaffPicker';
import { deriveShortName } from '../../../lib/deriveShortName';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// CSR-SQL's New Matter form - no Incident Date, no Defendants (this app is
// purely CSR/admin tracking, not case substance). Initial CSR Due replaces
// Incident Date in the layout: auto-fills from Date Opened + 45 days, but
// stays freely overridable for backdating legacy matters or handling
// insurer-granted extensions. Claims Reps support multiple, since real
// matters commonly have more than one.
export default function NewMatterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    case_name: '',
    short_name: '',
    practice_group: '',
    case_status: 'Pre-litigation Monitoring',
    date_opened: '',
    csr_initial_due: '',
    file_number: '',
  });
  const [shortNameTouched, setShortNameTouched] = useState(false);
  const [csrInitialDueTouched, setCsrInitialDueTouched] = useState(false);

  const [claimReps, setClaimReps] = useState([]);
  const [claimRepPick, setClaimRepPick] = useState({ person_id: null, person_name: '' });
  const [claimNumberDraft, setClaimNumberDraft] = useState('');

  const [staffList, setStaffList] = useState([]);
  const [staffPick, setStaffPick] = useState({ staff_id: null, staff_name: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showNoAttorneyConfirm, setShowNoAttorneyConfirm] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateCaseName(value) {
    setForm((f) => {
      const next = { ...f, case_name: value };
      if (!shortNameTouched) {
        next.short_name = deriveShortName(value);
      }
      return next;
    });
  }

  function updateShortName(value) {
    setShortNameTouched(true);
    update('short_name', value);
  }

  // Same "auto-fill until touched" pattern as Short Name - Initial CSR Due
  // defaults to Date Opened + 45, but a manual edit sticks even if Date
  // Opened changes afterward.
  function updateDateOpened(value) {
    setForm((f) => {
      const next = { ...f, date_opened: value };
      if (!csrInitialDueTouched) {
        next.csr_initial_due = value ? addDays(value, 45) : '';
      }
      return next;
    });
  }

  function updateCsrInitialDue(value) {
    setCsrInitialDueTouched(true);
    update('csr_initial_due', value);
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.case_name.trim()) {
      setError('Case Name is required.');
      return;
    }
    setError(null);

    const assignedIds = staffList.map((s) => s.staff_id);
    let anyAttorney = false;
    if (assignedIds.length > 0) {
      const { data: attorneyCheck } = await supabase.from('staff').select('id, is_attorney').in('id', assignedIds);
      anyAttorney = (attorneyCheck || []).some((s) => s.is_attorney);
    }

    if (!anyAttorney) {
      setShowNoAttorneyConfirm(true);
      return;
    }

    await createMatter();
  }

  async function createMatter() {
    setShowNoAttorneyConfirm(false);
    setSaving(true);
    setError(null);

    const payload = {
      created_in_csr: true,
      case_name: form.case_name.trim(),
      short_name: form.short_name.trim() || null,
      practice_group: form.practice_group || null,
      case_status: form.case_status || null,
      date_opened: form.date_opened || null,
      file_number: form.file_number.trim() || null,
      csr_initial_due: form.csr_initial_due || null,
      csr_next_due: form.csr_initial_due || null,
    };

    const { data: matter, error: matterError } = await supabase.from('matters').insert(payload).select().single();

    if (matterError) {
      setError(matterError.message);
      setSaving(false);
      return;
    }

    const matterId = matter.id;

    if (claimReps.length > 0) {
      const crPayload = claimReps.map((cr) => ({
        matter_id: matterId,
        person_id: cr.person_id,
        claim_number: cr.claim_number || null,
      }));
      const { error: crError } = await supabase.from('matter_claim_reps').insert(crPayload);
      if (crError) alert('Matter created, but adding claims reps failed: ' + crError.message);
    }

    if (staffList.length > 0) {
      const staffPayload = staffList.map((s) => ({ matter_id: matterId, staff_id: s.staff_id }));
      const { error: staffError } = await supabase.from('matter_staff').insert(staffPayload);
      if (staffError) alert('Matter created, but assigning staff failed: ' + staffError.message);
    }

    const assignedIds = staffList.map((s) => s.staff_id);
    if (assignedIds.length > 0) {
      try {
        const sendResp = await fetch('/api/send-new-matter-forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matterId, caseName: form.case_name.trim(), staffIds: assignedIds }),
        });
        const sendData = await sendResp.json();
        if (!sendResp.ok) {
          alert('Matter created, but sending the CSR/Budget forms failed: ' + (sendData.error || 'Unknown error'));
        }
      } catch (sendErr) {
        alert('Matter created, but sending the CSR/Budget forms failed: ' + sendErr.message);
      }
    }

    setSaving(false);
    router.push(`/matters/${matterId}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New CSR</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-box">{error}</div>}

        <div className="form-field">
          <label>Case Name *</label>
          <input
            type="text"
            value={form.case_name}
            onChange={(e) => updateCaseName(e.target.value)}
            placeholder="e.g. Smith v. Jones"
          />
        </div>

        <div className="form-field">
          <label>Short Name</label>
          <input
            type="text"
            value={form.short_name}
            onChange={(e) => updateShortName(e.target.value)}
            placeholder="Auto-fills from Case Name, e.g. 'Smith' - override anytime"
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
            <input type="date" value={form.date_opened} onChange={(e) => updateDateOpened(e.target.value)} />
          </div>

          <div className="form-field">
            <label>Initial CSR Due</label>
            <input type="date" value={form.csr_initial_due} onChange={(e) => updateCsrInitialDue(e.target.value)} />
            <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
              Auto-fills from Date Opened + 45 days. Override for legacy matters or a granted extension.
            </p>
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

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Matter'}
          </button>
          <button type="button" className="btn" onClick={() => router.push('/')}>Cancel</button>
        </div>
      </form>

      {showNoAttorneyConfirm && (
        <div className="modal-overlay" onClick={() => setShowNoAttorneyConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>No Attorney Assigned</h2>
              <button className="modal-close" onClick={() => setShowNoAttorneyConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                This matter will be created with no attorney assigned. The blank CSR and Litigation Budget
                forms are only emailed to assigned attorneys, so they won't be sent until one is added.
              </p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={createMatter}>Continue Anyway</button>
                <button className="btn" onClick={() => setShowNoAttorneyConfirm(false)}>Return &amp; Assign Attorney</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
