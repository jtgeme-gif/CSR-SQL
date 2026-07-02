'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Controlled combobox: search existing People, or create a new one inline
// (name only — full details get filled in later via the person's own card).
// Props: value (person id or ''), valueName (display name), onChange(personId, personName)
export default function PersonPicker({ value, valueName, onChange }) {
  const [people, setPeople] = useState([]);
  const [inputValue, setInputValue] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    supabase.from('people').select('id, first_name, last_name').then(({ data }) => {
      setPeople(data || []);
    });
  }, []);

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

  const withNames = people.map((p) => ({ ...p, fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim() }));
  const matches = withNames.filter((p) => p.fullName.toLowerCase().includes(inputValue.toLowerCase()));
  const exactMatch = withNames.some((p) => p.fullName.toLowerCase() === inputValue.trim().toLowerCase());

  function selectPerson(p) {
    setInputValue(p.fullName);
    onChange(p.id, p.fullName);
    setOpen(false);
  }

  async function createPerson() {
    const full = inputValue.trim();
    if (!full) return;
    const parts = full.split(' ');
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ') || null;
    setCreating(true);
    const { data, error } = await supabase
      .from('people')
      .insert({ first_name, last_name, identity: 'Individual' })
      .select('id, first_name, last_name')
      .single();
    setCreating(false);
    if (error) {
      alert('Could not create person: ' + error.message);
      return;
    }
    const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    setPeople((prev) => [...prev, data]);
    onChange(data.id, fullName);
    setInputValue(fullName);
    setOpen(false);
  }

  return (
    <div className="entity-picker" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        placeholder="Search or type a new person's name…"
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onChange(null, '');
        }}
        onFocus={() => setOpen(true)}
      />
      {open && inputValue.trim() !== '' && (
        <div className="entity-picker-dropdown">
          {matches.map((p) => (
            <div key={p.id} className="entity-picker-option" onClick={() => selectPerson(p)}>
              {p.fullName}
            </div>
          ))}
          {!exactMatch && (
            <div className="entity-picker-option entity-picker-create" onClick={createPerson}>
              {creating ? 'Creating…' : `+ Add "${inputValue.trim()}" as a new person`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
