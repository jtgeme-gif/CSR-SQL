'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { formatDateSafe } from '../../lib/formatDate';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// SharePoint date fields (like CSR's Next CSR Due) come back as full ISO
// timestamps (e.g. "2026-08-15T00:00:00Z"), not plain "YYYY-MM-DD" like
// Postgres date columns. Slicing to the first 10 characters normalizes
// either format to plain YYYY-MM-DD before it touches daysBetween/addDays.
function toDateOnly(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 10);
}

// Rare multi-file-number matters are stored as "1979.1807 (Hancock) /
// 1979.1810 (Houghton)" - split on "/" so each number stacks on its own
// line instead of running together. Single-number matters render unchanged.
function renderFileNumber(fileNumber) {
  if (!fileNumber) return '—';
  const parts = fileNumber.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return fileNumber;
  return (
    <>
      {parts.map((p, i) => (
        <div key={i}>{p}</div>
      ))}
    </>
  );
}

// 1-10 days = urgent (orange), 11-20 = moderate (yellow), 21+ = calm (green).
// The color follows whatever number is actually chosen, not the box's position.
function colorForWindow(days) {
  if (days <= 10) return 'orange';
  if (days <= 20) return 'yellow';
  return 'green';
}

// Days-out badge for the deadline/CSR tables: overdue and "due today" both
// read as urgent (red), same visual language as the OMT reference screenshot.
function daysOutBadge(days) {
  if (days < 0) return { colorClass: 'red', label: `Overdue ${Math.abs(days)}d` };
  if (days === 0) return { colorClass: 'red', label: '0d' };
  return { colorClass: colorForWindow(days), label: `${days}d` };
}

