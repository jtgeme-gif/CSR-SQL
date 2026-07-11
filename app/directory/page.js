'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PersonModal from '../../components/PersonModal';
import EntityModal from '../../components/EntityModal';

export default function DirectoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('lastName');
  const [sortDir, setSortDir] = useState('asc');
  const [modalPersonId, setModalPersonId] = useState(null);
  const [modalEntityId, setModalEntityId] = useState(null);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [creatingEntity, setCreatingEntity] = useState(false);

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
      lastName: p.last_name || p.first_name || '',
      title: p.title,
      entityName: p.entities?.name || '',
      department: p.department || '',
      phone: p.phone1,
      email: p.email1,
      isExpert: !!p.expert,
      areaOfExpertise: p.expert ? (p.field_of_expertise || '') : '',
    }));

    const entityRows = (entities || []).map((e) => ({
      id: e.id,
      recordType: 'Entity',
      name: e.name,
      lastName: e.name || '',
      title: '',
      entityName: '',
      department: '',
      phone: e.phone,
      email: e.email,
      isExpert: e.entity_type === 'Expert',
      areaOfExpertise: '',
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
      if (typeFilter === 'Expert') {
        if (!r.isExpert) return false;
      } else if (typeFilter !== 'all' && r.recordType !== typeFilter) {
        return false;
      }
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
            <option value="Expert">Experts</option>
          </select>
          <button className="btn btn-primary" onClick={() => setCreatingPerson(true)}>+ Add Person</button>
          <button className="btn btn-primary" onClick={() => setCreatingEntity(true)}>+ Add Entity</button>
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
              <th className="sortable" onClick={() => toggleSort('lastName')}>Name{sortArrow('lastName')}</th>
              <th>Title</th>
              <th>Entity</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Area of Expertise</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.recordType}-${r.id}`}>
                <td><a className="row-link" onClick={() => handleRowClick(r)}>{r.name}</a></td>
                <td>{r.title || '—'}</td>
                <td>{r.entityName || '—'}</td>
                <td>{r.department || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.email || '—'}</td>
                <td>{r.areaOfExpertise || (r.isExpert ? '—' : '')}</td>
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
      {creatingPerson && (
        <PersonModal personId={null} onClose={() => setCreatingPerson(false)} onChanged={load} />
      )}
      {creatingEntity && (
        <EntityModal entityId={null} onClose={() => setCreatingEntity(false)} onChanged={load} />
      )}
    </div>
  );
}
