'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PersonModal from '../../components/PersonModal';
import EntityModal from '../../components/EntityModal';

export default function EntitiesPage() {
  const [entities, setEntities] = useState([]);
  const [peopleByEntity, setPeopleByEntity] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalPersonId, setModalPersonId] = useState(null);
  const [modalEntityId, setModalEntityId] = useState(null);
  const [creatingEntity, setCreatingEntity] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: entitiesData, error: entitiesError } = await supabase
      .from('entities').select('*').order('name');
    if (entitiesError) {
      setError(entitiesError.message);
      setLoading(false);
      return;
    }

    const { data: peopleData } = await supabase
      .from('people')
      .select('id, first_name, last_name, identity, title, phone1, email1, entity_id')
      .not('entity_id', 'is', null);

    const grouped = {};
    (peopleData || []).forEach((p) => {
      if (!grouped[p.entity_id]) grouped[p.entity_id] = [];
      grouped[p.entity_id].push(p);
    });

    setEntities(entitiesData || []);
    setPeopleByEntity(grouped);
    setLoading(false);
  }

  function toggle(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const filtered = entities.filter((e) => e.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Entities / Municipalities</h1>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
          />
          <button className="btn btn-primary" onClick={() => setCreatingEntity(true)}>+ Add Entity</button>
        </div>
      </div>

      {loading && <p className="muted">Loading entities…</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>{entities.length === 0 ? 'No entities yet.' : 'No entities match your search.'}</p>
          {entities.length === 0 && <button className="btn btn-primary" onClick={() => setCreatingEntity(true)}>Add your first entity</button>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="entity-accordion">
          {filtered.map((e) => {
            const people = peopleByEntity[e.id] || [];
            const isOpen = !!expanded[e.id];
            return (
              <div key={e.id} className="entity-accordion-item">
                <div className="entity-accordion-header" onClick={() => toggle(e.id)}>
                  <span className={`entity-accordion-caret ${isOpen ? 'open' : ''}`}>▶</span>
                  <span className="entity-accordion-name">{e.name}</span>
                  <span className="entity-accordion-count">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
                  <span className="entity-accordion-meta">{[e.city, e.state].filter(Boolean).join(', ')}</span>
                  <button
                    className="btn-small"
                    onClick={(ev) => { ev.stopPropagation(); setModalEntityId(e.id); }}
                  >
                    Edit
                  </button>
                </div>
                {isOpen && (
                  <div className="entity-accordion-body">
                    {people.length === 0 && <div className="muted" style={{ padding: '10px 0' }}>Nobody linked to this entity yet.</div>}
                    {people.map((p) => (
                      <div key={p.id} className="entity-person-row">
                        <a className="row-link" onClick={() => setModalPersonId(p.id)}>{p.first_name} {p.last_name}</a>
                        <span className="chip">{p.identity}</span>
                        <span className="muted">{p.title || '—'}</span>
                        <span className="muted">{p.phone1 || '—'}</span>
                        <span className="muted">{p.email1 || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalPersonId && (
        <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />
      )}
      {modalEntityId && (
        <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />
      )}
      {creatingEntity && (
        <EntityModal entityId={null} onClose={() => setCreatingEntity(false)} onChanged={load} />
      )}
    </div>
  );
}
