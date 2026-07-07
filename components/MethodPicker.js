'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Small growable list (RDS, LCS, Direct, and whatever else gets typed).
// Deliberately not linked to Entities — this is just "how it was sent."
// Props: value (subpoena_methods.id or ''), valueName, onChange(methodId, methodLabel)
export default function MethodPicker({ value, valueName, onChange }) {
  const [methods, setMethods] = useState([]);
  const [inputValue, setInputValue] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    supabase.from('subpoena_methods').select('*').order('label').then(({ data }) => {
      setMethods(data || []);
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

  const matches = methods.filter((m) => m.label.toLowerCase().includes(inputValue.toLowerCase()));
  const exactMatch = methods.some((m) => m.label.toLowerCase() === inputValue.trim().toLowerCase());

  function selectMethod(m) {
    setInputValue(m.label);
    onChange(m.id, m.label);
    setOpen(false);
  }

  async function createMethod() {
    const label = inputValue.trim();
    if (!label) return;
    setCreating(true);
    const { data, error } = await supabase.from('subpoena_methods').insert({ label }).select().single();
    setCreating(false);
    if (error) {
      alert('Could not add method: ' + error.message);
      return;
    }
    setMethods((prev) => [...prev, data]);
    selectMethod(data);
  }

  return (
    <div className="entity-picker" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        placeholder="RDS, LCS, Direct…"
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onChange(null, '');
        }}
        onFocus={() => setOpen(true)}
      />
      {open && inputValue.trim() !== '' && (
        <div className="entity-picker-dropdown">
          {matches.map((m) => (
            <div key={m.id} className="entity-picker-option" onClick={() => selectMethod(m)}>
              {m.label}
            </div>
          ))}
          {!exactMatch && (
            <div className="entity-picker-option entity-picker-create" onClick={createMethod}>
              {creating ? 'Adding…' : `+ Add "${inputValue.trim()}" as a new method`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
