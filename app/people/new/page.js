'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import EntityPicker from '../../../components/EntityPicker';

const IDENTITIES = ['Individual', 'Attorney', 'Judge', 'Client Rep'];

export default function NewPersonPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', title: '',
    identity: 'Individual',
    entity_id: null, entity_name: '',
    department: '',
    address: '', city: '', state: '', zip: '',
    phone1: '', phone1_label: '', phone2: '', phone2_label: '',
    email1: '', email1_label: '', email2: '', email2_label: '',
    website: '',
    mediator: false, field_of_expertise: '',
    court_level: '', court_jurisdiction: '', magjudge: false,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleEntityChange(id, name, entityRecord) {
    update('entity_id', id);
    update('entity_name', name);
    // Auto-fill address from the entity as a starting point — still editable after.
    if (entityRecord) {
      update('address', entityRecord.address || '');
      update('city', entityRecord.city || '');
      update('state', entityRecord.state || '');
      update('zip', entityRecord.zip || '');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.first_name.trim() && !form.last_name.trim()) {
      setError('First or last name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      first_name: form.first_name.trim() || null,
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim() || null,
      title: form.title.trim() || null,
      identity: form.identity,
      entity_id: form.entity_id,
      department: form.department.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      phone1: form.phone1.trim() || null,
      phone1_label: form.phone1_label.trim() || null,
      phone2: form.phone2.trim() || null,
      phone2_label: form.phone2_label.trim() || null,
      email1: form.email1.trim() || null,
      email1_label: form.email1_label.trim() || null,
      email2: form.email2.trim() || null,
      email2_label: form.email2_label.trim() || null,
      website: form.website.trim() || null,
      mediator: form.mediator,
      field_of_expertise: form.field_of_expertise.trim() || null,
      court_level: form.identity === 'Judge' ? (form.court_level.trim() || null) : null,
      court_jurisdiction: form.identity === 'Judge' ? (form.court_jurisdiction.trim() || null) : null,
      magjudge: form.identity === 'Judge' ? form.magjudge : false,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from('people').insert(payload);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push('/people');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New Person</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-box">{error}</div>}

        <div className="form-row">
          <div className="form-field">
            <label>First Name</label>
            <input type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Middle Name</label>
            <input type="text" value={form.middle_name} onChange={(e) => update('middle_name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Last Name</label>
            <input type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Identity</label>
            <select value={form.identity} onChange={(e) => update('identity', e.target.value)}>
              {IDENTITIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Title</label>
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Chief of Police" />
          </div>
        </div>

        <div className="form-field">
          <label>Entity</label>
          <EntityPicker
            value={form.entity_id}
            valueName={form.entity_name}
            onChange={handleEntityChange}
          />
        </div>

        <div className="form-field">
          <label>Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => update('department', e.target.value)}
            placeholder="e.g. Police Department, City Attorney's Office"
          />
          <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Which department within the entity above — useful when one entity (e.g. a city) has multiple departments represented across your matters.
          </p>
        </div>

        {form.identity === 'Judge' && (
          <div className="form-row">
            <div className="form-field">
              <label>Court Level</label>
              <input type="text" value={form.court_level} onChange={(e) => update('court_level', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Court Jurisdiction</label>
              <input type="text" value={form.court_jurisdiction} onChange={(e) => update('court_jurisdiction', e.target.value)} placeholder="e.g. Eastern District" />
            </div>
          </div>
        )}
        {form.identity === 'Judge' && (
          <div className="form-checkbox">
            <input type="checkbox" id="magjudge" checked={form.magjudge} onChange={(e) => update('magjudge', e.target.checked)} />
            <label htmlFor="magjudge">Magistrate Judge</label>
          </div>
        )}

        <div className="form-field">
          <label>Address</label>
          <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>City</label>
            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} />
          </div>
          <div className="form-field">
            <label>State</label>
            <input type="text" value={form.state} onChange={(e) => update('state', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Zip</label>
            <input type="text" value={form.zip} onChange={(e) => update('zip', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Phone 1</label>
            <input type="text" className="field-sublabel" placeholder="Label (e.g. Work Cell)" value={form.phone1_label} onChange={(e) => update('phone1_label', e.target.value)} />
            <input type="text" value={form.phone1} onChange={(e) => update('phone1', e.target.value)} placeholder="Phone number" />
          </div>
          <div className="form-field">
            <label>Phone 2</label>
            <input type="text" className="field-sublabel" placeholder="Label (e.g. Personal Cell)" value={form.phone2_label} onChange={(e) => update('phone2_label', e.target.value)} />
            <input type="text" value={form.phone2} onChange={(e) => update('phone2', e.target.value)} placeholder="Phone number" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Email 1</label>
            <input type="text" className="field-sublabel" placeholder="Label (e.g. Work Email)" value={form.email1_label} onChange={(e) => update('email1_label', e.target.value)} />
            <input type="text" value={form.email1} onChange={(e) => update('email1', e.target.value)} placeholder="Email address" />
          </div>
          <div className="form-field">
            <label>Email 2</label>
            <input type="text" className="field-sublabel" placeholder="Label (e.g. Personal Email)" value={form.email2_label} onChange={(e) => update('email2_label', e.target.value)} />
            <input type="text" value={form.email2} onChange={(e) => update('email2', e.target.value)} placeholder="Email address" />
          </div>
        </div>

        <div className="form-field">
          <label>Website</label>
          <input type="text" value={form.website} onChange={(e) => update('website', e.target.value)} />
        </div>

        <div className="form-checkbox">
          <input type="checkbox" id="mediator" checked={form.mediator} onChange={(e) => update('mediator', e.target.checked)} />
          <label htmlFor="mediator">Mediator</label>
        </div>

        <div className="form-field">
          <label>Expertise if Expert / Other Information</label>
          <input type="text" value={form.field_of_expertise} onChange={(e) => update('field_of_expertise', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Notes</label>
          <input type="text" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Person'}
          </button>
        </div>
      </form>
    </div>
  );
}
