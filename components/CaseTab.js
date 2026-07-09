'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateSafe } from '../lib/formatDate';

// Lightweight markdown: only **bold** and [text](url) links, nothing else.
// No toolbar, no library — just typed syntax, rendered on the read-only view.
function renderSimpleMarkdown(text) {
  if (!text) return null;
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>;
    return <span key={i}>{part}</span>;
  });
}

export default function CaseTab({ matterId }) {
  const [loading, setLoading] = useState(true);
  const [matter, setMatter] = useState(null);
  const [editingCase, setEditingCase] = useState(false);
  const [caseForm, setCaseForm] = useState({ incident_date: '', factual_allegations: '', defense_theory_notes: '' });
  const [savingCase, setSavingCase] = useState(false);

  const [counts, setCounts] = useState([]);
  const [defendants, setDefendants] = useState([]); // combined person + entity Defendant/Co-Defendant parties
  const [countModalOpen, setCountModalOpen] = useState(false);
  const [editingCountId, setEditingCountId] = useState(null);
  const [countForm, setCountForm] = useState({ count_number: '', description: '', defendant_ids: [] });
  const [savingCount, setSavingCount] = useState(false);

  const [editingDismissFor, setEditingDismissFor] = useState(null);
  const [dismissDraft, setDismissDraft] = useState({ dismissed: false, dismissed_date: '', dismissal_notes: '' });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    setLoading(true);

    const { data: matterData } = await supabase
      .from('matters')
      .select('incident_date, factual_allegations, defense_theory_notes')
      .eq('id', matterId)
      .single();
    setMatter(matterData);

    const { data: countsData } = await supabase
      .from('case_counts')
      .select('*, count_defendants(id, person_id, entity_id, people(first_name, last_name), entities(name))')
      .eq('matter_id', matterId)
      .order('count_number');
    setCounts(countsData || []);

    const { data: cpData } = await supabase
      .from('case_people')
      .select('id, person_id, dismissed, role, people(first_name, last_name)')
      .eq('matter_id', matterId)
      .in('role', ['Defendant', 'Co-Defendant']);

    const { data: ceData } = await supabase
      .from('case_entities')
      .select('id, entity_id, dismissed, role, entities(name)')
      .eq('matter_id', matterId)
      .in('role', ['Defendant', 'Co-Defendant']);

    const combined = [
      ...(cpData || []).map((p) => ({ type: 'person', id: p.person_id, name: `${p.people?.first_name || ''} ${p.people?.last_name || ''}`.trim(), dismissed: p.dismissed })),
      ...(ceData || []).map((e) => ({ type: 'entity', id: e.entity_id, name: e.entities?.name, dismissed: e.dismissed })),
    ];
    setDefendants(combined);

    setLoading(false);
  }

  // ---------- Case narrative fields ----------
  function openEditCase() {
    setCaseForm({
      incident_date: matter?.incident_date || '',
      factual_allegations: matter?.factual_allegations || '',
      defense_theory_notes: matter?.defense_theory_notes || '',
    });
    setEditingCase(true);
  }

  async function saveCase() {
    setSavingCase(true);
    const { error } = await supabase.from('matters').update({
      incident_date: caseForm.incident_date || null,
      factual_allegations: caseForm.factual_allegations?.trim() || null,
      defense_theory_notes: caseForm.defense_theory_notes?.trim() || null,
    }).eq('id', matterId);
    setSavingCase(false);
    if (error) { alert(error.message); return; }
    setEditingCase(false);
    load();
  }

  // ---------- Counts ----------
  function openAddCount() {
    const nextNumber = counts.length > 0 ? Math.max(...counts.map((c) => c.count_number || 0)) + 1 : 1;
    setEditingCountId(null);
    setCountForm({ count_number: nextNumber, description: '', defendant_ids: [] });
    setCountModalOpen(true);
  }

  function openEditCount(count) {
    setEditingCountId(count.id);
    setCountForm({
      count_number: count.count_number || '',
      description: count.description || '',
      defendant_ids: (count.count_defendants || []).map((cd) => cd.person_id || cd.entity_id),
    });
    setCountModalOpen(true);
  }

  function toggleDefendantInForm(defId) {
    setCountForm((f) => ({
      ...f,
      defendant_ids: f.defendant_ids.includes(defId)
        ? f.defendant_ids.filter((id) => id !== defId)
        : [...f.defendant_ids, defId],
    }));
  }

  async function saveCount() {
    if (!countForm.description.trim()) { alert('Enter a description.'); return; }
    setSavingCount(true);

    let countId = editingCountId;
    const payload = {
      matter_id: matterId,
      count_number: countForm.count_number ? parseInt(countForm.count_number, 10) : null,
      description: countForm.description.trim(),
    };

    if (editingCountId) {
      const { error } = await supabase.from('case_counts').update(payload).eq('id', editingCountId);
      if (error) { alert(error.message); setSavingCount(false); return; }
      await supabase.from('count_defendants').delete().eq('count_id', editingCountId);
    } else {
      const { data, error } = await supabase.from('case_counts').insert(payload).select('id').single();
      if (error) { alert(error.message); setSavingCount(false); return; }
      countId = data.id;
    }

    if (countForm.defendant_ids.length > 0) {
      const links = countForm.defendant_ids.map((defId) => {
        const def = defendants.find((d) => d.id === defId);
        return {
          count_id: countId,
          person_id: def?.type === 'person' ? defId : null,
          entity_id: def?.type === 'entity' ? defId : null,
        };
      });
      const { error: linkError } = await supabase.from('count_defendants').insert(links);
      if (linkError) alert('Count saved, but linking defendants failed: ' + linkError.message);
    }

    setSavingCount(false);
    setCountModalOpen(false);
    load();
  }

  async function removeCount(id) {
    if (!confirm('Remove this count?')) return;
    const { error } = await supabase.from('case_counts').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  function startEditDismiss(count) {
    setEditingDismissFor(count.id);
    setDismissDraft({
      dismissed: !!count.dismissed,
      dismissed_date: count.dismissed_date || '',
      dismissal_notes: count.dismissal_notes || '',
    });
  }

  async function saveDismiss() {
    const { error } = await supabase.from('case_counts').update({
      dismissed: dismissDraft.dismissed,
      dismissed_date: dismissDraft.dismissed ? (dismissDraft.dismissed_date || null) : null,
      dismissal_notes: dismissDraft.dismissed ? (dismissDraft.dismissal_notes?.trim() || null) : null,
    }).eq('id', editingDismissFor);
    if (error) { alert(error.message); return; }
    setEditingDismissFor(null);
    load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      {/* CASE NARRATIVE */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Case</h3>
          {!editingCase && <button className="btn-small" onClick={openEditCase}>Edit</button>}
        </div>

        {!editingCase && (
          <div className="detail-grid">
            <div className="detail-card"><span className="detail-label">Incident Date</span><span className="detail-value">{matter?.incident_date ? formatDateSafe(matter.incident_date) : '—'}</span></div>
            <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
              <span className="detail-label">Brief Facts / Factual Background</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{matter?.factual_allegations ? renderSimpleMarkdown(matter.factual_allegations) : '—'}</span>
            </div>
            <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
              <span className="detail-label">Defense Theory Notes</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{matter?.defense_theory_notes ? renderSimpleMarkdown(matter.defense_theory_notes) : '—'}</span>
            </div>
          </div>
        )}

        {editingCase && (
          <div>
            <div className="form-field" style={{ maxWidth: '240px' }}>
              <label>Incident Date</label>
              <input type="date" value={caseForm.incident_date} onChange={(e) => setCaseForm((f) => ({ ...f, incident_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Brief Facts / Factual Background</label>
              <textarea
                rows={5}
                value={caseForm.factual_allegations}
                onChange={(e) => setCaseForm((f) => ({ ...f, factual_allegations: e.target.value }))}
                placeholder="On March 15, 2024, officers responded to... Use **bold** or [link text](https://...) if needed."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div className="form-field">
              <label>Defense Theory Notes</label>
              <textarea
                rows={5}
                value={caseForm.defense_theory_notes}
                onChange={(e) => setCaseForm((f) => ({ ...f, defense_theory_notes: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveCase} disabled={savingCase}>{savingCase ? 'Saving…' : 'Save'}</button>
              <button className="btn" onClick={() => setEditingCase(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* COUNTS */}
      <div className="section-card">
        <div className="section-card-header">
          <h3>Counts</h3>
          <button className="btn-small btn-primary" style={{ background: 'red', borderColor: 'red' }} onClick={openAddCount}>+ Add Count</button>
        </div>

        {counts.length === 0 && <p className="muted">No counts entered yet.</p>}

        {counts.map((count) => {
          const isDismissEditing = editingDismissFor === count.id;
          return (
            <div key={count.id} className="party-card" style={{ opacity: count.dismissed ? 0.55 : 1 }}>
              <div className="party-card-header">
                <span style={{ fontWeight: 600, textDecoration: count.dismissed ? 'line-through' : 'none' }}>
                  Count {count.count_number}: {count.description}
                </span>
                {count.dismissed && <span className="badge badge-red">Dismissed</span>}
                <button className="btn-small" onClick={() => openEditCount(count)}>Edit</button>
                <button className="btn-small btn-small-danger" onClick={() => removeCount(count.id)}>Remove</button>
              </div>

              {count.dismissed && count.dismissal_notes && !isDismissEditing && (
                <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  {count.dismissed_date ? `Dismissed ${formatDateSafe(count.dismissed_date)} — ` : ''}{count.dismissal_notes}
                </div>
              )}

              {(count.count_defendants || []).length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <span className="nested-label">Applies to: </span>
                  <span className="muted" style={{ fontSize: '12px' }}>
                    {(count.count_defendants || []).map((cd, i) => {
                      const name = cd.people ? `${cd.people.first_name || ''} ${cd.people.last_name || ''}`.trim() : cd.entities?.name;
                      const def = defendants.find((d) => d.id === (cd.person_id || cd.entity_id));
                      const isDismissedParty = def?.dismissed;
                      return (
                        <span key={cd.id} style={{ textDecoration: isDismissedParty ? 'line-through' : 'none' }}>
                          {name}{isDismissedParty ? ' (dismissed)' : ''}{i < count.count_defendants.length - 1 ? ', ' : ''}
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}

              {isDismissEditing ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    <input type="checkbox" checked={dismissDraft.dismissed} onChange={(e) => setDismissDraft((d) => ({ ...d, dismissed: e.target.checked }))} />
                    Dismissed
                  </label>
                  {dismissDraft.dismissed && (
                    <>
                      <input type="date" value={dismissDraft.dismissed_date} onChange={(e) => setDismissDraft((d) => ({ ...d, dismissed_date: e.target.value }))} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }} />
                      <input
                        style={{ flex: 1, minWidth: '160px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }}
                        placeholder="e.g. dismissed on summary judgment"
                        value={dismissDraft.dismissal_notes}
                        onChange={(e) => setDismissDraft((d) => ({ ...d, dismissal_notes: e.target.value }))}
                      />
                    </>
                  )}
                  <button className="btn-small btn-primary" onClick={saveDismiss}>Save</button>
                  <button className="btn-small" onClick={() => setEditingDismissFor(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-small" style={{ marginTop: '6px' }} onClick={() => startEditDismiss(count)}>
                  {count.dismissed ? 'Edit Dismissal' : 'Mark Dismissed'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {countModalOpen && (
        <div className="modal-overlay" onClick={() => setCountModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <h2>{editingCountId ? 'Edit Count' : 'Add Count'}</h2>
              <button className="modal-close" onClick={() => setCountModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field" style={{ maxWidth: '120px' }}>
                  <label>Count #</label>
                  <input type="number" value={countForm.count_number} onChange={(e) => setCountForm((f) => ({ ...f, count_number: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Description</label>
                  <input value={countForm.description} onChange={(e) => setCountForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Excessive Force" />
                </div>
              </div>

              <div className="form-field">
                <label>Applies to</label>
                {defendants.length === 0 && <p className="muted">No Defendants/Co-Defendants on this matter yet.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px' }}>
                  {[...defendants].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                    <label
                      key={`${d.type}-${d.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', fontSize: '13px', minWidth: 0 }}
                    >
                      <input
                        type="checkbox"
                        style={{ margin: 0, flexShrink: 0 }}
                        checked={countForm.defendant_ids.includes(d.id)}
                        onChange={() => toggleDefendantInForm(d.id)}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '80px', flexShrink: 1 }}>{d.name}{d.dismissed ? ' (dismissed)' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={saveCount} disabled={savingCount}>{savingCount ? 'Saving…' : editingCountId ? 'Save' : 'Add Count'}</button>
                <button className="btn" onClick={() => setCountModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
