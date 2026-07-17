'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Shared Submit CSR modal - used by both CSRTab.js (matter detail page) and
// the "All CSRs" list page, so the actual submission logic only ever lives
// in one place. Props: matter (needs id, case_name), onClose, onSubmitted
// (called after a successful submit, so the caller can refresh whatever
// it's displaying - the matter detail page's own data, or the list).
export default function SubmitCSRModal({ matter, onClose, onSubmitted }) {
  const [dateSubmitted, setDateSubmitted] = useState(todayStr());
  const [nextCsrDueDraft, setNextCsrDueDraft] = useState(addDays(todayStr(), 90));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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

    setSubmitting(false);
    onSubmitted?.();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit CSR — {matter.case_name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
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
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
