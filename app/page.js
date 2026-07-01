'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

function statusColor(status) {
  switch (status) {
    case 'Active Litigation': return 'blue';
    case 'Pre-litigation Monitoring': return 'yellow';
    case 'Stayed': return 'orange';
    case 'Appeal': return 'purple';
    case 'Closed': return 'gray';
    default: return 'gray';
  }
}

export default function MattersPage() {
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMatters();
  }, []);

  async function loadMatters() {
    setLoading(true);
    const { data, error } = await supabase
      .from('matters')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setMatters(data);
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>All Matters</h1>
        <Link href="/matters/new" className="btn btn-primary">+ Add Matter</Link>
      </div>

      {loading && <p className="muted">Loading matters…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && matters.length === 0 && (
        <div className="empty-state">
          <p>No matters yet.</p>
          <Link href="/matters/new" className="btn btn-primary">Create your first matter</Link>
        </div>
      )}

      {!loading && matters.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Case Name</th>
              <th>Practice Group</th>
              <th>Status</th>
              <th>Date Opened</th>
            </tr>
          </thead>
          <tbody>
            {matters.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/matters/${m.id}`}>{m.case_name}</Link></td>
                <td>{m.practice_group || '—'}</td>
                <td>
                  <span className={`badge badge-${statusColor(m.case_status)}`}>
                    {m.case_status || '—'}
                  </span>
                </td>
                <td>{m.date_opened ? new Date(m.date_opened).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
