'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Controlled combobox: search existing Entities, or create a new one inline.
// Props: value (entity id or ''), valueName (display name for the current value),
// onChange(entityId, entityName, entityRecord) — entityRecord is the full row
// (used by parent forms to auto-fill address fields), or null when cleared/typing.
export default function EntityPicker({ value, valueName, onChange, allowCreate = true }) {
  const [entities, setEntities] = useState([]);
  const [inputValue, setInputValue] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    supabase.from('entities').select('*').order('name').then(({ data }) => {
      setEntities(data || []);
    });
  }, []);

  useEffect(() => {
    setInputValue(valueName || '');
  }, [valueName]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matches = entities.filter((ent) =>
    ent.name.toLowerCase().includes(inputValue.toLowerCase())
  );
  const exactMatch = entities.some(
    (ent) => ent.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  function selectEntity(ent) {
    setInputValue(ent.name);
    onChange(ent.id, ent.name, ent);
    setOpen(false);
  }

  function clearSelection() {
    setInputValue('');
    onChange(null, '', null);
  }

  async function createEntity() {
    const name = inputValue.trim();
    if (!name) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('entities')
      .insert({ name })
      .select()
      .single();
    setCreating(false);
    if (error) {
      alert('Could not create entity: ' + error.message);
      return;
    }
    setEntities((prev) => [...prev, data]);
    selectEntity(data);
  }

  return (
    <div className="entity-picker" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        placeholder="Search or type a new entity name…"
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onChange(null, '', null); // typing clears a prior selection until re-picked
        }}
        onFocus={() => setOpen(true)}
      />
      {value && (
        <button type="button" className="entity-picker-clear" onClick={clearSelection} title="Clear">
          ×
        </button>
      )}

      {open && inputValue.trim() !== '' && (
        <div className="entity-picker-dropdown">
          {matches.map((ent) => (
            <div key={ent.id} className="entity-picker-option" onClick={() => selectEntity(ent)}>
              {ent.name}
            </div>
          ))}
          {!exactMatch && allowCreate && (
            <div className="entity-picker-option entity-picker-create" onClick={createEntity}>
              {creating ? 'Creating…' : `+ Add "${inputValue.trim()}" as a new entity`}
            </div>
          )}
          {!exactMatch && !allowCreate && matches.length === 0 && (
            <div className="entity-picker-empty">No matching entity. Add it from the Entities page first.</div>
          )}
        </div>
      )}
    </div>
  );
}
