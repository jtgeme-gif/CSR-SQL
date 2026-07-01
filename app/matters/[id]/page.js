'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

export default function MatterDetailPage() {
  const params = useParams();
  const [matter, setMatter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('matters').select('*').eq('id', params.id).single();
    if (error) setError(error.message);
    else setMatter(data);
    setLoading(false);
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!matter) return null;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'block' }}>
        <Link href="/" className="back-link">← All Matters</Link>
        <h1>{matter.case_name}</h1>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <span className="detail-label">Practice Group</span>
          <span className="detail-value">{matter.practice_group || '—'}</span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Case Status</span>
          <span className="detail-value">{matter.case_status || '—'}</span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Date Opened</span>
          <span className="detail-value">
            {matter.date_opened ? new Date(matter.date_opened).toLocaleDateString() : '—'}
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Incident Date</span>
          <span className="detail-value">
            {matter.incident_date ? new Date(matter.incident_date).toLocaleDateString() : '—'}
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Court Case Number</span>
          <span className="detail-value">{matter.court_case_number || '—'}</span>
        </div>
      </div>

      <p className="muted" style={{ marginTop: '32px' }}>
        This is a bare-bones view for now — Case, Discovery, Witnesses, and the other tabs come next.
      </p>
    </div>
  );
}
