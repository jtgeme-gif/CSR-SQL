'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';
import SubmitCSRModal from '../components/SubmitCSRModal';
import MatterEditModal from '../components/MatterEditModal';

// Only these two see every matter regardless of assignment (management/IT
// oversight, per your call). Everyone else sees only matters they're
// assigned to via matter_staff, same scoping pattern the Dashboard already
// uses in NMT. TOM_EMAIL is a placeholder - confirm his real address.
const ADMIN_EMAILS = ['jgemellaro@mcgrawmorris.com', 'tmcgraw@mcgrawmorris.com'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(todayStr() + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

// Four statuses, all derived purely from csr_next_due/case_status - no
// separate "muted" concept, per your call: this reflects only "when's the
// next CSR due," nothing broader about case management.
function csrStatus(matter) {
  if (matter.case_status === 'Closed') return { label: 'Closed', color: 'gray' };
  const days = daysUntil(matter.csr_next_due);
  if (days === null) return { label: 'On track', color: 'green' };
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, color: 'red' };
  if (days <= 14) return { label: `Due ${days}d`, color: 'orange' };
  return { label: 'On track', color: 'green' };
}

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];

export default function AllCSRsPage() {
  const [matters, setMatters] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitMatter, setSubmitMatter] = useState(null);
  const [editMatterId, setEditMatterId] = useState(null);

  useEffect(() => {
    document.title = 'CSR Tracker';
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    const admin = !!email && ADMIN_EMAILS.includes(email.toLowerCase());

    const { data: staffData } = await supabase.from('staff').select('id, first_name, last_name').eq('active', true).eq('is_attorney', true).order('last_name');
    setStaffList(staffData || []);

    let matterIds = null;
    if (!admin) {
      const { data: staffRow } = await supabase.from('staff').select('id').eq('email', email).maybeSingle();
      if (staffRow) {
        const { data: assignments } = await supabase.from('matter_staff').select('matter_id').eq('staff_id', staffRow.id);
        matterIds = [...new Set((assignments || []).map((a) => a.matter_id))];
      } else {
        matterIds = [];
      }
    }

    let query = supabase
      .from('matters')
      .select(`
        id, case_name, file_number, practice_group, case_status, date_opened, csr_initial_due, csr_next_due,
        matter_staff(staff_id, staff(first_name, last_name)),
        matter_claim_reps(claim_number, people(first_name, last_name))
      `)
      .order('csr_next_due', { ascending: true });

    if (matterIds !== null) {
      if (matterIds.length === 0) {
        setMatters([]);
        setLoading(false);
        return;
      }
      query = query.in('id', matterIds);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setMatters(data || []);
    setLoading(false);
  }

  const filtered = matters.filter((m) => {
    if (groupFilter !== 'all' && m.practice_group !== groupFilter) return false;
    if (staffFilter !== 'all' && !m.matter_staff.some((s) => s.staff_id === staffFilter)) return false;
    if (statusFilter !== 'all') {
      const status = csrStatus(m);
      if (statusFilter === 'overdue' && !status.label.startsWith('Overdue')) return false;
      if (statusFilter === 'due-soon' && !status.label.startsWith('Due')) return false;
      if (statusFilter === 'on-track' && status.label !== 'On track') return false;
      if (statusFilter === 'closed' && status.label !== 'Closed') return false;
    }
    if (search && !m.case_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Summary boxes reflect everything you have access to see (before search/
  // dropdown filtering), not just the currently-filtered rows - same as
  // NMT's own Dashboard alert boxes, which aren't affected by any list
  // filter either. Closed matters count toward Total but aren't broken
  // out into their own box, same as the reference design.
  const totalCount = matters.length;
  const overdueCount = matters.filter((m) => csrStatus(m).label.startsWith('Overdue')).length;
  const dueSoonCount = matters.filter((m) => csrStatus(m).label.startsWith('Due')).length;
  const onTrackCount = matters.filter((m) => csrStatus(m).label === 'On track').length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>All CSRs</h1>
        <div className="filter-bar">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">All groups</option>
            {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="all">All staff</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="overdue">Overdue</option>
            <option value="due-soon">Due ≤ 14 days</option>
            <option value="on-track">On track</option>
            <option value="closed">Closed</option>
          </select>
          <input
            type="text"
            placeholder="Search case name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <button className="btn btn-primary" onClick={load}>↻ Refresh</button>
          <Link href="/matters/new" className="btn btn-primary">+ New CSR</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div className="section-card" style={{ flex: 1 }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--navy)' }}>{totalCount}</div>
          <div className="muted" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>TOTAL CSRs</div>
        </div>
        <div className="section-card" style={{ flex: 1, borderLeft: '4px solid var(--red)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--red)' }}>{overdueCount}</div>
          <div className="muted" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>OVERDUE</div>
        </div>
        <div className="section-card" style={{ flex: 1, borderLeft: '4px solid var(--orange)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--orange)' }}>{dueSoonCount}</div>
          <div className="muted" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>DUE ≤ 14 DAYS</div>
        </div>
        <div className="section-card" style={{ flex: 1, borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--green)' }}>{onTrackCount}</div>
          <div className="muted" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>ON TRACK</div>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '8px' }}>{filtered.length} of {matters.length}</p>

          {filtered.length === 0 ? (
            <div className="empty-state"><p>No matters match.</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Case Name</th>
                  <th>Group</th>
                  <th>Assigned</th>
                  <th>Claims Rep</th>
                  <th>Opened</th>
                  <th>Initial CSR</th>
                  <th>Next Due</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const status = csrStatus(m);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div>{m.case_name}</div>
                        {m.file_number && <div className="muted" style={{ fontSize: '11px' }}>{m.file_number}</div>}
                        <a
                          onClick={() => setEditMatterId(m.id)}
                          className="muted"
                          style={{ fontSize: '11px', display: 'inline-block', marginTop: '2px', cursor: 'pointer' }}
                        >
                          Edit
                        </a>
                      </td>
                      <td>{m.practice_group || '—'}</td>
                      <td>
                        {m.matter_staff.length === 0
                          ? '—'
                          : m.matter_staff.map((s) => `${s.staff?.first_name || ''} ${s.staff?.last_name || ''}`.trim()).join(', ')}
                      </td>
                      <td>
                        {m.matter_claim_reps.length === 0
                          ? '—'
                          : m.matter_claim_reps.map((cr, i) => (
                              <div key={i}>
                                {cr.people?.first_name} {cr.people?.last_name}
                                {cr.claim_number ? ` — ${cr.claim_number}` : ''}
                              </div>
                            ))}
                      </td>
                      <td>{m.date_opened ? formatDateSafe(m.date_opened) : '—'}</td>
                      <td>{m.csr_initial_due ? formatDateSafe(m.csr_initial_due) : '—'}</td>
                      <td>{m.csr_next_due ? formatDateSafe(m.csr_next_due) : '—'}</td>
                      <td><span className={`badge badge-${status.color}`}>{status.label}</span></td>
                      <td>
                        <button className="btn btn-primary btn-small" onClick={() => setSubmitMatter(m)}>Submit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {submitMatter && (
        <SubmitCSRModal
          matter={submitMatter}
          onClose={() => setSubmitMatter(null)}
          onSubmitted={load}
        />
      )}

      {editMatterId && (
        <MatterEditModal
          matterId={editMatterId}
          onClose={() => setEditMatterId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
