'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// 1-10 days = urgent (orange), 11-20 = moderate (yellow), 21+ = calm (green).
// The color follows whatever number is actually chosen, not the box's position.
function colorForWindow(days) {
  if (days <= 10) return 'orange';
  if (days <= 20) return 'yellow';
  return 'green';
}

const OVERDUE_CAP_DAYS = 45;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
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
        setLoading(false);
        return;
      }

      const { data: assignments } = await supabase.from('matter_staff').select('matter_id').eq('staff_id', staffRow.id);
      const matterIds = [...new Set((assignments || []).map((a) => a.matter_id))];

      if (matterIds.length > 0) {
        const { data: eventsData } = await supabase
          .from('events')
          .select('*, event_types(label), matters(case_name)')
          .in('matter_id', matterIds)
          .eq('completed', false)
          .order('event_date');
        setEvents(eventsData || []);
      } else {
        setEvents([]);
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

      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
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
    </div>
  );
}
