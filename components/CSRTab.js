'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatCsrDate(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// CSRTab is the ONLY place in the UI that knows CSR/SharePoint exists,
// including owning the write-back of matters.csr_item_id once a matter is
// linked - a couple of other spots (Case Identification's save, Assigned
// Staff) also call this same /api/csr route for their own specific actions,
// but none of them touch raw SharePoint field names, only plain-language
// actions this route understands.
export default function CSRTab({ matter, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csr, setCsr] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const [creating, setCreating] = useState(false);
  const [linkIdDraft, setLinkIdDraft] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [dateSubmitted, setDateSubmitted] = useState(todayStr());
  const [nextCsrDueDraft, setNextCsrDueDraft] = useState(addDays(todayStr(), 90));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter.csr_item_id, matter.case_name]);

  async function load() {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    try {
      const url = matter.csr_item_id
        ? `/api/csr?itemId=${encodeURIComponent(matter.csr_item_id)}`
        : `/api/csr?caseName=${encodeURIComponent(matter.case_name)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data?.noMatch) {
        setCsr(null);
        setDiagnostics(data);
      } else {
        setCsr(data);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function saveLinkToMatter(itemId) {
    const { error } = await supabase.from('matters').update({ csr_item_id: itemId }).eq('id', matter.id);
    if (error) { alert('Linked in SharePoint, but saving the link on this matter failed: ' + error.message); return; }
    onLinked?.();
  }

  async function createInSharePoint() {
    setCreating(true);
    try {
      const res = await fetch('/api/csr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseName: matter.case_name,
          practiceGroup: matter.practice_group,
          fileNumber: matter.file_number,
          dateOpened: matter.date_opened,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      await saveLinkToMatter(body.id);
    } catch (err) {
      alert('Could not create the CSR Tracker record: ' + err.message);
    }
    setCreating(false);
  }

  async function linkByItemId() {
    if (!linkIdDraft.trim()) { setLinkError('Enter an item ID.'); return; }
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/csr?itemId=${encodeURIComponent(linkIdDraft.trim())}`);
      const body = await res.json();
      if (!res.ok || body?.error) throw new Error(body.error || 'That item ID could not be found.');
      await saveLinkToMatter(linkIdDraft.trim());
    } catch (err) {
      setLinkError(err.message);
    }
    setLinking(false);
  }

  function openSubmitModal() {
    const today = todayStr();
    setDateSubmitted(today);
    setNextCsrDueDraft(addDays(today, 90));
    setConfirmed(false);
    setSubmitError(null);
    setSubmitModalOpen(true);
  }

  function updateDateSubmitted(value) {
    setDateSubmitted(value);
    setNextCsrDueDraft(value ? addDays(value, 90) : nextCsrDueDraft);
  }

  async function submitCsr() {
    if (!confirmed) { setSubmitError('Please confirm the CSR has been submitted.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/csr', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: matter.csr_item_id,
          action: 'submitCsr',
          payload: { priorCsrDate: dateSubmitted, nextCsrDue: nextCsrDueDraft },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setSubmitModalOpen(false);
      load();
    } catch (err) {
      setSubmitError(err.message);
    }
    setSubmitting(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (error) {
    return (
      <div className="section-card">
        <div className="section-card-header"><h3>CSR</h3></div>
        <div className="error-box">{error}</div>
      </div>
    );
  }

  // Not linked yet - show the two temporary linking paths.
  if (!matter.csr_item_id) {
    return (
      <div className="section-card">
        <div className="section-card-header"><h3>CSR</h3></div>
        <p className="muted" style={{ marginTop: 0 }}>
          This matter isn't linked to a CSR Tracker record yet. Create a new one, or link to an existing record if it's already in the CSR Tracker.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
          <div>
            <button className="btn btn-primary" onClick={createInSharePoint} disabled={creating}>
              {creating ? 'Creating…' : 'Create in SharePoint'}
            </button>
            <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>Use this if this matter does not already exist in the CSR Tracker.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Link by SharePoint Item ID
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={linkIdDraft}
                onChange={(e) => setLinkIdDraft(e.target.value)}
                placeholder="e.g. 42"
                style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
              />
              <button className="btn" onClick={linkByItemId} disabled={linking}>{linking ? 'Linking…' : 'Link'}</button>
            </div>
            {linkError && <div className="error-box" style={{ marginTop: '6px' }}>{linkError}</div>}
            <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>Use this if this matter already exists in the CSR Tracker.</p>
          </div>
        </div>

        {diagnostics && (
          <div style={{ marginTop: '16px', fontSize: '12px' }}>
            <div><strong>Searched for:</strong> "{diagnostics.searchedFor}" ({diagnostics.searchedForLength} characters)</div>
            <div style={{ marginTop: '8px' }}><strong>Values found in the CSR Tracker's Title column:</strong></div>
            <ul>
              {(diagnostics.existingValues || []).map((v, i) => (
                <li key={i}>"{v}" ({v.length} characters)</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (!csr) {
    return (
      <div className="section-card">
        <div className="section-card-header"><h3>CSR</h3></div>
        <p className="muted">Linked, but this item could not be loaded from the CSR Tracker. It may have been deleted there.</p>
      </div>
    );
  }

  const overdue = csr.nextDue && new Date(csr.nextDue) < new Date();

  return (
    <>
      <div className="section-card">
        <div className="section-card-header">
          <h3>CSR</h3>
          <button className="btn btn-primary" onClick={openSubmitModal}>Submit CSR</button>
        </div>
        <div className="detail-grid">
          <div className="detail-card"><span className="detail-label">Initial CSR Date</span><span className="detail-value">{formatCsrDate(csr.initialDate) || '—'}</span></div>
          <div className="detail-card"><span className="detail-label">Prior CSR Date</span><span className="detail-value">{formatCsrDate(csr.mostRecent) || '—'}</span></div>
          <div className="detail-card">
            <span className="detail-label">Next CSR Due</span>
            <span className="detail-value" style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 600 : undefined }}>
              {formatCsrDate(csr.nextDue) || '—'}{overdue ? ' (Overdue)' : ''}
            </span>
          </div>
          <div className="detail-card"><span className="detail-label">Closed in CSR Tracker</span><span className="detail-value">{csr.closed ? 'Yes' : 'No'}</span></div>
        </div>
      </div>

      {submitModalOpen && (
        <div className="modal-overlay" onClick={() => setSubmitModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit CSR — {matter.case_name}</h2>
              <button className="modal-close" onClick={() => setSubmitModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>
                Submitting will set <strong>Prior CSR Date</strong> to the date below and push <strong>Next CSR Due</strong> out by 90 days.
              </p>
              <div className="form-row">
                <div className="form-field">
                  <label>Date Submitted</label>
                  <input type="date" value={dateSubmitted} onChange={(e) => updateDateSubmitted(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Next CSR Due (auto: +90 days)</label>
                  <input type="date" value={nextCsrDueDraft} onChange={(e) => setNextCsrDueDraft(e.target.value)} />
                </div>
              </div>
              <div className="form-checkbox">
                <input type="checkbox" id="confirm-csr" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <label htmlFor="confirm-csr">Confirm CSR has been submitted</label>
              </div>

              {submitError && <div className="error-box">{submitError}</div>}

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={submitCsr} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit CSR'}</button>
                <button className="btn" onClick={() => setSubmitModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
