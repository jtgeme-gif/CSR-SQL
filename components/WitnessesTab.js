'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import PersonPicker from './PersonPicker';
import EntityPicker from './EntityPicker';

const WITNESS_TYPES = ['Fact', 'Expert', 'Records', 'Reps', 'Other'];
const PARTIES = ['Plaintiff', 'Defendant', 'Co-Defendant'];

export default function WitnessesTab({ matterId }) {
  const [loading, setLoading] = useState(true);
  const [personWitnesses, setPersonWitnesses] = useState([]); // case_people, role=Witness
  const [entityWitnesses, setEntityWitnesses] = useState([]); // case_entities, role=Witness
  const [viewBy, setViewBy] = useState('type'); // 'type' | 'party'

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(blankAddForm());

  const [repModalFor, setRepModalFor] = useState(null); // entity_id currently adding a rep for
  const [repForm, setRepForm] = useState({ person_id: null, person_name: '' });

  const [editingId, setEditingId] = useState(null); // case_people.id currently being edited inline
  const [editForm, setEditForm] = useState({});

  function blankAddForm() {
    return {
      partyType: 'Person',
      person_id: null, person_name: '',
      entity_id: null, entity_name: '',
      witness_type: 'Fact', party: 'Plaintiff',
    };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    const { data: cpData } = await supabase
      .from('case_people')
      .select('*, people(id, first_name, last_name, email1, phone1), poc_entity:poc_entity_id(id, name)')
      .eq('matter_id', matterId)
      .eq('role', 'Witness');
    setPersonWitnesses(cpData || []);

    const { data: ceData } = await supabase
      .from('case_entities')
      .select('*, entities(id, name)')
      .eq('matter_id', matterId)
      .eq('role', 'Witness');
    setEntityWitnesses(ceData || []);

    setLoading(false);
  }

  // Standalone person witnesses (not a designated rep for anyone)
  const standalonePersons = personWitnesses.filter((p) => !p.poc_entity_id);
  // Designated reps, grouped by which entity they represent
  function repsFor(entityId) {
    return personWitnesses.filter((p) => p.poc_entity_id === entityId);
  }

  function openAddWitness() {
    setAddForm(blankAddForm());
    setAddModalOpen(true);
  }

  async function saveAddWitness() {
    const f = addForm;
    if (f.partyType === 'Person' && !f.person_id) { alert('Pick or create a person first.'); return; }
    if (f.partyType === 'Entity' && !f.entity_id) { alert('Pick or create an entity first.'); return; }

    if (f.partyType === 'Person') {
      const { error } = await supabase.from('case_people').insert({
        matter_id: matterId, person_id: f.person_id, role: 'Witness',
        witness_type: f.witness_type, party: f.party,
      });
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('case_entities').insert({
        matter_id: matterId, entity_id: f.entity_id, role: 'Witness', party: f.party,
      });
      if (error) { alert(error.message); return; }
    }
    setAddModalOpen(false);
    load();
  }

  async function removePersonWitness(id) {
    if (!confirm('Remove this witness?')) return;
    const { error } = await supabase.from('case_people').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function removeEntityWitness(id) {
    if (!confirm('Remove this entity witness? This also removes any Designated Representatives linked to it.')) return;
    const { error } = await supabase.from('case_entities').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  function openAddRep(entityId) {
    setRepForm({ person_id: null, person_name: '' });
    setRepModalFor(entityId);
  }

  async function saveRep(defaultParty) {
    if (!repForm.person_id) { alert('Pick or create a person first.'); return; }
    const { error } = await supabase.from('case_people').insert({
      matter_id: matterId, person_id: repForm.person_id, role: 'Witness',
      witness_type: 'Reps', party: defaultParty, poc_entity_id: repModalFor,
    });
    if (error) { alert(error.message); return; }
    setRepModalFor(null);
    load();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      witness_type: p.witness_type || 'Fact',
      party: p.party || 'Plaintiff',
      disclosed: p.disclosed || false,
      cv_received: p.cv_received || false,
      report_received: p.report_received || false,
      deposed: p.deposed || false,
    });
  }

  async function saveEdit(id) {
    const payload = {
      witness_type: editForm.witness_type,
      party: editForm.party,
      disclosed: editForm.witness_type === 'Expert' ? !!editForm.disclosed : null,
      cv_received: editForm.witness_type === 'Expert' ? !!editForm.cv_received : null,
      report_received: editForm.witness_type === 'Expert' ? !!editForm.report_received : null,
      deposed: editForm.witness_type === 'Expert' ? !!editForm.deposed : null,
    };
    const { error } = await supabase.from('case_people').update(payload).eq('id', id);
    if (error) { alert(error.message); return; }
    setEditingId(null);
    load();
  }

  function renderPersonCard(p) {
    const name = `${p.people?.first_name || ''} ${p.people?.last_name || ''}`.trim();
    return (
      <div key={p.id} className="party-card">
        <div className="party-card-header">
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span className="badge badge-blue">{p.witness_type || '—'}</span>
          {p.party && <span className="badge badge-gray">{p.party}</span>}
          <button className="btn-small btn-small-danger" onClick={() => removePersonWitness(p.id)}>Remove</button>
        </div>

        {editingId === p.id ? (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
            <div className="form-row">
              <div className="form-field">
                <label>Witness Type</label>
                <select value={editForm.witness_type} onChange={(e) => setEditForm((f) => ({ ...f, witness_type: e.target.value }))}>
                  {WITNESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Party</label>
                <select value={editForm.party} onChange={(e) => setEditForm((f) => ({ ...f, party: e.target.value }))}>
                  {PARTIES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>
            </div>
            {editForm.witness_type === 'Expert' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="form-checkbox"><input type="checkbox" id={`disc-${p.id}`} checked={!!editForm.disclosed} onChange={(e) => setEditForm((f) => ({ ...f, disclosed: e.target.checked }))} /><label htmlFor={`disc-${p.id}`}>Disclosed</label></div>
                <div className="form-checkbox"><input type="checkbox" id={`cv-${p.id}`} checked={!!editForm.cv_received} onChange={(e) => setEditForm((f) => ({ ...f, cv_received: e.target.checked }))} /><label htmlFor={`cv-${p.id}`}>CV Received</label></div>
                <div className="form-checkbox"><input type="checkbox" id={`rep-${p.id}`} checked={!!editForm.report_received} onChange={(e) => setEditForm((f) => ({ ...f, report_received: e.target.checked }))} /><label htmlFor={`rep-${p.id}`}>Report Received</label></div>
                <div className="form-checkbox"><input type="checkbox" id={`dep-${p.id}`} checked={!!editForm.deposed} onChange={(e) => setEditForm((f) => ({ ...f, deposed: e.target.checked }))} /><label htmlFor={`dep-${p.id}`}>Deposed</label></div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-small btn-primary" onClick={() => saveEdit(p.id)}>Save</button>
              <button className="btn-small" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {p.witness_type === 'Expert' && (
              <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                Disclosed: {p.disclosed ? 'Yes' : 'No'} · CV: {p.cv_received ? 'Yes' : 'No'} · Report: {p.report_received ? 'Yes' : 'No'} · Deposed: {p.deposed ? 'Yes' : 'No'}
              </div>
            )}
            <div className="muted" style={{ fontSize: '11px', marginTop: '4px', cursor: 'pointer' }} onClick={() => startEdit(p)}>Edit</div>
          </>
        )}
      </div>
    );
  }

  function renderEntityCard(ce) {
    const reps = repsFor(ce.entities?.id);
    return (
      <div key={ce.id} className="party-card">
        <div className="party-card-header">
          <span style={{ fontWeight: 600 }}>{ce.entities?.name}</span>
          <span className="badge badge-blue">Entity Witness</span>
          {ce.party && <span className="badge badge-gray">{ce.party}</span>}
          <button className="btn-small btn-small-danger" onClick={() => removeEntityWitness(ce.id)}>Remove</button>
        </div>

        <div className="nested-block">
          <span className="nested-label">Designated Representative(s):</span>
          {reps.map((r) => (
            <span key={r.id} className="chip chip-removable">
              {r.people?.first_name} {r.people?.last_name}
              <button onClick={() => removePersonWitness(r.id)}>×</button>
            </span>
          ))}
          {repModalFor === ce.entities?.id ? (
            <span style={{ position: 'relative' }}>
              <PersonPicker value={repForm.person_id} valueName={repForm.person_name} onChange={(id, name) => setRepForm({ person_id: id, person_name: name })} />
              <button className="btn-small btn-primary" style={{ marginLeft: '6px' }} onClick={() => saveRep(ce.party)}>Add</button>
              <button className="btn-small" style={{ marginLeft: '4px' }} onClick={() => setRepModalFor(null)}>Cancel</button>
            </span>
          ) : (
            <button className="btn-small" onClick={() => openAddRep(ce.entities?.id)}>+ Add Designated Representative</button>
          )}
        </div>
      </div>
    );
  }

  // ---------- Grouping for the two view modes ----------
  function renderTypeView() {
    const experts = standalonePersons.filter((p) => p.witness_type === 'Expert');
    const others = standalonePersons.filter((p) => p.witness_type !== 'Expert');
    return (
      <>
        <div className="section-card">
          <div className="section-card-header"><h3>Witnesses ({others.length + entityWitnesses.length})</h3></div>
          {others.length === 0 && entityWitnesses.length === 0 && <p className="muted">No witnesses yet.</p>}
          {entityWitnesses.map((ce) => renderEntityCard(ce))}
          {others.map((p) => renderPersonCard(p))}
        </div>
        <div className="section-card">
          <div className="section-card-header"><h3>Experts ({experts.length})</h3></div>
          {experts.length === 0 && <p className="muted">No experts yet.</p>}
          {experts.map((p) => renderPersonCard(p))}
        </div>
      </>
    );
  }

  function renderPartyView() {
    return (
      <>
        {PARTIES.map((party) => {
          const persons = standalonePersons.filter((p) => p.party === party);
          const entitiesForParty = entityWitnesses.filter((ce) => ce.party === party);
          return (
            <div className="section-card" key={party}>
              <div className="section-card-header"><h3>{party} ({persons.length + entitiesForParty.length})</h3></div>
              {persons.length === 0 && entitiesForParty.length === 0 && <p className="muted">None yet.</p>}
              {entitiesForParty.map((ce) => renderEntityCard(ce))}
              {persons.map((p) => renderPersonCard(p))}
            </div>
          );
        })}
      </>
    );
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={openAddWitness}>+ Add Witness</button>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '13px' }}>View by:</span>
          <button className={`btn-small ${viewBy === 'type' ? 'btn-primary' : ''}`} onClick={() => setViewBy('type')}>Type</button>
          <button className={`btn-small ${viewBy === 'party' ? 'btn-primary' : ''}`} onClick={() => setViewBy('party')}>Party</button>
        </div>
      </div>

      {viewBy === 'type' ? renderTypeView() : renderPartyView()}

      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Witness</h2>
              <button className="modal-close" onClick={() => setAddModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Party Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={`btn-small ${addForm.partyType === 'Person' ? 'btn-primary' : ''}`} onClick={() => setAddForm((f) => ({ ...f, partyType: 'Person' }))}>Person</button>
                  <button className={`btn-small ${addForm.partyType === 'Entity' ? 'btn-primary' : ''}`} onClick={() => setAddForm((f) => ({ ...f, partyType: 'Entity' }))}>Entity</button>
                </div>
              </div>

              {addForm.partyType === 'Person' ? (
                <div className="form-field">
                  <label>Witness</label>
                  <PersonPicker value={addForm.person_id} valueName={addForm.person_name} onChange={(id, name) => setAddForm((f) => ({ ...f, person_id: id, person_name: name }))} />
                </div>
              ) : (
                <div className="form-field">
                  <label>Entity Witness</label>
                  <EntityPicker value={addForm.entity_id} valueName={addForm.entity_name} onChange={(id, name) => setAddForm((f) => ({ ...f, entity_id: id, entity_name: name }))} />
                </div>
              )}

              <div className="form-row">
                {addForm.partyType === 'Person' && (
                  <div className="form-field">
                    <label>Witness Type</label>
                    <select value={addForm.witness_type} onChange={(e) => setAddForm((f) => ({ ...f, witness_type: e.target.value }))}>
                      {WITNESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-field">
                  <label>Party</label>
                  <select value={addForm.party} onChange={(e) => setAddForm((f) => ({ ...f, party: e.target.value }))}>
                    {PARTIES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveAddWitness}>Add Witness</button>
                <button className="btn" onClick={() => setAddModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
