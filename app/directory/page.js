'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import PersonModal from '../../components/PersonModal';
import EntityModal from '../../components/EntityModal';

export default function DirectoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalPersonId, setModalPersonId] = useState(null);
  const [modalEntityId, setModalEntityId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const [{ data: people, error: peopleError }, { data: entities, error: entitiesError }] = await Promise.all([
      supabase.from('people').select('*, entities(name)'),
      supabase.from('entities').select('*'),
    ]);

    if (peopleError || entitiesError) {
      setError((peopleError || entitiesError).message);
      setLoading(false);
      return;
    }

    const peopleRows = (people || []).map((p) => ({
      id: p.id,
      recordType: 'Person',
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || '(unnamed)',
      identity: p.identity,
      title: p.title,
      entityName: p.entities?.name || '',
      city: p.city,
      state: p.state,
      phone: p.phone1,
      email: p.email1,
    }));

    const entityRows = (entities || []).map((e) => ({
      id: e.id,
      recordType: 'Entity',
      name: e.name,
      identity: '',
      title: '',
      entityName: '',
      city: e.city,
      state: e.state,
      phone: e.phone,
      email: e.email,
    }));

    setRows([...peopleRows, ...entityRows]);
    setLoading(false);
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let result = rows.filter((r) => {
      if (typeFilter !== 'all' && r.recordType !== typeFilter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    result.sort((a, b) => {
      const av = (a[sortField] || '').toString().toLowerCase();
      const bv = (b[sortField] || '').toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [rows, search, typeFilter, sortField, sortDir]);

  function handleRowClick(r) {
    if (r.recordType === 'Person') {
      setModalPersonId(r.id);
    } else {
      setModalEntityId(r.id);
    }
  }

  function sortArrow(field) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Full Directory</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="Person">People only</option>
            <option value="Entity">Entities only</option>
          </select>
          <Link href="/people/new" className="btn btn-primary">+ Add Person</Link>
          <Link href="/entities/new" className="btn btn-primary">+ Add Entity</Link>
        </div>
      </div>

      {loading && <p className="muted">Loading directory…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state"><p>Nothing matches.</p></div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
              <th className="sortable" onClick={() => toggleSort('recordType')}>Type{sortArrow('recordType')}</th>
              <th>Identity</th>
              <th>Title</th>
              <th>Entity</th>
              <th className="sortable" onClick={() => toggleSort('city')}>City{sortArrow('city')}</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.recordType}-${r.id}`}>
                <td><a className="row-link" onClick={() => handleRowClick(r)}>{r.name}</a></td>
                <td><span className={`chip ${r.recordType === 'Entity' ? 'chip-entity' : ''}`}>{r.recordType}</span></td>
                <td>{r.identity || '—'}</td>
                <td>{r.title || '—'}</td>
                <td>{r.entityName || '—'}</td>
                <td>{r.city || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalPersonId && (
        <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />
      )}
      {modalEntityId && (
        <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />
      )}
    </div>
  );
}
