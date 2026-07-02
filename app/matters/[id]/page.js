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
const PARTY_ROLES = ['Plaintiff', 'Defendant', 'Co-Defendant'];
const TABS = ['Overview', 'Case', 'Scheduling', 'Discovery & Depositions', 'Witnesses & Exhibits', 'Motions & Briefs', 'Mediation & Demands', 'Notes', 'Tasks', 'CSR', 'Subpoenas'];

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id;

  const [matter, setMatter] = useState(null);
  const [staff, setStaff] = useState([]);
  const [caseEntities, setCaseEntities] = useState([]);
  const [casePeople, setCasePeople] = useState([]);
  const [claimReps, setClaimReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingCore, setEditingCore] = useState(false);
  const [coreForm, setCoreForm] = useState(null);
  const [savingCore, setSavingCore] = useState(false);
  const [clientInsurerName, setClientInsurerName] = useState('');

  const [newStaffName, setNewStaffName] = useState('');
  const [newClaimRep, setNewClaimRep] = useState({ person_id: null, person_name: '', claim_number: '', label: '' });

  const [newJudge, setNewJudge] = useState({ person_id: null, person_name: '' });
  const [newMagJudge, setNewMagJudge] = useState({ person_id: null, person_name: '' });
  const [newMediator, setNewMediator] = useState({ person_id: null, person_name: '' });

  // per-role add-party forms
  const [addEntityForm, setAddEntityForm] = useState({});
  const [addPersonForm, setAddPersonForm] = useState({});
  // per-party nested add forms (keyed by "entity-<id>" or "person-<id>")
  const [nestedAddForm, setNestedAddForm] = useState({});

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
    if (mErr) { setError(mErr.message); setLoading(false); return; }
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

    const { data: ceData } = await supabase.from('case_entities').select('*, entities(id, name)').eq('matter_id', matterId);
    setCaseEntities(ceData || []);

    const { data: cpData } = await supabase.from('case_people').select('*, people(id, first_name, last_name, email1)').eq('matter_id', matterId);
    setCasePeople(cpData || []);

    const { data: crData } = await supabase.from('matter_claim_reps').select('*, people(first_name, last_name, email1)').eq('matter_id', matterId).order('created_at');
    setClaimReps(crData || []);

    setLoading(false);
  }

  // ---------- Core info ----------
  function updateCore(field, value) { setCoreForm((f) => ({ ...f, [field]: value })); }

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
    if (error) { alert(error.message); return; }
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
    await supabase.from('matter_staff').insert({ matter_id: matterId, staff_name: newStaffName.trim() });
    setNewStaffName('');
    load();
  }
  async function removeStaff(id) { await supabase.from('matter_staff').delete().eq('id', id); load(); }

  // ---------- Claim reps ----------
  async function addClaimRep() {
    if (!newClaimRep.person_id) { alert('Pick or create a claim rep first.'); return; }
    const { error } = await supabase.from('matter_claim_reps').insert({
      matter_id: matterId,
      person_id: newClaimRep.person_id,
      claim_number: newClaimRep.claim_number.trim() || null,
      label: newClaimRep.label.trim() || null,
    });
    if (error) { alert(error.message); return; }
    setNewClaimRep({ person_id: null, person_name: '', claim_number: '', label: '' });
    load();
  }
  async function removeClaimRep(id) { await supabase.from('matter_claim_reps').delete().eq('id', id); load(); }

  // ---------- Court & Jurisdiction ----------
  async function addCourtRole(role, picked, resetFn) {
    if (!picked.person_id) { alert('Pick or create a person first.'); return; }
    const { error } = await supabase.from('case_people').insert({ matter_id: matterId, person_id: picked.person_id, role });
    if (error) { alert(error.message); return; }
    resetFn({ person_id: null, person_name: '' });
    load();
  }
  async function removeCasePerson(id) { await supabase.from('case_people').delete().eq('id', id); load(); }

  // ---------- Parties ----------
  function entityFormFor(role) { return addEntityForm[role] || { entity_id: null, entity_name: '' }; }
  function personFormFor(role) { return addPersonForm[role] || { person_id: null, person_name: '' }; }

  async function addEntityParty(role) {
    const f = entityFormFor(role);
    if (!f.entity_id) { alert('Pick or create an entity first.'); return; }
    const { error } = await supabase.from('case_entities').insert({ matter_id: matterId, entity_id: f.entity_id, role });
    if (error) { alert(error.message); return; }
    setAddEntityForm((s) => ({ ...s, [role]: { entity_id: null, entity_name: '' } }));
    load();
  }
  async function addPersonParty(role) {
    const f = personFormFor(role);
    if (!f.person_id) { alert('Pick or create a person first.'); return; }
    const { error } = await supabase.from('case_people').insert({ matter_id: matterId, person_id: f.person_id, role });
    if (error) { alert(error.message); return; }
    setAddPersonForm((s) => ({ ...s, [role]: { person_id: null, person_name: '' } }));
    load();
  }
  async function removeEntityParty(id) { await supabase.from('case_entities').delete().eq('id', id); load(); }
  async function removePersonParty(id) { await supabase.from('case_people').delete().eq('id', id); load(); }

  // Nested POC (defendant entities) / Attorney (plaintiff & co-defendant parties)
  function nestedKey(kind, id) { return `${kind}-${id}`; }
  function nestedFormFor(key) { return nestedAddForm[key] || { person_id: null, person_name: '' }; }
  function updateNestedForm(key, val) { setNestedAddForm((s) => ({ ...s, [key]: val })); }

  async function addPOC(caseEntityId, entityGlobalId) {
    const key = nestedKey('poc', caseEntityId);
    const f = nestedFormFor(key);
    if (!f.person_id) { alert('Pick or create a person first.'); return; }
    const { error } = await supabase.from('case_people').insert({
      matter_id: matterId, person_id: f.person_id, role: 'POC', poc_entity_id: entityGlobalId,
    });
    if (error) { alert(error.message); return; }
    updateNestedForm(key, { person_id: null, person_name: '' });
    load();
  }

  async function addAttorney(partyKind, partyId) {
    const key = nestedKey('atty-' + partyKind, partyId);
    const f = nestedFormFor(key);
    if (!f.person_id) { alert('Pick or create an attorney first.'); return; }
    const payload = { matter_id: matterId, person_id: f.person_id, role: 'Attorney' };
    if (partyKind === 'entity') payload.represents_case_entity_id = partyId;
    else payload.represents_case_person_id = partyId;
    const { error } = await supabase.from('case_people').insert(payload);
    if (error) { alert(error.message); return; }
    updateNestedForm(key, { person_id: null, person_name: '' });
    load();
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!matter) return null;

  const judgeRows = casePeople.filter((cp) => cp.role === 'Judge');
  const magJudgeRows = casePeople.filter((cp) => cp.role === 'Magistrate Judge');
  const mediatorRows = casePeople.filter((cp) => cp.role === 'Mediator');

  // Build "Our File" / "Client File" strings from case_entities
  const fileNumbers = caseEntities.filter((ce) => ce.file_number).map((ce) => `${ce.file_number} (${ce.entities?.name})`).join(' / ');
  const clientFileNumbers = caseEntities.filter((ce) => ce.claim_rep_file_number).map((ce) => `${ce.entities?.name}: ${ce.claim_rep_file_number}`).join(' // ');

  function partiesForRole(role) {
    const entities = caseEntities.filter((ce) => ce.role === role);
    const people = casePeople.filter((cp) => cp.role === role);
    return { entities, people };
  }

  function renderPartyGroup(role) {
    const { entities, people } = partiesForRole(role);
    const eForm = entityFormFor(role);
    const pForm = personFormFor(role);

    return (
      <div className="party-group" key={role}>
        <div className="party-group-title">{role}s</div>

        {entities.length === 0 && people.length === 0 && <p className="muted" style={{ margin: '4px 0 10px' }}>None yet.</p>}

        {entities.map((ce) => {
          const pocKey = nestedKey('poc', ce.id);
          const pocForm = nestedFormFor(pocKey);
          const pocs = casePeople.filter((cp) => cp.role === 'POC' && cp.poc_entity_id === ce.entities?.id);
          const attyKey = nestedKey('atty-entity', ce.id);
          const attyForm = nestedFormFor(attyKey);
          const attys = casePeople.filter((cp) => cp.role === 'Attorney' && cp.represents_case_entity_id === ce.id);

          return (
            <div key={ce.id} className="party-card">
              <div className="party-card-header">
                <a className="row-link" onClick={() => setModalEntityId(ce.entities?.id)}>{ce.entities?.name}</a>
                <span className="badge badge-blue">Entity</span>
                <button className="btn-small btn-small-danger" onClick={() => removeEntityParty(ce.id)}>Remove</button>
              </div>

              {role === 'Defendant' && (
                <div className="nested-block">
                  <span className="nested-label">POC(s):</span>
                  {pocs.map((p) => (
                    <span key={p.id} className="chip chip-removable">
                      {p.people?.first_name} {p.people?.last_name}
                      <button onClick={() => removeCasePerson(p.id)}>×</button>
                    </span>
                  ))}
                  <div className="nested-add-row">
                    <PersonPicker value={pocForm.person_id} valueName={pocForm.person_name} onChange={(id, name) => updateNestedForm(pocKey, { person_id: id, person_name: name })} />
                    <button className="btn-small" onClick={() => addPOC(ce.id, ce.entities?.id)}>+ Add POC</button>
                  </div>
                </div>
              )}

              {(role === 'Plaintiff' || role === 'Co-Defendant') && (
                <div className="nested-block">
                  <span className="nested-label">Attorney(s):</span>
                  {attys.map((a) => (
                    <span key={a.id} className="chip chip-removable">
                      {a.people?.first_name} {a.people?.last_name}
                      <button onClick={() => removeCasePerson(a.id)}>×</button>
                    </span>
                  ))}
                  <div className="nested-add-row">
                    <PersonPicker value={attyForm.person_id} valueName={attyForm.person_name} onChange={(id, name) => updateNestedForm(attyKey, { person_id: id, person_name: name })} />
                    <button className="btn-small" onClick={() => addAttorney('entity', ce.id)}>+ Add Attorney</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {people.map((cp) => {
          const attyKey = nestedKey('atty-person', cp.id);
          const attyForm = nestedFormFor(attyKey);
          const attys = casePeople.filter((c) => c.role === 'Attorney' && c.represents_case_person_id === cp.id);

          return (
            <div key={cp.id} className="party-card">
              <div className="party-card-header">
                <a className="row-link" onClick={() => setModalPersonId(cp.person_id)}>{cp.people?.first_name} {cp.people?.last_name}</a>
                <span className="badge badge-gray">Person</span>
                <button className="btn-small btn-small-danger" onClick={() => removePersonParty(cp.id)}>Remove</button>
              </div>

              {(role === 'Plaintiff' || role === 'Co-Defendant') && (
                <div className="nested-block">
                  <span className="nested-label">Attorney(s):</span>
                  {attys.map((a) => (
                    <span key={a.id} className="chip chip-removable">
                      {a.people?.first_name} {a.people?.last_name}
                      <button onClick={() => removeCasePerson(a.id)}>×</button>
                    </span>
                  ))}
                  <div className="nested-add-row">
                    <PersonPicker value={attyForm.person_id} valueName={attyForm.person_name} onChange={(id, name) => updateNestedForm(attyKey, { person_id: id, person_name: name })} />
                    <button className="btn-small" onClick={() => addAttorney('person', cp.id)}>+ Add Attorney</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="add-party-form">
          <EntityPicker value={eForm.entity_id} valueName={eForm.entity_name} onChange={(id, name) => setAddEntityForm((s) => ({ ...s, [role]: { entity_id: id, entity_name: name } }))} />
          <button className="btn-small" onClick={() => addEntityParty(role)}>+ Add Entity</button>
          <PersonPicker value={pForm.person_id} valueName={pForm.person_name} onChange={(id, name) => setAddPersonForm((s) => ({ ...s, [role]: { person_id: id, person_name: name } }))} />
          <button className="btn-small" onClick={() => addPersonParty(role)}>+ Add Person</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'block' }}>
        <Link href="/" className="back-link">← All Matters</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>{matter.case_name}</h1>
          <button className="star-toggle" onClick={toggleStar} title="Star this matter">{matter.starred ? '★' : '☆'}</button>
        </div>
      </div>

      {/* INFO BAR */}
      <div className="info-bar">
        <span><strong>Our File:</strong> {fileNumbers || '—'}</span>
        <span><strong>Client File:</strong> {clientFileNumbers || '—'}</span>
        <span className="info-bar-link">📁 File Folder</span>
        <span className="info-bar-link">📓 OneNote</span>
        <span><strong>Answer Due:</strong> —</span>
      </div>

      {/* TAB ROW */}
      <div className="tab-row">
        {TABS.map((t, i) => (
          <span key={t} className={`tab-item ${i === 0 ? 'active' : 'disabled'}`}>{t}</span>
        ))}
      </div>

      {/* CASE OVERVIEW */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Case Overview</h3>
          {!editingCore && <button className="btn-small" onClick={() => setEditingCore(true)}>Edit</button>}
        </div>

        {!editingCore && (
          <>
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">Practice Group</span><span className="detail-value">{matter.practice_group || '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Case Status</span><span className="detail-value">{matter.case_status || '—'}</span></div>
              {matter.case_status === 'Appeal' && (
                <div className="detail-card"><span className="detail-label">Appellate Case Number</span><span className="detail-value">{matter.appellate_case_number || '—'}</span></div>
              )}
              <div className="detail-card"><span className="detail-label">Date Opened</span><span className="detail-value">{matter.date_opened ? new Date(matter.date_opened).toLocaleDateString() : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Court Case Number</span><span className="detail-value">{matter.court_case_number || '—'}</span></div>
            </div>
            <div className="chip-row" style={{ marginTop: '12px' }}>
              <span className="detail-label" style={{ marginRight: '8px' }}>ASSIGNED STAFF</span>
              {staff.length === 0 && <span className="muted">Nobody assigned yet.</span>}
              {staff.map((s) => (
                <span key={s.id} className="chip chip-removable">{s.staff_name}<button onClick={() => removeStaff(s.id)}>×</button></span>
              ))}
            </div>
            <div className="inline-add-row">
              <input type="text" placeholder="Staff name" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
              <button className="btn-small" onClick={addStaff}>+ Add</button>
            </div>
          </>
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
              <div className="form-field"><label>Appellate Case Number</label><input value={coreForm.appellate_case_number || ''} onChange={(e) => updateCore('appellate_case_number', e.target.value)} /></div>
            )}
            <div className="form-row">
              <div className="form-field"><label>Date Opened</label><input type="date" value={coreForm.date_opened || ''} onChange={(e) => updateCore('date_opened', e.target.value)} /></div>
              <div className="form-field"><label>Court Case Number</label><input value={coreForm.court_case_number || ''} onChange={(e) => updateCore('court_case_number', e.target.value)} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveCore} disabled={savingCore}>{savingCore ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => { setEditingCore(false); setCoreForm(matter); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* CLIENT INSURER */}
      <div className="section-card">
        <div className="section-card-header"><h3>Client Insurer</h3></div>
        <div className="form-field" style={{ maxWidth: '360px' }}>
          <EntityPicker
            value={matter.client_insurer_entity_id}
            valueName={clientInsurerName}
            onChange={async (id, name) => {
              await supabase.from('matters').update({ client_insurer_entity_id: id }).eq('id', matterId);
              load();
            }}
          />
        </div>

        <div style={{ marginTop: '12px' }}>
          {claimReps.length === 0 && <p className="muted">No claim reps added yet.</p>}
          {claimReps.map((cr) => (
            <div key={cr.id} className="party-row">
              <a className="row-link" href={cr.people?.email1 ? `mailto:${cr.people.email1}` : undefined}>
                {cr.people?.first_name} {cr.people?.last_name}
              </a>
              {cr.label && <span className="muted">{cr.label}</span>}
              {cr.claim_number && <span className="muted">Claim# {cr.claim_number}</span>}
              <button className="btn-small btn-small-danger" onClick={() => removeClaimRep(cr.id)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="add-party-form">
          <PersonPicker value={newClaimRep.person_id} valueName={newClaimRep.person_name} onChange={(id, name) => setNewClaimRep((f) => ({ ...f, person_id: id, person_name: name }))} />
          <input type="text" placeholder="Claim #" value={newClaimRep.claim_number} onChange={(e) => setNewClaimRep((f) => ({ ...f, claim_number: e.target.value }))} />
          <input type="text" placeholder="Label (e.g. Hancock)" value={newClaimRep.label} onChange={(e) => setNewClaimRep((f) => ({ ...f, label: e.target.value }))} />
          <button className="btn-small" onClick={addClaimRep}>+ Add Claim Rep</button>
        </div>
      </div>

      {/* COURT & JURISDICTION */}
      <div className="section-card">
        <div className="section-card-header"><h3>Court & Jurisdiction</h3></div>

        {[
          { label: 'Judge', role: 'Judge', rows: judgeRows, form: newJudge, setForm: setNewJudge },
          { label: 'Magistrate Judge', role: 'Magistrate Judge', rows: magJudgeRows, form: newMagJudge, setForm: setNewMagJudge },
          { label: 'Mediator', role: 'Mediator', rows: mediatorRows, form: newMediator, setForm: setNewMediator },
        ].map(({ label, role, rows, form, setForm }) => (
          <div key={role} className="nested-block" style={{ marginBottom: '14px' }}>
            <span className="nested-label">{label}:</span>
            {rows.length === 0 && <span className="muted">None yet.</span>}
            {rows.map((r) => (
              <span key={r.id} className="chip chip-removable">
                {r.people?.first_name} {r.people?.last_name}
                <button onClick={() => removeCasePerson(r.id)}>×</button>
              </span>
            ))}
            <div className="nested-add-row">
              <PersonPicker value={form.person_id} valueName={form.person_name} onChange={(id, name) => setForm({ person_id: id, person_name: name })} />
              <button className="btn-small" onClick={() => addCourtRole(role, form, setForm)}>+ Add</button>
            </div>
          </div>
        ))}
      </div>

      {/* PARTIES */}
      <div className="section-card">
        <div className="section-card-header"><h3>Parties</h3></div>
        {PARTY_ROLES.map((role) => renderPartyGroup(role))}
      </div>

      {modalPersonId && <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />}
      {modalEntityId && <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />}
    </div>
  );
}