const OVERDUE_CAP_DAYS = 45;
const CASE_STATUS_ORDER = ['Active Litigation', 'Stayed', 'Appeal', 'Pre-litigation Monitoring'];
const STATUS_BADGE_COLOR = {
  'Active Litigation': 'blue',
  'Pre-litigation Monitoring': 'yellow',
  'Stayed': 'orange',
  'Appeal': 'purple',
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [matters, setMatters] = useState([]); // assigned matters: id, case_name, file_number, case_status, csr_item_id
  const [csrRows, setCsrRows] = useState([]); // next 5 upcoming CSR dues
  const [csrLoading, setCsrLoading] = useState(true);
  const [daysWindow1, setDaysWindow1] = useState('5');
  const [daysWindow2, setDaysWindow2] = useState('14');
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) throw new Error('Could not determine your logged-in email.');

      const { data: staffRow } = await supabase.from('staff').select('id').eq('email', email).maybeSingle();
      if (!staffRow) {
        setEvents([]);
        setMatters([]);
        setCsrRows([]);
        setCsrLoading(false);
        setLoading(false);
        return;
      }

      const { data: assignments } = await supabase.from('matter_staff').select('matter_id').eq('staff_id', staffRow.id);
      const matterIds = [...new Set((assignments || []).map((a) => a.matter_id))];

      if (matterIds.length > 0) {
        const { data: mattersData } = await supabase
          .from('matters')
          .select('id, case_name, file_number, case_status, csr_item_id')
          .in('id', matterIds);
        setMatters(mattersData || []);

        const { data: eventsData } = await supabase
          .from('events')
          .select('*, event_types(label), matters(case_name)')
          .in('matter_id', matterIds)
          .eq('completed', false)
          .order('event_date');
        setEvents(eventsData || []);

        loadCsrDues(mattersData || []);
      } else {
        setMatters([]);
        setEvents([]);
        setCsrRows([]);
        setCsrLoading(false);
      }

      // Load or create this user's saved day-count preferences.
      const { data: prefs } = await supabase.from('dashboard_preferences').select('*').eq('user_email', email).maybeSingle();
      if (prefs) {
        setDaysWindow1(String(prefs.due_soon_days_1));
        setDaysWindow2(String(prefs.due_soon_days_2));
      } else {
        await supabase.from('dashboard_preferences').insert({ user_email: email, due_soon_days_1: 5, due_soon_days_2: 14 });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  // CSR dates live only in SharePoint, not in `events` - pulled per-matter via
  // the existing /api/csr route (same one CSRTab uses), then merged client-side
  // to find the 5 soonest upcoming due dates across assigned matters.
  async function loadCsrDues(matterList) {
    setCsrLoading(true);
    const linked = matterList.filter((m) => m.csr_item_id);
    if (linked.length === 0) {
      setCsrRows([]);
      setCsrLoading(false);
      return;
    }

    const results = await Promise.all(
      linked.map(async (m) => {
        try {
          const res = await fetch(`/api/csr?itemId=${encodeURIComponent(m.csr_item_id)}`);
          if (!res.ok) return null;
          const data = await res.json();
          if (data?.error || data?.noMatch || !data?.nextDue || data?.closed) return null;
          return { matterId: m.id, caseName: m.case_name, nextDue: toDateOnly(data.nextDue) };
        } catch {
          return null;
        }
      })
    );

    const today = todayStr();
    const upcoming = results
      .filter(Boolean)
      .filter((r) => r.nextDue >= today)
      .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))
      .slice(0, 5);

    setCsrRows(upcoming);
    setCsrLoading(false);
  }

  async function savePref(field, value) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return;
    setSavingPrefs(true);
    await supabase.from('dashboard_preferences').upsert({ user_email: email, [field]: value }, { onConflict: 'user_email' });
    setSavingPrefs(false);
  }

  function handleWindowChange(setter, field, rawValue) {
    setter(rawValue);
    const n = parseInt(rawValue, 10);
    if (!isNaN(n) && n >= 1 && n <= 90) {
      savePref(field, n);
    }
  }

  const today = todayStr();
  const overdueFloor = addDays(today, -OVERDUE_CAP_DAYS);

  const overdue = events.filter((e) => e.event_date < today && e.event_date >= overdueFloor);

  const window1 = parseInt(daysWindow1, 10);
  const window2 = parseInt(daysWindow2, 10);
  const dueWithin1 = !isNaN(window1) && window1 >= 1 && window1 <= 90
    ? events.filter((e) => e.event_date >= today && e.event_date <= addDays(today, window1))
    : [];
  const dueWithin2 = !isNaN(window2) && window2 >= 1 && window2 <= 90
    ? events.filter((e) => e.event_date >= today && e.event_date <= addDays(today, window2))
    : [];

  // Open Matters breakdown - counts by case_status, Closed excluded entirely.
  const openMatters = matters.filter((m) => m.case_status !== 'Closed');
  const statusCounts = CASE_STATUS_ORDER.map((status) => ({
    status,
    count: openMatters.filter((m) => m.case_status === status).length,
  }));

  // Soonest incomplete event per matter (events already ordered ascending by
  // event_date, so the first row seen for a given matter_id is its next
  // deadline). CSR dates never appear here - CSR lives only in its own panel.
  const nextDeadlineByMatter = {};
  events.forEach((e) => {
    if (!nextDeadlineByMatter[e.matter_id]) {
      nextDeadlineByMatter[e.matter_id] = e;
    }
  });

  const tableRows = openMatters
    .map((m) => {
      const next = nextDeadlineByMatter[m.id];
      return {
        ...m,
        nextDeadlineLabel: next ? (next.description || next.event_types?.label || '—') : null,
        nextDeadlineDate: next ? next.event_date : null,
        daysOut: next ? daysBetween(today, next.event_date) : null,
      };
    })
    .sort((a, b) => {
      if (a.daysOut === null && b.daysOut === null) return 0;
      if (a.daysOut === null) return 1;
      if (b.daysOut === null) return -1;
      return a.daysOut - b.daysOut;
    });

  function renderAlertBox({ title, count, colorClass, list, extra }) {
    return (
      <div className={`section-card`} style={{ flex: 1, borderLeft: `4px solid var(--${colorClass})`, background: `var(--${colorClass}-bg)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: `var(--${colorClass})` }}>{count}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span className={`badge badge-${colorClass}`}>{title}</span>
          {extra}
        </div>
        {list.length === 0 && <p className="muted" style={{ fontSize: '13px' }}>Nothing here.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {list.map((e) => (
            <div key={e.id} style={{ fontSize: '13px' }}>
              <Link href={`/matters/${e.matter_id}`} style={{ fontWeight: 600 }}>{e.matters?.case_name}</Link>
              {' — '}{e.description || e.event_types?.label} <span className="muted">({formatDateSafe(e.event_date)})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link href="/matters/new" className="btn btn-primary">+ New Matter</Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', marginBottom: '16px' }}>
        {renderAlertBox({
          title: 'Overdue',
          count: overdue.length,
          colorClass: 'red',
          list: overdue,
          extra: <span className="muted" style={{ fontSize: '12px' }}>(within last {OVERDUE_CAP_DAYS} days)</span>,
        })}

        {renderAlertBox({
          title: `Due within ${daysWindow1 || '—'} days`,
          count: dueWithin1.length,
          colorClass: colorForWindow(window1 || 999),
          list: dueWithin1,
          extra: (
            <input
              type="text"
              value={daysWindow1}
              onChange={(e) => handleWindowChange(setDaysWindow1, 'due_soon_days_1', e.target.value)}
              style={{ width: '48px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }}
            />
          ),
        })}

        {renderAlertBox({
          title: `Due within ${daysWindow2 || '—'} days`,
          count: dueWithin2.length,
          colorClass: colorForWindow(window2 || 999),
          list: dueWithin2,
          extra: (
            <input
              type="text"
              value={daysWindow2}
              onChange={(e) => handleWindowChange(setDaysWindow2, 'due_soon_days_2', e.target.value)}
              style={{ width: '48px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }}
            />
          ),
        })}
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', marginBottom: '16px' }}>
        {/* CSR Status - next 5 soonest upcoming CSR due dates, own data source */}
        <div className="section-card" style={{ flex: 1 }}>
          <div className="section-card-header">
            <h3>CSR Status</h3>
          </div>
          {csrLoading && <p className="muted" style={{ fontSize: '13px' }}>Loading…</p>}
          {!csrLoading && csrRows.length === 0 && <p className="muted" style={{ fontSize: '13px' }}>Nothing upcoming.</p>}
          {!csrLoading && csrRows.map((r) => {
            const days = daysBetween(today, r.nextDue);
            const badge = daysOutBadge(days);
            return (
              <div key={r.matterId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <Link href={`/matters/${r.matterId}`} style={{ fontWeight: 600, fontSize: '13px' }}>{r.caseName}</Link>
                <span className={`badge badge-${badge.colorClass}`}>{badge.label}</span>
              </div>
            );
          })}
        </div>

        {/* Open Matters breakdown by case_status */}
        <div className="section-card" style={{ flex: 1 }}>
          <div className="section-card-header">
            <h3>Open Matters — {openMatters.length}</h3>
          </div>
          {statusCounts.map(({ status, count }) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px' }}>{status}</span>
              <span className={`badge badge-${STATUS_BADGE_COLOR[status]}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Open Matters table, sorted by soonest next deadline. CSR dates never
          appear here - CSR lives only in its own panel above. */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Open Matters — Sorted by Next Deadline</h3>
          <span className="muted" style={{ fontSize: '12px' }}>{tableRows.length} matters</span>
        </div>
        {tableRows.length === 0 && <p className="muted" style={{ fontSize: '13px' }}>No open matters assigned to you.</p>}
        {tableRows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Case Name</th>
                <th>File #</th>
                <th>Status</th>
                <th>Next Deadline</th>
                <th>Days Out</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((m) => {
                const badge = m.daysOut !== null ? daysOutBadge(m.daysOut) : null;
                return (
                  <tr key={m.id}>
                    <td><Link href={`/matters/${m.id}`}>{m.case_name}</Link></td>
                    <td>{renderFileNumber(m.file_number)}</td>
                    <td>
                      <span className={`badge badge-${STATUS_BADGE_COLOR[m.case_status] || 'gray'}`}>
                        {m.case_status || '—'}
                      </span>
                    </td>
                    <td>{m.nextDeadlineLabel || '—'}</td>
                    <td>{badge ? <span className={`badge badge-${badge.colorClass}`}>{badge.label}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
