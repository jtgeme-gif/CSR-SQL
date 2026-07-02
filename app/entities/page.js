'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function EntitiesPage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('entities').select('*').order('name');
    if (error) setError(error.message);
    else setEntities(data || []);
    setLoading(false);
  }

  const filtered = entities.filter((e) =>
    e.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Entities</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <Link href="/entities/new" className="btn btn-primary">+ Add Entity</Link>
        </div>
      </div>

      {loading && <p className="muted">Loading entities…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{entities.length === 0 ? 'No entities yet.' : 'No entities match your search.'}</p>
          {entities.length === 0 && (
            <Link href="/entities/new" className="btn btn-primary">Add your first entity</Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>State</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.city || '—'}</td>
                <td>{e.state || '—'}</td>
                <td>{e.phone || '—'}</td>
                <td>{e.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
