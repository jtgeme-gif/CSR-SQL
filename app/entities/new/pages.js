'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function NewEntityPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', zip: '',
    phone: '', email: '', website: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()])
    );

    const { data, error } = await supabase.from('entities').insert(payload).select().single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push('/entities');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New Entity</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-box">{error}</div>}

        <div className="form-field">
          <label>Name *</label>
          <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. TMHCC, City of Hancock" />
        </div>

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
            <label>Phone</label>
            <input type="text" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="text" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Website</label>
          <input type="text" value={form.website} onChange={(e) => update('website', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Notes</label>
          <input type="text" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Entity'}
          </button>
        </div>
      </form>
    </div>
  );
}
