'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import CSRTab from '../../../components/CSRTab';

// CSR-SQL's matter detail page is deliberately narrow: no tab bar, no
// Parties/Court & Jurisdiction/Staff sections, no Scheduling/Witnesses/
// Case/Mediation/Notes/Subpoenas - this app only ever shows CSR tracking
// for a matter. Everything else about a case is managed in NMT itself.
export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id;

  const [matter, setMatter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  useEffect(() => {
    document.title = matter?.short_name || matter?.case_name || 'CSR Tracker';
  }, [matter]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('matters').select('*').eq('id', matterId).single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setMatter(data);
    setLoading(false);
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!matter) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{matter.case_name}</h1>
        {matter.file_number && <span className="muted" style={{ fontSize: '13px' }}>{matter.file_number}</span>}
      </div>

      <CSRTab matter={matter} onChanged={load} />
    </div>
  );
}
