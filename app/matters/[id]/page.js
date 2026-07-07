'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { formatPhoneDisplay } from '../../../lib/formatPhone';
import { formatDateSafe } from '../../../lib/formatDate';
import EntityPicker from '../../../components/EntityPicker';
import PersonPicker from '../../../components/PersonPicker';
import StaffPicker from '../../../components/StaffPicker';
import PersonModal from '../../../components/PersonModal';
import EntityModal from '../../../components/EntityModal';
import SchedulingTab from '../../../components/SchedulingTab';
import WitnessesTab from '../../../components/WitnessesTab';
import MediationTab from '../../../components/MediationTab';

const PRACTICE_GROUPS = ['Auto-Neg', 'Business', 'Police', 'Labor-Employment', 'Municipal', 'Zoning', 'School'];
const CASE_STATUSES = ['Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'];
const PARTY_ROLES = ['Plaintiff', 'Defendant', 'Co-Defendant'];
const TABS = ['Overview', 'Case', 'Scheduling', 'Witnesses', 'Mediation / Settlement', 'Notes', 'Tasks', 'CSR', 'Subpoenas'];

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id;

  const [matter, setMatter] = useState(null);
  const [staff, setStaff] = useState([]);
  const [caseEntities, setCaseEntities] = useState([]);
  const [casePeople, setCasePeople] = useState([]);
  const [claimReps, setClaimReps] = useState([]);
  const [keyDeadlines, setKeyDeadlines] = useState([]);
  const [starredItems, setStarredItems] = useState([]);

  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Case Identification — single Edit gate for everything except Case Status
  const [editingId, setEditingId] = useState(false);
  const [idForm, setIdForm] = useState(null);
  const [savingId, setSavingId] = useState(false);

  const [newStaffPick, setNewStaffPick] = useState({ staff_id: null, staff_name: '' });
  const [newClaimRep, setNewClaimRep] = useState({ person_id: null, person_name: '', claim_number: '', label: '' });

  // Court & Jurisdiction
  const [editingCourt, setEditingCourt] = useState(false);
  const [courtForm, setCourtForm] = useState(null);
  const [savingCourt, setSavingCourt] = useState(false);
  const [newJudge, setNewJudge] = useState({ person_id: null, person_name: '' });
  const [newMagJudge, setNewMagJudge] = useState({ person_id: null, person_name: '' });
  const [newMediator, setNewMediator] = useState({ person_id: null, person_name: '' });

  const [partyModalRole, setPartyModalRole] = useState(null);
  const [partyModalForm, setPartyModalForm] = useState({ partyType: 'Person', person_id: null, person_name: '', entity_id: null, entity_name: '', attorney_id: null, attorney_name: '', capacity: '', pro_se: false });
  const [savingParty, setSavingParty] = useState(false);
  const [nestedAddForm, setNestedAddForm] = useState({});
  const [openPopover, setOpenPopover] = useState(null);
  const [editingCapacityFor, setEditingCapacityFor] = useState(null);
  const [capacityDraft, setCapacityDraft] = useState('');

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

    const { data: staffData } = await supabase.from('matter_staff').select('*, staff(id, first_name, last_name)').eq('matter_id', matterId).order('created_at');
    setStaff(staffData || []);

    const { data: ceData } = await supabase.from('case_entities').select('*, entities(id, name)').eq('matter_id', matterId);
    setCaseEntities(ceData || []);

    const { data: cpData } = await supabase.from('case_people').select('*, people(id, first_name, last_name, email1, phone1, address, city, state, zip, website)').eq('matter_id', matterId);
    setCasePeople(cpData || []);

    const { data: crData } = await supabase.from('matter_claim_reps').select('*, people(first_name, last_name, email1, entities(name))').eq('matter_id', matterId).order('created_at');
    setClaimReps(crData || []);

    const { data: kdData } = await supabase.from('events').select('*, event_types(label)').eq('matter_id', matterId).eq('pin_to_overview', true).order('event_date');
    setKeyDeadlines(kdData || []);

    const { data: starData } = await supabase.from('events').select('*, event_types(label)').eq('matter_id', matterId).eq('star_to_infobar', true).order('event_date').limit(3);
    setStarredItems(starData || []);

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
  function staffDisplayName(s) {
    if (s.staff) return `${s.staff.first_name || ''} ${s.staff.last_name || ''}`.trim();
    return s.staff_name || 'Unknown';
  }

  async function addStaff() {
    if (!newStaffPick.staff_id) { alert('Pick a staff member first.'); return; }
    const { error } = await supabase.from('matter_staff').insert({ matter_id: matterId, staff_id: newStaffPick.staff_id });
    if (error) { alert(error.message); return; }
    setNewStaffPick({ staff_id: null, staff_name: '' });
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
  function openAddParty(role) {
    setPartyModalForm({ partyType: 'Person', person_id: null, person_name: '', entity_id: null, entity_name: '', attorney_id: null, attorney_name: '', capacity: '', pro_se: false });
    setPartyModalRole(role);
  }

  async function saveNewParty() {
    const f = partyModalForm;
    const role = partyModalRole;
    if (f.partyType === 'Person' && !f.person_id) { alert('Pick or create a person first.'); return; }
    if (f.partyType === 'Entity' && !f.entity_id) { alert('Pick or create an entity first.'); return; }

    setSavingParty(true);
    let newPartyId = null;

    if (f.partyType === 'Person') {
      const { data, error } = await supabase.from('case_people').insert({ matter_id: matterId, person_id: f.person_id, role, capacity: f.capacity?.trim() || null, pro_se: role !== 'Defendant' ? !!f.pro_se : false }).select('id').single();
      if (error) { alert(error.message); setSavingParty(false); return; }
      newPartyId = data.id;
    } else {
      const { data, error } = await supabase.from('case_entities').insert({ matter_id: matterId, entity_id: f.entity_id, role }).select('id').single();
      if (error) { alert(error.message); setSavingParty(false); return; }
      newPartyId = data.id;
    }

    if (role !== 'Defendant' && !f.pro_se && f.attorney_id) {
      const attyPayload = { matter_id: matterId, person_id: f.attorney_id, role: 'Attorney' };
      if (f.partyType === 'Person') attyPayload.represents_case_person_id = newPartyId;
      else attyPayload.represents_case_entity_id = newPartyId;
      const { error: attyError } = await supabase.from('case_people').insert(attyPayload);
      if (attyError) { alert('Party added, but attaching the attorney failed: ' + attyError.message); }
    }

    setSavingParty(false);
    setPartyModalRole(null);
    load();
  }
  async function removeEntityParty(id) { await supabase.from('case_entities').delete().eq('id', id); load(); }
  async function removePersonParty(id) { await supabase.from('case_people').delete().eq('id', id); load(); }

  function nestedKey(kind, id) { return `${kind}-${id}`; }
  function nestedFormFor(key) { return nestedAddForm[key] || { person_id: null, person_name: '' }; }
  function updateNestedForm(key, val) { setNestedAddForm((s) => ({ ...s, [key]: val })); }
  function togglePopover(key) { setOpenPopover((cur) => (cur === key ? null : key)); }

  async function addPOC(caseEntityId, entityGlobalId) {
    const key = nestedKey('poc', caseEntityId);
    const f = nestedFormFor(key);
    if (!f.person_id) { alert('Pick or create a person first.'); return; }
    const { error } = await supabase.from('case_people').insert({
      matter_id: matterId, person_id: f.person_id, role: 'POC', poc_entity_id: entityGlobalId,
    });
    if (error) { alert(error.message); return; }
    updateNestedForm(key, { person_id: null, person_name: '' });
    setOpenPopover(null);
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
    setOpenPopover(null);
    load();
  }

  async function togglePartyProSe(cp) {
    const { error } = await supabase.from('case_people').update({ pro_se: !cp.pro_se }).eq('id', cp.id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function saveCapacity(cpId) {
    const { error } = await supabase.from('case_people').update({ capacity: capacityDraft.trim() || null }).eq('id', cpId);
    if (error) { alert(error.message); return; }
    setEditingCapacityFor(null);
    load();
  }

  function mailtoHref(email) {
    if (!email) return null;
    return `mailto:${email}?subject=${encodeURIComponent(matter?.case_name || '')}`;
  }

  function renderPersonChip(cp, onRemove) {
    const name = `${cp.people?.first_name || ''} ${cp.people?.last_name || ''}`.trim();
    const href = mailtoHref(cp.people?.email1);
    const phone = formatPhoneDisplay(cp.people?.phone1);
    return (
      <span key={cp.id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
        <span className="chip chip-removable">
          {href ? <a href={href}>{name}</a> : <span>{name}</span>}
          <button onClick={onRemove}>×</button>
        </span>
        {phone && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{phone}</span>}
      </span>
    );
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

    return (
      <div className="party-group" key={role}>
        <div className="party-group-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{role}s</span>
          <button className="btn-small" onClick={() => openAddParty(role)}>+ Add {role}</button>
        </div>
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
                  {pocs.map((p) => renderPersonChip(p, () => removeCasePerson(p.id)))}
                  <span style={{ position: 'relative' }}>
                    <button className="btn-small" onClick={() => togglePopover(pocKey)}>+ Add POC</button>
                    {openPopover === pocKey && (
                      <div className="popover">
                        <PersonPicker value={pocForm.person_id} valueName={pocForm.person_name} onChange={(id, name) => updateNestedForm(pocKey, { person_id: id, person_name: name })} />
                        <div className="modal-actions" style={{ marginTop: '8px' }}>
                          <button className="btn-small btn-primary" onClick={() => addPOC(ce.id, ce.entities?.id)}>Add</button>
                          <button className="btn-small" onClick={() => setOpenPopover(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </span>
                </div>
              )}

              {(role === 'Plaintiff' || role === 'Co-Defendant') && (
                <div className="nested-block">
                  <span className="nested-label">Attorney(s):</span>
                  {attys.map((a) => renderPersonChip(a, () => removeCasePerson(a.id)))}
                  <span style={{ position: 'relative' }}>
                    <button className="btn-small" onClick={() => togglePopover(attyKey)}>+ Add Attorney</button>
                    {openPopover === attyKey && (
                      <div className="popover">
                        <PersonPicker value={attyForm.person_id} valueName={attyForm.person_name} onChange={(id, name) => updateNestedForm(attyKey, { person_id: id, person_name: name })} />
                        <div className="modal-actions" style={{ marginTop: '8px' }}>
                          <button className="btn-small btn-primary" onClick={() => addAttorney('entity', ce.id)}>Add</button>
                          <button className="btn-small" onClick={() => setOpenPopover(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {people.map((cp) => {
          const attyKey = nestedKey('atty-person', cp.id);
          const attyForm = nestedFormFor(attyKey);
          const attys = casePeople.filter((c) => c.role === 'Attorney' && c.represents_case_person_id === cp.id);
          const displayName = `${cp.people?.first_name || ''} ${cp.people?.last_name || ''}`.trim() + (cp.capacity ? ` ${cp.capacity}` : '') + (cp.pro_se ? ' — Pro Se' : '');
          const partyContactAddress = [cp.people?.address, cp.people?.city, cp.people?.state, cp.people?.zip].filter(Boolean).join(', ');

          return (
            <div key={cp.id} className="party-card">
              <div className="party-card-header">
                <a className="row-link" onClick={() => setModalPersonId(cp.person_id)}>{displayName}</a>
                <span className="badge badge-gray">Person</span>
                <button className="btn-small btn-small-danger" onClick={() => removePersonParty(cp.id)}>Remove</button>
              </div>

              {editingCapacityFor === cp.id ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                  <input
                    style={{ flex: 1, maxWidth: '280px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }}
                    placeholder="Add capacity text"
                    value={capacityDraft}
                    onChange={(e) => setCapacityDraft(e.target.value)}
                  />
                  <button className="btn-small btn-primary" onClick={() => saveCapacity(cp.id)}>Save</button>
                  <button className="btn-small" onClick={() => setEditingCapacityFor(null)}>Cancel</button>
                </div>
              ) : (
                <div
                  className="muted"
                  style={{ fontSize: '11px', marginTop: '2px', cursor: 'pointer' }}
                  onClick={() => { setEditingCapacityFor(cp.id); setCapacityDraft(cp.capacity || ''); }}
                >
                  {'Edit / Add Capacity'}
                </div>
              )}

              {role === 'Defendant' && (
                <div className="nested-block">
                  <span className="nested-label">Contact:</span>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {cp.people?.email1 && <a href={mailtoHref(cp.people.email1)}>{cp.people.email1}</a>}
                    {cp.people?.phone1 && <span>{formatPhoneDisplay(cp.people.phone1)}</span>}
                    {!cp.people?.email1 && !cp.people?.phone1 && <span className="muted">No contact info on file.</span>}
                  </div>
                </div>
              )}

              {(role === 'Plaintiff' || role === 'Co-Defendant') && (
                <div className="form-checkbox" style={{ marginTop: '4px', marginBottom: 0 }}>
                  <input type="checkbox" id={`prose-${cp.id}`} checked={!!cp.pro_se} onChange={() => togglePartyProSe(cp)} />
                  <label htmlFor={`prose-${cp.id}`} style={{ fontSize: '11px' }}>Pro Se (no attorney)</label>
                </div>
              )}

              {(role === 'Plaintiff' || role === 'Co-Defendant') && (
                cp.pro_se ? (
                  <div className="nested-block">
                    <span className="nested-label">Contact:</span>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {cp.people?.email1 && <a href={mailtoHref(cp.people.email1)}>{cp.people.email1}</a>}
                      {cp.people?.phone1 && <span>{formatPhoneDisplay(cp.people.phone1)}</span>}
                      {partyContactAddress && <span>{partyContactAddress}</span>}
                      {!cp.people?.email1 && !cp.people?.phone1 && !partyContactAddress && <span className="muted">No contact info on file.</span>}
                    </div>
                  </div>
                ) : (
                  <div className="nested-block">
                    <span className="nested-label">Attorney(s):</span>
                    {attys.map((a) => renderPersonChip(a, () => removeCasePerson(a.id)))}
                    <span style={{ position: 'relative' }}>
                      <button className="btn-small" onClick={() => togglePopover(attyKey)}>+ Add Attorney</button>
                      {openPopover === attyKey && (
                        <div className="popover">
                          <PersonPicker value={attyForm.person_id} valueName={attyForm.person_name} onChange={(id, name) => updateNestedForm(attyKey, { person_id: id, person_name: name })} />
                          <div className="modal-actions" style={{ marginTop: '8px' }}>
                            <button className="btn-small btn-primary" onClick={() => addAttorney('person', cp.id)}>Add</button>
                            <button className="btn-small" onClick={() => setOpenPopover(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          );
        })}

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
          {starredItems.length === 0 && <span className="muted">No starred dates yet</span>}
          {starredItems.map((ev) => (
            <span key={ev.id}>
              ★ {ev.description || 'Date'} {ev.event_date ? formatDateSafe(ev.event_date) : '—'}
            </span>
          ))}
        </div>

        {/* TAB ROW */}
        <div className="tab-row">
          {TABS.map((t) => {
            const clickable = t === 'Overview' || t === 'Scheduling' || t === 'Mediation / Settlement' || t === 'Witnesses';
            return (
              <span
                key={t}
                className={`tab-item ${t === activeTab ? 'active' : clickable ? '' : 'disabled'}`}
                style={clickable ? { cursor: 'pointer' } : undefined}
                onClick={() => { if (clickable) setActiveTab(t); }}
              >
                {t}
              </span>
            );
          })}
        </div>
      </div>

      <div className="page">
      {activeTab === 'Overview' && (
      <>
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
              <div className="detail-card"><span className="detail-label">Date Opened</span><span className="detail-value">{matter.date_opened ? formatDateSafe(matter.date_opened) : '—'}</span></div>
              <div className="detail-card"><span className="detail-label">Practice Group</span><span className="detail-value">{matter.practice_group || '—'}</span></div>
              <div className="detail-card">
                <span className="detail-label">Assigned Staff</span>
                <span className="detail-value">{staff.length === 0 ? '—' : staff.map(staffDisplayName).join(', ')}</span>
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
                {staff.map((s) => <span key={s.id} className="chip chip-removable">{staffDisplayName(s)}<button onClick={() => removeStaff(s.id)}>×</button></span>)}
              </div>
              <div className="inline-add-row">
                <StaffPicker
                  value={newStaffPick.staff_id}
                  valueName={newStaffPick.staff_name}
                  onChange={(id, name) => setNewStaffPick({ staff_id: id, staff_name: name })}
                />
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

      {/* KEY DEADLINES */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Key Deadlines</h3>
        </div>
        {keyDeadlines.length === 0 && (
          <p className="muted">No dates pinned yet. Pin a date from the Events/Scheduling tab to have it show here.</p>
        )}
        {keyDeadlines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {keyDeadlines.map((ev) => (
              <div key={ev.id} className="party-row">
                <span>📌</span>
                <span className="badge badge-red">
                  {ev.event_date ? formatDateSafe(ev.event_date) : '—'}
                </span>
                <span style={{ fontWeight: 600 }}>{ev.description || 'Untitled'}</span>
              </div>
            ))}
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
            <div className="detail-card"><span className="detail-label">Date Filed</span><span className="detail-value">{matter.date_filed ? formatDateSafe(matter.date_filed) : '—'}</span></div>
            <div className="detail-card"><span className="detail-label">Date Client Served</span><span className="detail-value">{matter.date_client_served ? formatDateSafe(matter.date_client_served) : '—'}</span></div>
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
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
      </>
      )}

      {activeTab === 'Scheduling' && (
        <SchedulingTab matterId={matterId} onChanged={load} />
      )}

      {activeTab === 'Mediation / Settlement' && (
        <MediationTab matterId={matterId} />
      )}

      {activeTab === 'Witnesses' && (
        <WitnessesTab matterId={matterId} />
      )}

      {modalPersonId && <PersonModal personId={modalPersonId} onClose={() => setModalPersonId(null)} onChanged={load} />}
      {modalEntityId && <EntityModal entityId={modalEntityId} onClose={() => setModalEntityId(null)} onChanged={load} />}

      {partyModalRole && (
        <div className="modal-overlay" onClick={() => setPartyModalRole(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Add {partyModalRole}</h2>
              <button className="modal-close" onClick={() => setPartyModalRole(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Party Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn-small ${partyModalForm.partyType === 'Person' ? 'btn-primary' : ''}`}
                    onClick={() => setPartyModalForm((f) => ({ ...f, partyType: 'Person' }))}
                  >
                    Person
                  </button>
                  <button
                    className={`btn-small ${partyModalForm.partyType === 'Entity' ? 'btn-primary' : ''}`}
                    onClick={() => setPartyModalForm((f) => ({ ...f, partyType: 'Entity' }))}
                  >
                    Entity
                  </button>
                </div>
              </div>

              {partyModalForm.partyType === 'Person' ? (
                <>
                  <div className="form-field">
                    <label>{partyModalRole}</label>
                    <PersonPicker
                      value={partyModalForm.person_id}
                      valueName={partyModalForm.person_name}
                      onChange={(id, name) => setPartyModalForm((f) => ({ ...f, person_id: id, person_name: name }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Capacity (optional)</label>
                    <input
                      value={partyModalForm.capacity}
                      onChange={(e) => setPartyModalForm((f) => ({ ...f, capacity: e.target.value }))}
                      placeholder="Add capacity text"
                    />
                  </div>
                  {partyModalRole !== 'Defendant' && (
                    <div className="form-checkbox">
                      <input
                        type="checkbox"
                        id="party-pro-se"
                        checked={!!partyModalForm.pro_se}
                        onChange={(e) => setPartyModalForm((f) => ({ ...f, pro_se: e.target.checked }))}
                      />
                      <label htmlFor="party-pro-se">Pro Se (no attorney)</label>
                    </div>
                  )}
                </>
              ) : (
                <div className="form-field">
                  <label>{partyModalRole}</label>
                  <EntityPicker
                    value={partyModalForm.entity_id}
                    valueName={partyModalForm.entity_name}
                    onChange={(id, name) => setPartyModalForm((f) => ({ ...f, entity_id: id, entity_name: name }))}
                  />
                </div>
              )}

              {partyModalRole !== 'Defendant' && !partyModalForm.pro_se && (
                <div className="form-field">
                  <label>Attorney (optional)</label>
                  <PersonPicker
                    value={partyModalForm.attorney_id}
                    valueName={partyModalForm.attorney_name}
                    onChange={(id, name) => setPartyModalForm((f) => ({ ...f, attorney_id: id, attorney_name: name }))}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveNewParty} disabled={savingParty}>
                  {savingParty ? 'Saving…' : `Add ${partyModalRole}`}
                </button>
                <button className="btn" onClick={() => setPartyModalRole(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
