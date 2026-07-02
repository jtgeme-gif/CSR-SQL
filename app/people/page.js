'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('people')
      .select('*, entities(name)')
      .order('last_name');
    if (error) setError(error.message);
    else setPeople(data || []);
    setLoading(false);
  }

  const filtered = people.filter((p) => {
    const full = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>People</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <Link href="/people/new" className="btn btn-primary">+ Add Person</Link>
        </div>
      </div>

      {loading && <p className="muted">Loading people…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{people.length === 0 ? 'No people yet.' : 'No people match your search.'}</p>
          {people.length === 0 && (
            <Link href="/people/new" className="btn btn-primary">Add your first person</Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Identity</th>
              <th>Title</th>
              <th>Entity</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.first_name} {p.last_name}</td>
                <td>{p.identity}</td>
                <td>{p.title || '—'}</td>
                <td>{p.entities?.name || '—'}</td>
                <td>{p.phone1 || '—'}</td>
                <td>{p.email1 || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
