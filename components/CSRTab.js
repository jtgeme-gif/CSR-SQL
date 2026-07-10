'use client';

import { useEffect, useState } from 'react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// CSRTab is the ONLY place in the UI that knows CSR exists. It never talks
// to SharePoint/Graph API directly — that would expose the Entra app's
// client secret to anyone opening browser dev tools. Instead it calls our
// own server-side route (/api/csr), which holds the credentials and does
// the actual Graph API work. Matching happens by Case Name — there is no
// shared ID between Supabase's matters table and the SharePoint list.
export default function CSRTab({ caseName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csr, setCsr] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [dateSubmitted, setDateSubmitted] = useState(todayStr());
  const [nextCsrDueDraft, setNextCsrDueDraft] = useState(addDays(todayStr(), 90));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseName]);

  async function load() {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    try {
      const res = await fetch(`/api/csr?caseName=${encodeURIComponent(caseName)}`);
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

  function openSubmitModal() {
    const today = todayStr();
    setDateSubmitted(today);
    setNextCsrDueDraft(addDays(today, 90));
    setConfirmed(false);
    setSubmitError(null);
    setSubmitModalOpen(true);
  }

  function updateDateSubmitted(value) {
    // Auto-recalculates Next CSR Due off the new submission date, same
    // pattern as OMT — still freely editable afterward if it needs to differ.
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
          itemId: csr.id,
          priorCsrDate: dateSubmitted,
          nextCsrDue: nextCsrDueDraft,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
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
        <p className="muted" style={{ marginTop: '8px' }}>
          This matter's Case Status Report is tracked in the firm-wide CSR Tracker, not here.
          If this matter hasn't been added to the CSR Tracker yet, add it there first.
        </p>
      </div>
    );
  }

  if (!csr) {
    return (
      <div className="section-card">
        <div className="section-card-header"><h3>CSR</h3></div>
        <p className="muted">No matching CSR Tracker entry found for this case name.</p>
        {diagnostics && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <div><strong>Searched for:</strong> "{diagnostics.searchedFor}" ({diagnostics.searchedForLength} characters)</div>
            <div style={{ marginTop: '8px' }}><strong>Values actually in the CSR Tracker's Matter column:</strong></div>
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

  const overdue = csr.nextDue && new Date(csr.nextDue) < new Date();

  return (
    <>
      <div className="section-card">
        <div className="section-card-header">
          <h3>CSR</h3>
          <button className="btn btn-primary" onClick={openSubmitModal}>Submit CSR</button>
        </div>
        <div className="detail-grid">
          <div className="detail-card"><span className="detail-label">Initial CSR Date</span><span className="detail-value">{csr.initialDate || '—'}</span></div>
          <div className="detail-card"><span className="detail-label">Prior CSR Date</span><span className="detail-value">{csr.mostRecent || '—'}</span></div>
          <div className="detail-card">
            <span className="detail-label">Next CSR Due</span>
            <span className="detail-value" style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 600 : undefined }}>
              {csr.nextDue || '—'}{overdue ? ' (Overdue)' : ''}
            </span>
          </div>
        </div>
      </div>

      {submitModalOpen && (
        <div className="modal-overlay" onClick={() => setSubmitModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit CSR — {caseName}</h2>
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

