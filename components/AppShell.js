'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function AppShell({ session, onSignOut, children }) {
  const pathname = usePathname();
  const [starred, setStarred] = useState([]);

  useEffect(() => {
    loadStarred();
  }, [pathname]);

  async function loadStarred() {
    const { data } = await supabase
      .from('matters')
      .select('id, case_name, court_case_number')
      .eq('starred', true)
      .order('case_name');
    setStarred(data || []);
  }

  const name = session?.user?.user_metadata?.full_name || session?.user?.email || 'User';
  const email = session?.user?.email || '';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isActive = (href) => pathname === href;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="brand">Matter Tracker</span>
        <div className="top-bar-right">
          <div className="user-badge">
            <span className="avatar">{initials || 'U'}</span>
            <span className="user-name">{name}</span>
          </div>
          <button className="btn-link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mmm-logo.jpg" alt="McGraw Morris Masud" />
            <div className="sidebar-wordmark">MATTER TRACKER</div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">Main</div>
            <span className="nav-item disabled">Dashboard</span>
            <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
              All Matters
            </Link>
            <span className="nav-item disabled">Upcoming Deadlines</span>

            <div className="nav-section-label">Directories</div>
            <span className="nav-item disabled" title="Naming still TBD">
              People
            </span>
            <span className="nav-item disabled" title="Naming still TBD">
              Entities
            </span>

            <div className="nav-section-label">Admin</div>
            <span className="nav-item disabled">Settings</span>
          </nav>

          <div className="sidebar-starred">
            <div className="nav-section-label">Starred Matters</div>
            {starred.length === 0 && <div className="starred-empty">None yet</div>}
            {starred.map((m) => (
              <Link key={m.id} href={`/matters/${m.id}`} className="starred-item">
                ★ {m.case_name}
                {m.court_case_number ? ` ${m.court_case_number}` : ''}
              </Link>
            ))}
          </div>
        </aside>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
