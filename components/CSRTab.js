'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseName]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/csr?caseName=${encodeURIComponent(caseName)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setCsr(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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
      </div>
    );
  }

  const overdue = csr.nextDue && new Date(csr.nextDue) < new Date();

  return (
    <div className="section-card">
      <div className="section-card-header"><h3>CSR</h3></div>
      <p className="muted" style={{ marginTop: 0 }}>
        Read-only — CSR is tracked and edited in the standalone CSR Tracker app, not here.
      </p>
      <div className="detail-grid">
        <div className="detail-card"><span className="detail-label">Initial CSR Date</span><span className="detail-value">{csr.initialDate || '—'}</span></div>
        <div className="detail-card"><span className="detail-label">Most Recent CSR</span><span className="detail-value">{csr.mostRecent || '—'}</span></div>
        <div className="detail-card">
          <span className="detail-label">Next CSR Due</span>
          <span className="detail-value" style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 600 : undefined }}>
            {csr.nextDue || '—'}{overdue ? ' (Overdue)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
