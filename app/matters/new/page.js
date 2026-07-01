'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

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
    court_case_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
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
      court_case_number: form.court_case_number.trim() || null,
    };

    const { data, error } = await supabase.from('matters').insert(payload).select().single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push(`/matters/${data.id}`);
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
            placeholder="e.g. Walby"
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
          <label>Court Case Number</label>
          <input
            type="text"
            value={form.court_case_number}
            onChange={(e) => update('court_case_number', e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Matter'}
          </button>
        </div>
      </form>
    </div>
  );
}
