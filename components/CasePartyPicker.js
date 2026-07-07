'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Search-and-link combobox scoped to ONE matter's existing case_people rows
// (Plaintiffs, Defendants, Co-Defendants, Witnesses, Experts, Designated Reps —
// anyone already on the file). Quick-create adds a brand-new person AND links
// them to this matter as a Witness in one action, since "deposed" implies
// "witness" per how this was scoped.
// Props: matterId, value (case_people.id or null), valueName, onChange(casePeopleId, displayName)
export default function CasePartyPicker({ matterId, value, valueName, onChange }) {
  const [rows, setRows] = useState([]);
  const [inputValue, setInputValue] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function load() {
    const { data } = await supabase
      .from('case_people')
      .select('id, role, witness_type, people(first_name, last_name)')
      .eq('matter_id', matterId);
    setRows(data || []);
  }

  useEffect(() => {
    setInputValue(valueName || '');
  }, [valueName]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const withNames = rows.map((r) => ({
    ...r,
    fullName: `${r.people?.first_name || ''} ${r.people?.last_name || ''}`.trim(),
    roleLabel: r.role === 'Witness' && r.witness_type ? `Witness — ${r.witness_type}` : r.role,
  }));
  const matches = withNames.filter((r) => r.fullName.toLowerCase().includes(inputValue.toLowerCase()));
  const exactMatch = withNames.some((r) => r.fullName.toLowerCase() === inputValue.trim().toLowerCase());

  function selectRow(r) {
    setInputValue(r.fullName);
    onChange(r.id, r.fullName);
    setOpen(false);
  }

  async function createAsWitness() {
    const full = inputValue.trim();
    if (!full) return;
    setCreating(true);
    const parts = full.split(' ');
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ') || null;

    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({ first_name, last_name, identity: 'Individual' })
      .select('id, first_name, last_name')
      .single();
    if (personError) {
      alert('Could not create person: ' + personError.message);
      setCreating(false);
      return;
    }

    const { data: cp, error: cpError } = await supabase
      .from('case_people')
      .insert({ matter_id: matterId, person_id: person.id, role: 'Witness', witness_type: 'Fact' })
      .select('id')
      .single();
    setCreating(false);
    if (cpError) {
      alert('Person created, but linking them as a Witness on this matter failed: ' + cpError.message);
      return;
    }

    const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
    onChange(cp.id, fullName);
    setInputValue(fullName);
    setOpen(false);
    load();
  }

  return (
    <div className="entity-picker" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        placeholder="Search this matter's parties/witnesses, or type a new name…"
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onChange(null, '');
        }}
        onFocus={() => setOpen(true)}
      />
      {open && inputValue.trim() !== '' && (
        <div className="entity-picker-dropdown">
          {matches.map((r) => (
            <div key={r.id} className="entity-picker-option" onClick={() => selectRow(r)}>
              {r.fullName} <span className="muted" style={{ fontSize: '11px' }}>— {r.roleLabel}</span>
            </div>
          ))}
          {!exactMatch && (
            <div className="entity-picker-option entity-picker-create" onClick={createAsWitness}>
              {creating ? 'Creating…' : `+ Add "${inputValue.trim()}" as a new Witness on this matter`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
