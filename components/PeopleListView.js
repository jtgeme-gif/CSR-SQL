'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import PersonModal from './PersonModal';
import { formatPhoneDisplay } from '../lib/formatPhone';

export default function PeopleListView({ title, identityFilter, mediatorFilter }) {
  const isJudgeList = identityFilter === 'Judge';
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalPersonId, setModalPersonId] = useState(null);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    let query = supabase.from('people').select('*, entities(name)').order('last_name');
    if (identityFilter) query = query.eq('identity', identityFilter);
    if (mediatorFilter) query = query.eq('mediator', true);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setPeople(data || []);
    setLoading(false);
  }

  const filtered = people.filter((p) => {
    const full = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  function openView(id) {
    setModalPersonId(id);
    setModalEdit(false);
  }
  async function handleDelete(p) {
    if (!confirm(`Delete ${p.first_name} ${p.last_name}? This can't be undone.`)) return;
    const { error } = await supabase.from('people').delete().eq('id', p.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{title}</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <button className="btn btn-primary" onClick={() => setCreatingPerson(true)}>+ Add Person</button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{people.length === 0 ? 'Nobody here yet.' : 'No matches.'}</p>
          {people.length === 0 && <button className="btn btn-primary" onClick={() => setCreatingPerson(true)}>Add a person</button>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {isJudgeList ? (
                <>
                  <th>Title</th>
                  <th>Court</th>
                  <th>Jurisdiction</th>
                </>
              ) : (
                <>
                  <th>Identity</th>
                  <th>Title</th>
                  <th>Entity</th>
                  <th>Department</th>
                </>
              )}
              <th>Phone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><a className="row-link" onClick={() => openView(p.id)}>{p.first_name} {p.last_name}</a></td>
                {isJudgeList ? (
                  <>
                    <td>{p.magjudge ? 'Magistrate Judge' : p.identity}</td>
                    <td>{p.court_level || '—'}</td>
                    <td>{p.court_jurisdiction || '—'}</td>
                  </>
                ) : (
                  <>
                    <td>{p.identity}</td>
                    <td>{p.title || '—'}</td>
                    <td>{p.entities?.name || '—'}</td>
                    <td>{p.department || '—'}</td>
                  </>
                )}
                <td>{formatPhoneDisplay(p.phone1) || '—'}</td>
                <td>{p.email1 || '—'}</td>
                <td className="row-actions">
                  <button className="btn-small" onClick={() => openView(p.id)}>View</button>
                  <button className="btn-small btn-small-danger" onClick={() => handleDelete(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalPersonId && (
        <PersonModal
          personId={modalPersonId}
          startInEdit={modalEdit}
          onClose={() => setModalPersonId(null)}
          onChanged={load}
        />
      )}
      {creatingPerson && (
        <PersonModal personId={null} onClose={() => setCreatingPerson(false)} onChanged={load} />
      )}
    </div>
  );
}
