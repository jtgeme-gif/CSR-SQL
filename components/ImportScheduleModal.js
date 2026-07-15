'use client';

import { useState, Fragment } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncEventToCalendar } from '../lib/calendarSync';
import CasePartyPicker from './CasePartyPicker';

const CATEGORIES = [
  'Discovery',
  'Deposition',
  'Mediation',
  'Court Deadline',
  'Hearing',
  'Motion / Brief',
  'Status Conference/Pre-Trial',
  'Trial',
];

// Same set SchedulingTab treats as "timed" (has a time-of-day, not just an
// all-day date) - kept in sync manually since this is a small, stable list.
const TIMED_CATEGORIES = ['Deposition', 'Hearing', 'Status Conference/Pre-Trial', 'Trial', 'Mediation'];

let nextRowId = 1;

// matterId, eventTypes ([{id, label}]), calendarTitlePrefix (short_name ||
// case_name, same as SchedulingTab uses for calendar titles), onClose,
// onImported (called after a successful Add Selected, so the parent
// SchedulingTab can reload its event list the same way it does after any
// other creation path).
export default function ImportScheduleModal({ matterId, eventTypes, calendarTitlePrefix, onClose, onImported }) {
  const [mode, setMode] = useState('paste'); // 'paste' | 'upload'
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null); // { base64, mediaType, filename }
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [rows, setRows] = useState(null); // null = not parsed yet
  const [saving, setSaving] = useState(false);
  const [rowStatus, setRowStatus] = useState({}); // rowId -> 'saving' | 'done' | error message

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:application/pdf;base64,XXXX"
      const base64 = result.split(',')[1];
      setUploadedFile({ base64, mediaType: file.type, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function parseDocument() {
    if (!pastedText.trim() && !uploadedFile) {
      setParseError('Paste some text or upload a file first.');
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const body = uploadedFile
        ? { fileBase64: uploadedFile.base64, mediaType: uploadedFile.mediaType }
        : { text: pastedText };
      const res = await fetch('/api/parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setParseError(data.error || 'Parsing failed.');
        setParsing(false);
        return;
      }
      if (data.events.length === 0) {
        setParseError('No dates or deadlines were found in that document.');
        setParsing(false);
        return;
      }
      setRows(
        data.events.map((ev) => ({
          id: nextRowId++,
          description: ev.description,
          category: ev.category,
          date: ev.date,
          time: ev.time || '',
          durationHours: ev.time ? '1' : '',
          casePeopleId: null,
          casePeopleName: ev.witnessName || '',
          include: true,
          createTask: true, // cosmetic only - not read anywhere yet
        }))
      );
    } catch (err) {
      setParseError(err.message);
    }
    setParsing(false);
  }

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function addSelected() {
    const toAdd = rows.filter((r) => r.include);
    if (toAdd.length === 0) {
      setParseError('Nothing is toggled on to add.');
      return;
    }
    setSaving(true);
    const statusUpdates = {};

    for (const row of toAdd) {
      statusUpdates[row.id] = 'saving';
      setRowStatus((s) => ({ ...s, [row.id]: 'saving' }));

      const eventTypeId = eventTypes.find((t) => t.label === row.category)?.id;
      if (!eventTypeId) {
        setRowStatus((s) => ({ ...s, [row.id]: `Unknown category "${row.category}"` }));
        continue;
      }

      const isTimed = TIMED_CATEGORIES.includes(row.category);
      const payload = {
        matter_id: matterId,
        event_type_id: eventTypeId,
        description: row.description.trim(),
        event_date: row.date,
        all_day: isTimed ? !row.time : true,
        event_time: isTimed && row.time ? row.time : null,
        duration_minutes: isTimed && row.time && row.durationHours ? Math.round(parseFloat(row.durationHours) * 60) : null,
        case_people_id: row.category === 'Deposition' ? (row.casePeopleId || null) : null,
      };

      const { data: savedRow, error } = await supabase.from('events').insert(payload).select().single();
      if (error) {
        setRowStatus((s) => ({ ...s, [row.id]: error.message }));
        continue;
      }

      try {
        await syncEventToCalendar(supabase, savedRow, row.category, calendarTitlePrefix);
        setRowStatus((s) => ({ ...s, [row.id]: 'done' }));
      } catch (syncErr) {
        setRowStatus((s) => ({ ...s, [row.id]: `Added, but calendar sync failed: ${syncErr.message}` }));
      }
    }

    setSaving(false);
    onImported?.();
  }

  const allDone = rows && rows.filter((r) => r.include).every((r) => rowStatus[r.id] === 'done');

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '980px' }}>
        <div className="modal-header">
          <h2>Import Scheduling Document</h2>
          <button className="modal-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className="modal-body">
          {!rows && (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Paste the text of a scheduling order or NEF, or upload a PDF/photo of one. Claude will read it and propose
                a list of dates below — nothing is added to the tracker or the calendar until you review and confirm.
              </p>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button className={`btn-small ${mode === 'paste' ? 'btn-primary' : ''}`} onClick={() => setMode('paste')}>Paste Text</button>
                <button className={`btn-small ${mode === 'upload' ? 'btn-primary' : ''}`} onClick={() => setMode('upload')}>Upload File</button>
              </div>

              {mode === 'paste' ? (
                <textarea
                  rows={10}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste the full text of the scheduling order or NEF here…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '32px',
                    textAlign: 'center',
                    background: dragOver ? 'var(--blue-bg)' : 'transparent',
                  }}
                >
                  {uploadedFile ? (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '6px' }}>{uploadedFile.filename}</div>
                      <button className="btn-small" onClick={() => setUploadedFile(null)}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <p className="muted" style={{ marginTop: 0 }}>Drag and drop a PDF or photo here, or:</p>
                      <input type="file" accept="application/pdf,image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
                    </>
                  )}
                </div>
              )}

              {parseError && <div className="error-box" style={{ marginTop: '12px' }}>{parseError}</div>}

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={parseDocument} disabled={parsing}>
                  {parsing ? 'Reading document…' : 'Parse Document'}
                </button>
                <button className="btn" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}

          {rows && (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Review each row before adding. Edit anything that's wrong, and toggle off anything you don't want added.
              </p>

              <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="table" style={{ textAlign: 'left' }}>
                    <th style={{ width: '50px', padding: '8px' }}>Include</th>
                    <th style={{ width: '34%', padding: '8px' }}>Description</th>
                    <th style={{ width: '170px', padding: '8px 24px 8px 8px' }}>Category</th>
                    <th style={{ width: '150px', padding: '8px' }}>Date</th>
                    <th style={{ width: '80px', padding: '8px' }} title="Not yet functional - reserved for the upcoming Task tab">Create Task</th>
                    <th style={{ padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = rowStatus[row.id];
                    const isTimed = TIMED_CATEGORIES.includes(row.category);
                    const isDeposition = row.category === 'Deposition';
                    return (
                      <Fragment key={row.id}>
                        <tr style={{ borderTop: '1px solid var(--border)', opacity: row.include ? 1 : 0.5 }}>
                          <td style={{ padding: '8px', verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={row.include}
                              disabled={saving}
                              onChange={(e) => updateRow(row.id, 'include', e.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '8px', verticalAlign: 'top' }}>
                            <textarea
                              value={row.description}
                              disabled={saving}
                              onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                              rows={2}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '8px 24px 8px 8px', verticalAlign: 'top' }}>
                            <select
                              value={row.category}
                              disabled={saving}
                              onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                            >
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px', verticalAlign: 'top' }}>
                            <input
                              type="date"
                              value={row.date}
                              disabled={saving}
                              onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={row.createTask}
                              disabled={saving}
                              onChange={(e) => updateRow(row.id, 'createTask', e.target.checked)}
                            />
                          </td>
                          <td className="muted" style={{ padding: '8px', fontSize: '11px', minWidth: '90px', verticalAlign: 'top' }}>
                            {status === 'saving' ? 'Adding…' : status === 'done' ? '✓ Added' : status || ''}
                          </td>
                        </tr>
                        {(isTimed || isDeposition) && (
                          <tr style={{ opacity: row.include ? 1 : 0.5 }}>
                            <td></td>
                            <td colSpan={5} style={{ padding: '0 8px 12px 8px' }}>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--gray-bg, #f7f8fa)', padding: '10px 12px', borderRadius: 'var(--radius)' }}>
                                {isTimed && (
                                  <>
                                    <div>
                                      <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Time</label>
                                      <input
                                        type="time"
                                        value={row.time}
                                        disabled={saving}
                                        onChange={(e) => updateRow(row.id, 'time', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Duration (hours)</label>
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={row.durationHours}
                                        disabled={saving}
                                        onChange={(e) => updateRow(row.id, 'durationHours', e.target.value)}
                                        style={{ width: '80px', padding: '6px 8px', boxSizing: 'border-box' }}
                                      />
                                    </div>
                                  </>
                                )}
                                {isDeposition && (
                                  <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                                    <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Witness</label>
                                    <CasePartyPicker
                                      matterId={matterId}
                                      value={row.casePeopleId}
                                      valueName={row.casePeopleName}
                                      onChange={(id, name) => {
                                        updateRow(row.id, 'casePeopleId', id);
                                        updateRow(row.id, 'casePeopleName', name);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              {parseError && <div className="error-box" style={{ marginTop: '12px' }}>{parseError}</div>}

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={addSelected} disabled={saving || allDone}>
                  {saving ? 'Adding…' : allDone ? 'All Added' : 'Add Selected'}
                </button>
                <button className="btn" onClick={onClose} disabled={saving}>{allDone ? 'Close' : 'Cancel'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
