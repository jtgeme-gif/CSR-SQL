'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncEventToCalendar } from '../lib/calendarSync';

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

      const payload = {
        matter_id: matterId,
        event_type_id: eventTypeId,
        description: row.description.trim(),
        event_date: row.date,
        all_day: true,
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
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
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

              <table className="table">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th title="Not yet functional - reserved for the upcoming Task tab">Create Task</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = rowStatus[row.id];
                    return (
                      <tr key={row.id} style={{ opacity: row.include ? 1 : 0.5 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.include}
                            disabled={saving}
                            onChange={(e) => updateRow(row.id, 'include', e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.description}
                            disabled={saving}
                            onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px' }}
                          />
                        </td>
                        <td>
                          <select
                            value={row.category}
                            disabled={saving}
                            onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={row.date}
                            disabled={saving}
                            onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={row.createTask}
                            disabled={saving}
                            onChange={(e) => updateRow(row.id, 'createTask', e.target.checked)}
                          />
                        </td>
                        <td className="muted" style={{ fontSize: '11px', minWidth: '90px' }}>
                          {status === 'saving' ? 'Adding…' : status === 'done' ? '✓ Added' : status || ''}
                        </td>
                      </tr>
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
