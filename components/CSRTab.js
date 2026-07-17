'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';
import SubmitCSRModal from './SubmitCSRModal';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

// CSR is now fully Supabase-native - no more SharePoint linking, no more
// /api/csr calls. csr_submissions holds full history (one row per actual
// submission); matters.csr_next_due is a cached copy of the latest
// submission's next_due, kept in sync here on every new submission. The
// Submit CSR modal itself lives in SubmitCSRModal.js, shared with the
// "All CSRs" list page so submission logic only ever lives in one place.
export default function CSRTab({ matter, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter.id]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('csr_submissions')
      .select('*')
      .eq('matter_id', matter.id)
      .order('date_submitted', { ascending: false });
    if (error) setError(error.message);
    else setSubmissions(data || []);
    setLoading(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (error) {
    return (
      <div className="section-card">
        <div className="section-card-header"><h3>Case Status Report</h3></div>
        <div className="error-box">{error}</div>
      </div>
    );
  }

  const daysOut = daysUntil(matter.csr_next_due);
  const overdue = daysOut !== null && daysOut < 0;
  const csrHeaderLabel =
    daysOut === null ? 'Case Status Report'
    : overdue ? `Case Status Report Overdue: ${Math.abs(daysOut)} days`
    : `Case Status Report Due: ${daysOut} days`;

  return (
    <>
      <div className="section-card">
        <div className="section-card-header">
          <h3>{csrHeaderLabel}</h3>
          <button className="btn btn-primary" onClick={() => setSubmitModalOpen(true)}>Submit CSR</button>
        </div>
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Initial CSR Due</span>
            <span className="detail-value">{matter.csr_initial_due ? formatDateSafe(matter.csr_initial_due) : '—'}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Next CSR Due</span>
            <span className="detail-value" style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 600 : undefined }}>
              {matter.csr_next_due ? formatDateSafe(matter.csr_next_due) : '—'}{overdue ? ' (Overdue)' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header"><h3>Submission History</h3></div>
        {submissions.length === 0 && <p className="muted">No submissions yet.</p>}
        {submissions.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Next Due (set at time of submission)</th>
                <th>Submitted By</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{formatDateSafe(s.date_submitted)}</td>
                  <td>{formatDateSafe(s.next_due)}</td>
                  <td>{s.submitted_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {submitModalOpen && (
        <SubmitCSRModal
          matter={matter}
          onClose={() => setSubmitModalOpen(false)}
          onSubmitted={() => { load(); onChanged?.(); }}
        />
      )}
    </>
  );
}

