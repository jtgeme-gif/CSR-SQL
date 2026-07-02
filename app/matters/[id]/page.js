'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import EntityPicker from '../../../components/EntityPicker';
import PersonPicker from '../../../components/PersonPicker';
import PersonModal from '../../../components/PersonModal';
import EntityModal from '../../../components/EntityModal';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];
const ENTITY_ROLES = ['Plaintiff', 'Defendant', 'Co-Defendant', 'Client'];
const PERSON_ROLES = [
  'Plaintiff', 'Defendant', 'Co-Defendant', 'Witness', 'Expert',
  'Plaintiff Attorney', 'Defense Attorney', 'Co-Defendant Attorney',
  'Judge', 'Magistrate Judge', 'Mediator', 'POC', 'Client Rep',
];

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id;

  const [matter, setMatter] = useState(null);
  const [clientInsurerName, setClientInsurerName] = useState('');
  const [staff, setStaff] = useState([]);
  const [caseEntities, setCaseEntities] = useState([]);
  const [casePeople, setCasePeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingCore, setEditingCore] = useState(false);
  const [coreForm, setCoreForm] = useState(null);
  const [savingCore, setSavingCore] = useState(false);

  const [newStaffName, setNewStaffName] = useState('');

  const [entityPartyForm, setEntityPartyForm] = useState({ entity_id: null, entity_name: '', role: 'Defendant', file_number: '', claim_rep_file_number: '' });
  const [personPartyForm, setPersonPartyForm] = useState({ person_id: null, person_name: '', role: 'Witness', capacity: '', poc_entity_id: '' });

  const [modalPersonId, setModalPersonId] = useState(null);
  const [modalEntityId, setModalEntityId] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: m, error: mErr } = await supabase.from('matters').select('*').eq('id', matterId).single();
    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }
    setMatter(m);
    setCoreForm(m);

    if (m.client_insurer_entity_id) {
      const { data: ins } = await supabase.from('entities').select('name').eq('id', m.client_insurer_entity_id).single();
      setClientInsurerName(ins?.name || '');
    } else {
      setClientInsurerName('');
    }

    const { data: staffData } = await supabase.from('matter_staff').select('*').eq('matter_id', matterId).order('created_at');
    setStaff(staffData || []);

    const { data: ceData } = await supabase.from('case_entities').select('*, entities(name)').eq('matter_id', matterId);
    setCaseEntities(ceData || []);

    const { data: cpData } = await supabase.from('case_people').select('*, people(first_name, last_name)').eq('matter_id', matterId);
    setCasePeople(cpData || []);

    setLoading(false);
  }

  // ---------- Core info ----------
  function updateCore(field, value) {
    setCoreForm((f) => ({ ...f, [field]: value }));
  }

  async function saveCore() {
    setSavingCore(true);
    const payload = {
      practice_group: coreForm.practice_group || null,
      case_status: coreForm.case_status || null,
      appellate_case_number: coreForm.case_status === 'Appeal' ? (coreForm.appellate_case_number || null) : null,
      date_opened: coreForm.date_opened || null,
      court_case_number: coreForm.court_case_number || null,
      client_insurer_entity_id: coreForm.client_insurer_entity_id || null,
    };
    const { error } = await supabase.from('matters').update(payload).eq('id', matterId);
    setSavingCore(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingCore(false);
    load();
  }

  async function toggleStar() {
    const { error } = await supabase.from('matters').update({ starred: !matter.starred }).eq('id', matterId);
    if (!error) load();
  }

  // ---------- Assigned staff ----------
  async function addStaff() {
    if (!newStaffName.trim()) return;
    const { error } = await supabase.from('matter_staff').insert({ matter_id: matterId, staff_name: newStaffName.trim() });
    if (error) {
      alert(error.message);
      return;
    }
    setNewStaffName('');
    load();
  }
  async function removeStaff(id) {
    await supabase.from('matter_staff').delete().eq('id', id);
    load();
  }

  // ---------- Entity parties ----------
  async function addEntityParty() {
    if (!entityPartyForm.entity_id) {
      alert('Pick or create an entity first.');
      return;
    }
    const { error } = await supabase.from('case_entities').insert({
      matter_id: matterId,
      entity_id: entityPartyForm.entity_id,
      role: entityPartyForm.role,
      file_number: entityPartyForm.file_number.trim() || null,
      claim_rep_file_number: entityPartyForm.claim_rep_file_number.trim() || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setEntityPartyForm({ entity_id: null, entity_name: '', role: 'Defendant', file_number: '', claim_rep_file_number: '' });
    load();
  }
  async function removeEntityParty(id) {
    await supabase.from('case_entities').delete().eq('id', id);
    load();
  }

  // ---------- Person parties ----------
  async function addPersonParty() {
    if (!personPartyForm.person_id) {
      alert('Pick or create a person first.');
      return;
    }
    const { error } = await supabase.from('case_people').insert({
      matter_id: matterId,
      person_id: personPartyForm.person_id,
      role: personPartyForm.role,
      capacity: personPartyForm.capacity.trim() || null,
      poc_entity_id: personPartyForm.role === 'POC' ? (personPartyForm.poc_entity_id || null) : null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setPersonPartyForm({ person_id: null, person_name: '', role: 'Witness', capacity: '', poc_entity_id: '' });
    load();
  }
  async function removePersonParty(id) {
    await supabase.from('case_people').delete().eq('id', id);
    load();
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!matter) return null;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'block' }}>
        <Link href="/" className="back-link">← All Matters</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>{matter.case_name}</h1>
          <button className="star-toggle" onClick={toggleStar} title="Star this matter">
            {matter.starred ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* CORE INFO */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Case Overview</h3>
          {!editingCore && <button className="btn-small" onClick={() => setEditingCore(true)}>Edit</button>}
        </div>

        {!editingCore && (
          <div className="detail-grid">
            <div className="detail-card"><span className="detail-label">Practice Group</span><span className="detail-value">{matter.practice_group || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Case Status</span><span className="detail-value">{matter.case_status || '—'}</span></div>
            {matter.case_status === 'Appeal' && (
              <div className="detail-card"><span className="detail-label">Appellate Case Number</span><span className="detail-value">{matter.appellate_case_number || '—'}</span></div>
            )}
            <div className="detail-card"><span className="detail-label">Date Opened</span><span className="detail-value">{matter.date_opened ? new Date(matter.date_opened).toLocaleDateString() : '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Court Case Number</span><span className="detail-value">{matter.court_case_number || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Client Insurer</span><span className="detail-value">{clientInsurerName || '—'}</span></div>
          </div>
        )}

        {editingCore && coreForm && (
          <div>
            <div className="form-row">
              <div className="form-field">
                <label>Practice Group</label>
                <select value={coreForm.practice_group || ''} onChange={(e) => updateCore('practice_group', e.target.value)}>
                  <option value="">Select…</option>
                  {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Case Status</label>
                <select value={coreForm.case_status || ''} onChange={(e) => updateCore('case_status', e.target.value)}>
                  <option value="">Select…</option>
                  {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {coreForm.case_status === 'Appeal' && (
              <div className="form-field">
                <label>Appellate Case Number</label>
                <input value={coreForm.appellate_case_number || ''} onChange={(e) => updateCore('appellate_case_number', e.target.value)} />
              </div>
            )}
            <div className="form-row">
              <div className="form-field">
                <label>Date Opened</label>
                <input type="date" value={coreForm.date_opened || ''} onChange={(e) => updateCore('date_opened', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Court Case Number</label>
                <input value={coreForm.court_case_number || ''} onChange={(e) => updateCore('court_case_number', e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Client Insurer</label>
              <EntityPicker
                value={coreForm.client_insurer_entity_id}
                valueName={clientInsurerName}
                onChange={(id, name) => { updateCore('client_insurer_entity_id', id); setClientInsurerName(name); }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveCore} disabled={savingCore}>{savingCore ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => { setEditingCore(false); setCoreForm(matter); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ASSIGNED STAFF */}
      <div className="section-card">
        <div className="section-card-header"><h3>Assigned Staff</h3></div>
        <div className="chip-row">
          {staff.length === 0 && <span className="muted">Nobody assigned yet.</span>}
          {staff.map((s) => (
            <span key={s.id} className="chip chip-removable">
              {s.staff_name}
              <button onClick={() => removeStaff(s.id)}>×</button>
            </span>
          ))}
        </div>
        <div className="inline-add-row">
          <input type="text" placeholder="Staff name" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
          <button className="btn-small" onClick={addStaff}>+ Add</button>
        </div>
      </div>

      {/* ENTITY PARTIES */}
      <div className="section-card">
        <div className="section-card-header"><h3>Parties — Entities</h3></div>
        {caseEntities.length === 0 && <p className="muted">No entities attached yet.</p>}
        {caseEntities.map((ce) => (
          <div key={ce.id} className="party-row">
            <a className="row-link" onClick={() => setModalEntityId(ce.entity_id)}>{ce.entities?.name}</a>
            <span className="badge badge-blue">{ce.role}</span>
            {ce.file_number && <span className="muted">File# {ce.file_number}</span>}
            {ce.claim_rep_file_number && <span className="muted">Claim# {ce.claim_rep_file_number}</span>}
            <button className="btn-small btn-small-danger" onClick={() => removeEntityParty(ce.id)}>Remove</button>
          </div>
        ))}

        <div className="add-party-form">
          <EntityPicker
            value={entityPartyForm.entity_id}
            valueName={entityPartyForm.entity_name}
            onChange={(id, name) => setEntityPartyForm((f) => ({ ...f, entity_id: id, entity_name: name }))}
          />
          <select value={entityPartyForm.role} onChange={(e) => setEntityPartyForm((f) => ({ ...f, role: e.target.value }))}>
            {ENTITY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" placeholder="File #" value={entityPartyForm.file_number} onChange={(e) => setEntityPartyForm((f) => ({ ...f, file_number: e.target.value }))} />
          <input type="text" placeholder="Claim Rep File #" value={entityPartyForm.claim_rep_file_number} onChange={(e) => setEntityPartyForm((f) => ({ ...f, claim_rep_file_number: e.target.value }))} />
          <button className="btn-small" onClick={addEntityParty}>+ Add</button>
        </div>
      </div>

      {/* PERSON PARTIES */}
      <div className="section-card">
        <div className="section-card-header"><h3>Parties — People</h3></div>
        {casePeople.length === 0 && <p className="muted">No people attached yet.</p>}
        {casePeople.map((cp) => (
          <div key={cp.id} className="party-row">
            <a className="row-link" onClick={() => setModalPersonId(cp.person_id)}>{cp.people?.first_name} {cp.people?.last_name}</a>
            <span className="badge badge-blue">{cp.role}</span>
            {cp.capacity && <span className="muted">{cp.capacity}</span>}
            <button className="btn-small btn-small-danger" onClick={() => removePersonParty(cp.id)}>Remove</button>
          </div>
        ))}

        <div className="add-party-form">
          <PersonPicker
            value={personPartyForm.person_id}
            valueName={personPartyForm.person_name}
            onChange={(id, name) => setPersonPartyForm((f) => ({ ...f, person_id: id, person_name: name }))}
          />
          <select value={personPartyForm.role} onChange={(e) => setPersonPartyForm((f) => ({ ...f, role: e.target.value }))}>
            {PERSON_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" placeholder="Capacity (e.g. as PR of the Estate of...)" value={personPartyForm.capacity} onChange={(e) => setPersonPartyForm((f) => ({ ...f, capacity: e.target.value }))} />
          {personPartyForm.role === 'POC' && (
            <select value={personPartyForm.poc_entity_id} onChange={(e) => setPersonPartyForm((f) => ({ ...f, poc_entity_id: e.target.value }))}>
              <option value="">POC for which entity?</option>
              {caseEntities.map((ce) => <option key={ce.entity_id} value={ce.entity_id}>{ce.entities?.name}</option>)}
            </select>
          )}
          <button className="btn-small" onClick={addPersonParty}>+ Add</button>
        </div>
      </div>

      {modalPersonId && <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />}
      {modalEntityId && <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />}
    </div>
  );
}
