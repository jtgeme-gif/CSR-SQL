'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];

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
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadMatters();
  }, []);

  async function loadMatters() {
    setLoading(true);
    setError(null);

    const { data: mattersData, error: mattersError } = await supabase
      .from('matters')
      .select('*')
      .order('created_at', { ascending: false });

    if (mattersError) {
      setError(mattersError.message);
      setLoading(false);
      return;
    }

    const matterIds = (mattersData || []).map((m) => m.id);

    // Client insurer names, keyed by matter
    const insurerIds = (mattersData || [])
      .map((m) => m.client_insurer_entity_id)
      .filter(Boolean);
    let entitiesById = {};
    if (insurerIds.length > 0) {
      const { data: entities } = await supabase
        .from('entities')
        .select('id, name')
        .in('id', insurerIds);
      entitiesById = Object.fromEntries((entities || []).map((e) => [e.id, e.name]));
    }

    // Assigned staff (internal "Attorney" column), keyed by matter
    let staffByMatter = {};
    if (matterIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('matter_staff')
        .select('matter_id, staff_name, staff(first_name, last_name)')
        .in('matter_id', matterIds);
      (staffRows || []).forEach((s) => {
        const name = s.staff ? `${s.staff.first_name || ''} ${s.staff.last_name || ''}`.trim() : s.staff_name;
        staffByMatter[s.matter_id] = staffByMatter[s.matter_id]
          ? `${staffByMatter[s.matter_id]}, ${name}`
          : name;
      });
    }

    const enriched = (mattersData || []).map((m) => ({
      ...m,
      clientName: m.client_insurer_entity_id ? entitiesById[m.client_insurer_entity_id] : null,
      staffNames: staffByMatter[m.id] || null,
    }));

    setMatters(enriched);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return matters.filter((m) => {
      if (groupFilter !== 'all' && m.practice_group !== groupFilter) return false;
      if (statusFilter !== 'all' && m.case_status !== statusFilter) return false;
      return true;
    });
  }, [matters, groupFilter, statusFilter]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>All Matters</h1>
        <div className="filter-bar">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">All groups</option>
            {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All matters</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Link href="/matters/new" className="btn btn-primary">+ New Matter</Link>
        </div>
      </div>

      {loading && <p className="muted">Loading matters…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{matters.length === 0 ? 'No matters yet.' : 'No matters match these filters.'}</p>
          {matters.length === 0 && (
            <Link href="/matters/new" className="btn btn-primary">Create your first matter</Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Case Name</th>
              <th>Client</th>
              <th>Practice Group</th>
              <th>Status</th>
              <th>Attorney</th>
              <th>Opened</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/matters/${m.id}`}>{m.case_name}</Link></td>
                <td>{m.clientName ? <span className="chip">{m.clientName}</span> : '—'}</td>
                <td>{m.practice_group || '—'}</td>
                <td>
                  <span className={`badge badge-${statusColor(m.case_status)}`}>
                    {m.case_status || '—'}
                  </span>
                </td>
                <td>{m.staffNames || '—'}</td>
                <td>{m.date_opened ? new Date(m.date_opened).toLocaleDateString() : '—'}</td>
                <td>
                  <span className={`pill ${m.case_status === 'Closed' ? 'pill-closed' : 'pill-active'}`}>
                    {m.case_status === 'Closed' ? 'Closed' : 'Active'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
