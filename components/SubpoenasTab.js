'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';
import MethodPicker from './MethodPicker';

const REQUEST_TYPES = ['Subpoena', 'FOIA', 'Other'];
const STATUSES = ['Open', 'Closed', 'Withdrawn'];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status) {
  if (status === 'Closed') return 'badge-green';
  if (status === 'Withdrawn') return 'badge-gray';
  return 'badge-blue';
}

export default function SubpoenasTab({ matterId }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  function blankForm() {
    return {
      target: '', request_type: 'Subpoena', method_id: null, method_name: '',
      date_submitted: todayStr(), date_due: addDays(todayStr(), 30), date_received: '',
      status: 'Open', request_content: '', notes: '',
    };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('case_requests')
      .select('*, subpoena_methods(label)')
      .eq('matter_id', matterId)
      .order('date_submitted', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm(blankForm());
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditingId(r.id);
    setForm({
      target: r.target || '',
      request_type: r.request_type || 'Subpoena',
      method_id: r.method_id || null,
      method_name: r.subpoena_methods?.label || '',
      date_submitted: r.date_submitted || '',
      date_due: r.date_due || '',
      date_received: r.date_received || '',
      status: r.status || 'Open',
      request_content: r.request_content || '',
      notes: r.notes || '',
    });
    setModalOpen(true);
  }

  function updateDateSubmitted(value) {
    // Auto-recalculates the due date off the new submission date — matches
    // the original OMT behavior. Still freely editable afterward.
    setForm((f) => ({ ...f, date_submitted: value, date_due: value ? addDays(value, 30) : f.date_due }));
  }

  async function saveRequest() {
    if (!form.target.trim()) { alert('Enter who the request went to.'); return; }
    setSaving(true);
    const payload = {
      matter_id: matterId,
      target: form.target.trim(),
      request_type: form.request_type,
      method_id: form.method_id,
      date_submitted: form.date_submitted || null,
      date_due: form.date_due || null,
      date_received: form.date_received || null,
      status: form.status,
      request_content: form.request_content?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('case_requests').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('case_requests').insert(payload));
    }
    setSaving(false);
    if (error) { alert(error.message); return; }
    setModalOpen(false);
    load();
  }

  async function removeRequest(id) {
    if (!confirm('Remove this request?')) return;
    const { error } = await supabase.from('case_requests').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Request</button>
      </div>

      <div className="section-card">
        {requests.length === 0 && <p className="muted">No subpoena/FOIA requests yet.</p>}

        {requests.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Method</th>
                <th>Date Submitted</th>
                <th>Date Due</th>
                <th>Date Received</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.target}</td>
                  <td>{r.request_type || '—'}</td>
                  <td>{r.subpoena_methods?.label || '—'}</td>
                  <td>{r.date_submitted ? formatDateSafe(r.date_submitted) : '—'}</td>
                  <td>{r.date_due ? formatDateSafe(r.date_due) : '—'}</td>
                  <td>{r.date_received ? formatDateSafe(r.date_received) : '—'}</td>
                  <td><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                  <td className="row-actions">
                    <button className="btn-small" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-small btn-small-danger" onClick={() => removeRequest(r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Request' : 'Add Request'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Target (who the request went to)</label>
                <input value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="e.g. St. Joseph Hospital Records Dept" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Type</label>
                  <select value={form.request_type} onChange={(e) => setForm((f) => ({ ...f, request_type: e.target.value }))}>
                    {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Method (Send Via)</label>
                  <MethodPicker
                    value={form.method_id}
                    valueName={form.method_name}
                    onChange={(id, name) => setForm((f) => ({ ...f, method_id: id, method_name: name }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Date Submitted</label>
                  <input type="date" value={form.date_submitted} onChange={(e) => updateDateSubmitted(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Date Due</label>
                  <input type="date" value={form.date_due} onChange={(e) => setForm((f) => ({ ...f, date_due: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Date Received</label>
                  <input type="date" value={form.date_received} onChange={(e) => setForm((f) => ({ ...f, date_received: e.target.value }))} />
                </div>
              </div>
              <div className="form-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Request Content (description of records sought)</label>
                <textarea
                  rows={2}
                  value={form.request_content}
                  onChange={(e) => setForm((f) => ({ ...f, request_content: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Withdrawn, waiting on auths, needs follow-up…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveRequest} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save' : 'Add Request'}</button>
                <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
