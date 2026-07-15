'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StaffModal from '../../components/StaffModal';
import { formatPhoneDisplay } from '../../lib/formatPhone';

export default function StaffListPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalStaffId, setModalStaffId] = useState(null);
  const [creatingStaff, setCreatingStaff] = useState(false);

  useEffect(() => {
    document.title = 'Staff List';
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('staff').select('*').order('last_name');
    if (error) setError(error.message);
    else setStaffList(data || []);
    setLoading(false);
  }

  const filtered = staffList.filter((s) => {
    const full = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Staff List</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <button className="btn btn-primary" onClick={() => setCreatingStaff(true)}>+ Add Staff</button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{staffList.length === 0 ? 'No staff yet.' : 'No matches.'}</p>
          {staffList.length === 0 && <button className="btn btn-primary" onClick={() => setCreatingStaff(true)}>Add your first staff member</button>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Cell Phone</th>
              <th>Work Phone</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td><a className="row-link" onClick={() => setModalStaffId(s.id)}>{s.first_name} {s.last_name}</a></td>
                <td>{s.email || '—'}</td>
                <td>{formatPhoneDisplay(s.cell_phone) || '—'}</td>
                <td>{formatPhoneDisplay(s.work_phone) || '—'}{s.extension ? ` ext. ${s.extension}` : ''}</td>
                <td>{s.active ? 'Yes' : 'No'}</td>
                <td className="row-actions">
                  <button className="btn-small" onClick={() => setModalStaffId(s.id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalStaffId && (
        <StaffModal staffId={modalStaffId} onClose={() => setModalStaffId(null)} onChanged={load} />
      )}
      {creatingStaff && (
        <StaffModal staffId={null} onClose={() => setCreatingStaff(false)} onChanged={load} />
      )}
    </div>
  );
}
