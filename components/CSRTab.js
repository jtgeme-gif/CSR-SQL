'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(todayStr() + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

// CSR is now fully Supabase-native - no more SharePoint linking, no more
// /api/csr calls. csr_submissions holds full history (one row per actual
// submission); matters.csr_next_due is a cached copy of the latest
// submission's next_due, kept in sync here on every new submission.
export default function CSRTab({ matter, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [dateSubmitted, setDateSubmitted] = useState(todayStr());
  const [nextCsrDueDraft, setNextCsrDueDraft] = useState(addDays(todayStr(), 90));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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

    const { data: userData } = await supabase.auth.getUser();
    const submittedBy = userData?.user?.email || null;

    const { error: insertError } = await supabase.from('csr_submissions').insert({
      matter_id: matter.id,
      date_submitted: dateSubmitted,
      next_due: nextCsrDueDraft,
      submitted_by: submittedBy,
    });
    if (insertError) {
      setSubmitError(insertError.message);
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('matters')
      .update({ csr_next_due: nextCsrDueDraft })
      .eq('id', matter.id);
    if (updateError) {
      setSubmitError('Submission saved, but updating the matter\'s next-due date failed: ' + updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitModalOpen(false);
    setSubmitting(false);
    load();
    onChanged?.();
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
          <button className="btn btn-primary" onClick={openSubmitModal}>Submit CSR</button>
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
        <div className="modal-overlay" onClick={() => setSubmitModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit CSR — {matter.case_name}</h2>
              <button className="modal-close" onClick={() => setSubmitModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>
                Submitting will record this in the CSR history and push <strong>Next CSR Due</strong> out by 90 days.
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
