'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';

export default function MediationTab({ matterId }) {
  const [loading, setLoading] = useState(true);
  const [negotiations, setNegotiations] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [negModalOpen, setNegModalOpen] = useState(false);
  const [editingNegId, setEditingNegId] = useState(null);
  const [negForm, setNegForm] = useState({ entry_type_id: '', entry_date: '', amount: '', opening_demand: '', opening_offer: '', final_demand: '', final_offer: '', notes: '' });
  const [savingNeg, setSavingNeg] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    const { data: negData } = await supabase.from('settlement_negotiations').select('*, entry_types(label)').eq('matter_id', matterId).order('entry_date');
    setNegotiations(negData || []);
    const { data: entryTypesData } = await supabase.from('entry_types').select('*').order('label');
    setEntryTypes(entryTypesData || []);
    setLoading(false);
  }

  function formatCurrency(n) {
    if (n === null || n === undefined || n === '') return null;
    return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  function negTypeLabelFor(id) {
    return entryTypes.find((t) => t.id === id)?.label;
  }

  function openAddNeg() {
    setEditingNegId(null);
    setNegForm({ entry_type_id: '', entry_date: '', amount: '', opening_demand: '', opening_offer: '', final_demand: '', final_offer: '', notes: '' });
    setNegModalOpen(true);
  }

  function openEditNeg(n) {
    setEditingNegId(n.id);
    setNegForm({
      entry_type_id: n.entry_type_id || '',
      entry_date: n.entry_date || '',
      amount: n.amount ?? '',
      opening_demand: n.opening_demand ?? '',
      opening_offer: n.opening_offer ?? '',
      final_demand: n.final_demand ?? '',
      final_offer: n.final_offer ?? '',
      notes: n.notes || '',
    });
    setNegModalOpen(true);
  }

  async function saveNeg() {
    if (!negForm.entry_type_id) { alert('Pick an entry type.'); return; }
    if (!negForm.entry_date) { alert('Pick a date.'); return; }
    const label = negTypeLabelFor(negForm.entry_type_id);
    const isMediation = label === 'Mediation';
    setSavingNeg(true);
    const payload = {
      matter_id: matterId,
      entry_type_id: negForm.entry_type_id,
      entry_date: negForm.entry_date,
      amount: !isMediation && negForm.amount !== '' ? parseFloat(negForm.amount) : null,
      opening_demand: isMediation && negForm.opening_demand !== '' ? parseFloat(negForm.opening_demand) : null,
      opening_offer: isMediation && negForm.opening_offer !== '' ? parseFloat(negForm.opening_offer) : null,
      final_demand: isMediation && negForm.final_demand !== '' ? parseFloat(negForm.final_demand) : null,
      final_offer: isMediation && negForm.final_offer !== '' ? parseFloat(negForm.final_offer) : null,
      notes: negForm.notes?.trim() || null,
    };
    let error;
    if (editingNegId) {
      ({ error } = await supabase.from('settlement_negotiations').update(payload).eq('id', editingNegId));
    } else {
      ({ error } = await supabase.from('settlement_negotiations').insert(payload));
    }
    setSavingNeg(false);
    if (error) { alert(error.message); return; }
    setNegModalOpen(false);
    load();
  }

  async function removeNeg(id) {
    if (!confirm('Remove this entry?')) return;
    const { error } = await supabase.from('settlement_negotiations').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  function negBadgeClass(label) {
    if (label === 'Mediation') return 'badge-purple';
    if (label === 'Demand') return 'badge-red';
    if (label === 'Offer') return 'badge-green';
    return 'badge-gray';
  }

  function renderNegRow(n) {
    const label = n.entry_types?.label;
    const isMediation = label === 'Mediation';
    const mediationParts = [
      n.opening_demand != null ? `Opening Demand: ${formatCurrency(n.opening_demand)}` : null,
      n.opening_offer != null ? `Opening Offer: ${formatCurrency(n.opening_offer)}` : null,
      n.final_demand != null ? `Final Demand: ${formatCurrency(n.final_demand)}` : null,
      n.final_offer != null ? `Final Offer: ${formatCurrency(n.final_offer)}` : null,
    ].filter(Boolean);
    return (
      <div key={n.id} className="party-row" style={{ alignItems: 'flex-start' }}>
        <span className="muted" style={{ fontSize: '12px', minWidth: '100px', flexShrink: 0, paddingTop: '3px' }}>
          {n.entry_date ? formatDateSafe(n.entry_date) : '—'}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className={`badge ${negBadgeClass(label)}`} style={{ fontSize: '10px' }}>{label || '—'}</span>
            {isMediation
              ? mediationParts.length > 0 && <span style={{ fontWeight: 600, fontSize: '13px' }}>{mediationParts.join(' / ')}</span>
              : n.amount != null && <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatCurrency(n.amount)}</span>}
          </div>
          {n.notes && <span className="muted" style={{ fontSize: '12px' }}>{n.notes}</span>}
        </div>
        <div className="row-actions">
          <button className="btn-small" onClick={() => openEditNeg(n)}>Edit</button>
          <button className="btn-small btn-small-danger" onClick={() => removeNeg(n.id)}>Remove</button>
        </div>
      </div>
    );
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={openAddNeg}>+ Add Entry</button>
      </div>
      <div className="section-card">
        {negotiations.length === 0
          ? <p className="muted">No entries yet.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{negotiations.map((n) => renderNegRow(n))}</div>}
      </div>

      {negModalOpen && (
        <div className="modal-overlay" onClick={() => setNegModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNegId ? 'Edit Entry' : 'Add Entry'}</h2>
              <button className="modal-close" onClick={() => setNegModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Entry Type</label>
                  <select value={negForm.entry_type_id} onChange={(e) => setNegForm((f) => ({ ...f, entry_type_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {entryTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date</label>
                  <input type="date" value={negForm.entry_date} onChange={(e) => setNegForm((f) => ({ ...f, entry_date: e.target.value }))} />
                </div>
              </div>

              {negTypeLabelFor(negForm.entry_type_id) === 'Mediation' ? (
                <>
                  <div className="form-row">
                    <div className="form-field"><label>Opening Demand</label><input type="number" value={negForm.opening_demand} onChange={(e) => setNegForm((f) => ({ ...f, opening_demand: e.target.value }))} /></div>
                    <div className="form-field"><label>Opening Offer</label><input type="number" value={negForm.opening_offer} onChange={(e) => setNegForm((f) => ({ ...f, opening_offer: e.target.value }))} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-field"><label>Final Demand</label><input type="number" value={negForm.final_demand} onChange={(e) => setNegForm((f) => ({ ...f, final_demand: e.target.value }))} /></div>
                    <div className="form-field"><label>Final Offer</label><input type="number" value={negForm.final_offer} onChange={(e) => setNegForm((f) => ({ ...f, final_offer: e.target.value }))} /></div>
                  </div>
                </>
              ) : (
                <div className="form-field">
                  <label>Amount</label>
                  <input type="number" value={negForm.amount} onChange={(e) => setNegForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              )}

              <div className="form-field">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={negForm.notes}
                  onChange={(e) => setNegForm((f) => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveNeg} disabled={savingNeg}>{savingNeg ? 'Saving…' : editingNegId ? 'Save' : 'Add Entry'}</button>
                <button className="btn" onClick={() => setNegModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
