'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

// CSR-SQL's sidebar, trimmed from NMT's original AppShell.js:
// - No Dashboard, no "All Matters" (replaced by "All CSRs" - this app's homepage)
// - No Starred Matters (an NMT-wide convenience feature that doesn't fit
//   this app's single-purpose scope - flagging in case you want it back)
// - Directory/Entities/Judges/Attorneys/Mediators kept as-is, per the
//   directory-access decision
// - Staff List kept (staff management stays in both apps)
// - New "CSR Form" section: plain downloads only, no Word Online editing
//   (per your call to simplify), pointed at this repo's own /public files
export default function AppShell({ session, onSignOut, children }) {
  const pathname = usePathname();

  const name = session?.user?.user_metadata?.full_name || session?.user?.email || 'User';
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
        <span className="brand">CSR Tracker</span>
        <div className="top-bar-right">
          <div className="user-badge">
            <span className="avatar">{initials || 'U'}</span>
            <span className="user-name">{name}</span>
          </div>
          <button className="btn-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mmm-logo-official.png" alt="McGraw Morris Masud" />
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">Main</div>
            <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
              All CSRs
            </Link>

            <div className="nav-section-label">Contacts</div>
            <Link href="/directory" className={`nav-item ${isActive('/directory') ? 'active' : ''}`}>
              Full Directory
            </Link>
            <Link href="/entities" className={`nav-item ${isActive('/entities') ? 'active' : ''}`}>
              Entities/Municipalities
            </Link>
            <Link href="/people/judges" className={`nav-item ${isActive('/people/judges') ? 'active' : ''}`}>
              Judges
            </Link>
            <Link href="/people/attorneys" className={`nav-item ${isActive('/people/attorneys') ? 'active' : ''}`}>
              Attorneys
            </Link>
            <Link href="/people/mediators" className={`nav-item ${isActive('/people/mediators') ? 'active' : ''}`}>
              Mediators
            </Link>

            <div className="nav-section-label">Admin</div>
            <Link href="/staff" className={`nav-item ${isActive('/staff') ? 'active' : ''}`}>
              Staff List
            </Link>

            <div className="nav-section-label">CSR Form</div>
            <a href="/blank-csr-form.docx" download className="nav-item">
              Download Blank CSR
            </a>
            <a href="/blank-budget-form.xlsx" download className="nav-item">
              Download Litigation Budget
            </a>
          </nav>
        </aside>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
