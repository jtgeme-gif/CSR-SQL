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

  // Case Identification — single Edit gate for everything except Case Status
  const [editingId, setEditingId] = useState(false);
  const [idForm, setIdForm] = useState(null);
  const [savingId, setSavingId] = useState(false);

  const [newStaffName, setNewStaffName] = useState('');
  const [newClaimRep, setNewClaimRep] = useState({ person_id: null, person_name: '', claim_number: '', label: '' });

  // Court & Jurisdiction
  const [editingCourt, setEditingCourt] = useState(false);
  const [courtForm, setCourtForm] = useState(null);
  const [savingCourt, setSavingCourt] = useState(false);
  const [newJudge, setNewJudge] = useState({ person_id: null, person_name: '' });
  const [newMagJudge, setNewMagJudge] = useState({ person_id: null, person_name: '' });
  const [newMediator, setNewMediator] = useState({ person_id: null, person_name: '' });

  const [addEntityForm, setAddEntityForm] = useState({});
  const [addPersonForm, setAddPersonForm] = useState({});
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
    setIdForm(m);
    setCourtForm(m);

    const { data: staffData } = await supabase.from('matter_staff').select('*').eq('matter_id', matterId).order('created_at');
    setStaff(staffData || []);

    const { data: ceData } = await supabase.from('case_entities').select('*, entities(id, name)').eq('matter_id', matterId);
    setCaseEntities(ceData || []);

    const { data: cpData } = await supabase.from('case_people').select('*, people(id, first_name, last_name, email1, website)').eq('matter_id', matterId);
    setCasePeople(cpData || []);

    const { data: crData } = await supabase.from('matter_claim_reps').select('*, people(first_name, last_name, email1, entities(name))').eq('matter_id', matterId).order('created_at');
    setClaimReps(crData || []);

    setLoading(false);
  }

  // ---------- Case Identification ----------
  function updateId(field, value) { setIdForm((f) => ({ ...f, [field]: value })); }

  async function saveIdentification() {
    setSavingId(true);
    const payload = {
      case_name: idForm.case_name?.trim() || matter.case_name,
      file_number: idForm.file_number?.trim() || null,
      practice_group: idForm.practice_group || null,
      date_opened: idForm.date_opened || null,
    };
    const { error } = await supabase.from('matters').update(payload).eq('id', matterId);
    setSavingId(false);
    if (error) { alert(error.message); return; }
    setEditingId(false);
    load();
  }

  // Case Status lives outside the Edit gate — changes save immediately.
  async function updateCaseStatusLive(newStatus) {
    const payload = { case_status: newStatus || null };
    if (newStatus !== 'Appeal') payload.appellate_case_number = null;
    const { error } = await supabase.from('matters').update(payload).eq('id', matterId);
    if (error) { alert(error.message); return; }
    load();
  }
  async function updateAppellateNumber(value) {
    await supabase.from('matters').update({ appellate_case_number: value || null }).eq('id', matterId);
  }

  async function toggleStar() {
    const { error } = await supabase.from('matters').update({ starred: !matter.starred }).eq('id', matterId);
    if (!error) load();
  }

  // ---------- Assigned staff (behind Case Identification Edit) ----------
  async function addStaff() {
    if (!newStaffName.trim()) return;
    await supabase.from('matter_staff').insert({ matter_id: matterId, staff_name: newStaffName.trim() });
    setNewStaffName('');
    load();
  }
  async function removeStaff(id) { await supabase.from('matter_staff').delete().eq('id', id); load(); }

  // ---------- Client Insurer / Claim reps (behind Case Identification Edit) ----------
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
  function updateCourt(field, value) { setCourtForm((f) => ({ ...f, [field]: value })); }

  async function saveCourtJurisdiction() {
    setSavingCourt(true);
    const payload = {
      court_case_number: courtForm.court_case_number?.trim() || null,
      court_level: courtForm.court_level?.trim() || null,
      court_jurisdiction: courtForm.court_jurisdiction?.trim() || null,
      circuit_county_division: courtForm.circuit_county_division?.trim() || null,
      date_filed: courtForm.date_filed || null,
      date_client_served: courtForm.date_client_served || null,
    };
    const { error } = await supabase.from('matters').update(payload).eq('id', matterId);
    setSavingCourt(false);
    if (error) { alert(error.message); return; }
    setEditingCourt(false);
    load();
  }
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

  function partiesForRole(role) {
    return { entities: caseEntities.filter((ce) => ce.role === role), people: casePeople.filter((cp) => cp.role === role) };
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
                    <span key={p.id} className="chip chip-removable">{p.people?.first_name} {p.people?.last_name}<button onClick={() => removeCasePerson(p.id)}>×</button></span>
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
                    <span key={a.id} className="chip chip-removable">{a.people?.first_name} {a.people?.last_name}<button onClick={() => removeCasePerson(a.id)}>×</button></span>
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
                    <span key={a.id} className="chip chip-removable">{a.people?.first_name} {a.people?.last_name}<button onClick={() => removeCasePerson(a.id)}>×</button></span>
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
    <div>
      <div className="matter-sticky-top">
        <div className="matter-title-row">
          <Link href="/" className="back-link">← All Matters</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>{matter.case_name}</h1>
            <button className="star-toggle" onClick={toggleStar} title="Star this matter">{matter.starred ? '★' : '☆'}</button>
          </div>
        </div>

        {/* INFO BAR */}
        <div className="info-bar">
          <span><strong>Our File:</strong> {matter.file_number || '—'}</span>
          <span><strong>Client File:</strong> {caseEntities.filter((ce) => ce.claim_rep_file_number).map((ce) => `${ce.entities?.name}: ${ce.claim_rep_file_number}`).join(' // ') || '—'}</span>
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
      </div>

      <div className="page">
      {/* CASE IDENTIFICATION */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Case Identification</h3>
          {!editingId && <button className="btn-small" onClick={() => setEditingId(true)}>Edit</button>}
        </div>

        {!editingId && (
          <>
            <div className="detail-grid">
              <div className="detail-card"><span className="detail-label">Case Name</span><span className="detail-value">{matter.case_name}</span></div>
              <div className="detail-card"><span className="detail-label">File Number</span><span className="detail-value">{matter.file_number || '—'}</span></div>
              <div className="detail-card">
                <span className="detail-label">Client Rep(s)</span>
                <span className="detail-value">
                  {claimReps.length === 0 ? '—' : claimReps.map((cr) => (
                    <a key={cr.id} className="row-link" style={{ display: 'block' }} href={cr.people?.email1 ? `mailto:${cr.people.email1}` : undefined}>
                      {cr.people?.entities?.name ? `${cr.people.entities.name} — ` : ''}{cr.people?.first_name} {cr.people?.last_name}{cr.label ? ` — ${cr.label}` : ''}{cr.claim_number ? ` — Claim# ${cr.claim_number}` : ''}
                    </a>
                  ))}
                </span>
              </div>
              <div className="detail-card"><span className="detail-label">Date Opened</span><span className="detail-value">{matter.date_opened ? new Date(matter.date_opened).toLocaleDateString() : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Practice Group</span><span className="detail-value">{matter.practice_group || '—'}</span></div>
              <div className="detail-card">
                <span className="detail-label">Assigned Staff</span>
                <span className="detail-value">{staff.length === 0 ? '—' : staff.map((s) => s.staff_name).join(', ')}</span>
              </div>
            </div>

            {/* Case Status — the one field editable without hitting Edit */}
            <div className="form-field" style={{ maxWidth: '280px', marginTop: '14px' }}>
              <label>Case Status</label>
              <select value={matter.case_status || ''} onChange={(e) => updateCaseStatusLive(e.target.value)}>
                <option value="">Select…</option>
                {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {matter.case_status === 'Appeal' && (
              <div className="form-field" style={{ maxWidth: '280px' }}>
                <label>Appellate Case Number</label>
                <input defaultValue={matter.appellate_case_number || ''} onBlur={(e) => updateAppellateNumber(e.target.value)} />
              </div>
            )}
          </>
        )}

        {editingId && idForm && (
          <div>
            <div className="form-row">
              <div className="form-field"><label>Case Name</label><input value={idForm.case_name || ''} onChange={(e) => updateId('case_name', e.target.value)} /></div>
              <div className="form-field"><label>File Number</label><input value={idForm.file_number || ''} onChange={(e) => updateId('file_number', e.target.value)} placeholder="e.g. 1979.1807 // 1979.1810" /></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label>Date Opened</label><input type="date" value={idForm.date_opened || ''} onChange={(e) => updateId('date_opened', e.target.value)} /></div>
              <div className="form-field">
                <label>Practice Group</label>
                <select value={idForm.practice_group || ''} onChange={(e) => updateId('practice_group', e.target.value)}>
                  <option value="">Select…</option>
                  {PRACTICE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Assigned Staff</label>
              <div className="chip-row">
                {staff.length === 0 && <span className="muted">Nobody assigned yet.</span>}
                {staff.map((s) => <span key={s.id} className="chip chip-removable">{s.staff_name}<button onClick={() => removeStaff(s.id)}>×</button></span>)}
              </div>
              <div className="inline-add-row">
                <input type="text" placeholder="Staff name" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                <button className="btn-small" onClick={addStaff}>+ Add</button>
              </div>
            </div>

            <div className="form-field">
              <label>Client Rep(s)</label>
              {claimReps.length === 0 && <p className="muted" style={{ margin: '4px 0' }}>None yet.</p>}
              {claimReps.map((cr) => (
                <div key={cr.id} className="party-row">
                  <span>{cr.people?.entities?.name ? `${cr.people.entities.name} — ` : ''}{cr.people?.first_name} {cr.people?.last_name}</span>
                  {cr.label && <span className="muted">{cr.label}</span>}
                  {cr.claim_number && <span className="muted">Claim# {cr.claim_number}</span>}
                  <button className="btn-small btn-small-danger" onClick={() => removeClaimRep(cr.id)}>Remove</button>
                </div>
              ))}
              <div className="add-party-form">
                <PersonPicker value={newClaimRep.person_id} valueName={newClaimRep.person_name} onChange={(id, name) => setNewClaimRep((f) => ({ ...f, person_id: id, person_name: name }))} />
                <input type="text" placeholder="Claim #" value={newClaimRep.claim_number} onChange={(e) => setNewClaimRep((f) => ({ ...f, claim_number: e.target.value }))} />
                <input type="text" placeholder="Label (e.g. Hancock)" value={newClaimRep.label} onChange={(e) => setNewClaimRep((f) => ({ ...f, label: e.target.value }))} />
                <button className="btn-small" onClick={addClaimRep}>+ Add Claim Rep</button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveIdentification} disabled={savingId}>{savingId ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => { setEditingId(false); setIdForm(matter); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* COURT & JURISDICTION */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Court & Jurisdiction</h3>
          {!editingCourt && <button className="btn-small" onClick={() => setEditingCourt(true)}>Edit</button>}
        </div>

        {!editingCourt && (
          <div className="detail-grid" style={{ marginBottom: '14px' }}>
            <div className="detail-card"><span className="detail-label">Court Level</span><span className="detail-value">{matter.court_level || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Court Jurisdiction</span><span className="detail-value">{matter.court_jurisdiction || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Circuit/County/Division</span><span className="detail-value">{matter.circuit_county_division || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Case Number</span><span className="detail-value">{matter.court_case_number || '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Date Filed</span><span className="detail-value">{matter.date_filed ? new Date(matter.date_filed).toLocaleDateString() : '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Date Client Served</span><span className="detail-value">{matter.date_client_served ? new Date(matter.date_client_served).toLocaleDateString() : '—'}</span></div>
          </div>
        )}
        {editingCourt && courtForm && (
          <div style={{ marginBottom: '14px' }}>
            <div className="form-row">
              <div className="form-field">
                <label>Court Level</label>
                <input value={courtForm.court_level || ''} onChange={(e) => updateCourt('court_level', e.target.value)} placeholder="e.g. Circuit Court, Federal District" />
              </div>
              <div className="form-field">
                <label>Court Jurisdiction</label>
                <input value={courtForm.court_jurisdiction || ''} onChange={(e) => updateCourt('court_jurisdiction', e.target.value)} placeholder="e.g. Wayne County, Eastern District of Michigan" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Circuit/County/Division</label>
                <input value={courtForm.circuit_county_division || ''} onChange={(e) => updateCourt('circuit_county_division', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Case Number</label>
                <input value={courtForm.court_case_number || ''} onChange={(e) => updateCourt('court_case_number', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Date Filed</label>
                <input type="date" value={courtForm.date_filed || ''} onChange={(e) => updateCourt('date_filed', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Date Client Served</label>
                <input type="date" value={courtForm.date_client_served || ''} onChange={(e) => updateCourt('date_client_served', e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveCourtJurisdiction} disabled={savingCourt}>{savingCourt ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => { setEditingCourt(false); setCourtForm(matter); }}>Cancel</button>
            </div>
          </div>
        )}

        {!editingCourt && (
          <div className="detail-grid">
            {[
              { label: 'Judge', rows: judgeRows },
              { label: 'Magistrate Judge', rows: magJudgeRows },
              { label: 'Mediator', rows: mediatorRows },
            ].map(({ label, rows }) => (
              <div className="detail-card" key={label}>
                <span className="detail-label">{label}</span>
                <span className="detail-value">
                  {rows.length === 0 ? '—' : rows.map((r, i) => (
                    <span key={r.id}>
                      {r.people?.website ? (
                        <a className="row-link" href={r.people.website} target="_blank" rel="noopener noreferrer">{r.people?.first_name} {r.people?.last_name}</a>
                      ) : (
                        <span>{r.people?.first_name} {r.people?.last_name}</span>
                      )}
                      {i < rows.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}

        {editingCourt && (
          <div className="form-row">
            {[
              { label: 'Judge', role: 'Judge', rows: judgeRows, form: newJudge, setForm: setNewJudge },
              { label: 'Magistrate Judge', role: 'Magistrate Judge', rows: magJudgeRows, form: newMagJudge, setForm: setNewMagJudge },
              { label: 'Mediator', role: 'Mediator', rows: mediatorRows, form: newMediator, setForm: setNewMediator },
            ].map(({ label, role, rows, form, setForm }) => (
              <div key={role} className="nested-block form-field">
                <span className="nested-label">{label}:</span>
                {rows.length === 0 && <span className="muted">None yet.</span>}
                {rows.map((r) => (
                  <span key={r.id} className="chip chip-removable">{r.people?.first_name} {r.people?.last_name}<button onClick={() => removeCasePerson(r.id)}>×</button></span>
                ))}
                <div className="nested-add-row">
                  <PersonPicker value={form.person_id} valueName={form.person_name} onChange={(id, name) => setForm({ person_id: id, person_name: name })} />
                  <button className="btn-small" onClick={() => addCourtRole(role, form, setForm)}>+ Add</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PARTIES */}
      <div className="section-card">
        <div className="section-card-header"><h3>Parties</h3></div>
        {PARTY_ROLES.map((role) => renderPartyGroup(role))}
      </div>

      {modalPersonId && <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />}
      {modalEntityId && <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />}
      </div>
    </div>
  );
}
