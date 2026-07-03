'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Search-only combobox for existing Staff records. Deliberately no inline-create —
// the staff list should stay a small, deliberate roster managed from the Staff
// List admin page, not grow by typo the way People/Entities can.
// Props: value (staff id or ''), valueName (display name), onChange(staffId, staffName)
export default function StaffPicker({ value, valueName, onChange }) {
  const [staffList, setStaffList] = useState([]);
  const [inputValue, setInputValue] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    supabase.from('staff').select('id, first_name, last_name').eq('active', true).order('last_name').then(({ data }) => {
      setStaffList(data || []);
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

  const withNames = staffList.map((s) => ({ ...s, fullName: `${s.first_name || ''} ${s.last_name || ''}`.trim() }));
  const matches = withNames.filter((s) => s.fullName.toLowerCase().includes(inputValue.toLowerCase()));

  function selectStaff(s) {
    setInputValue(s.fullName);
    onChange(s.id, s.fullName);
    setOpen(false);
  }

  return (
    <div className="entity-picker" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        placeholder="Search staff…"
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onChange(null, '');
        }}
        onFocus={() => setOpen(true)}
      />
      {open && inputValue.trim() !== '' && (
        <div className="entity-picker-dropdown">
          {matches.map((s) => (
            <div key={s.id} className="entity-picker-option" onClick={() => selectStaff(s)}>
              {s.fullName}
            </div>
          ))}
          {matches.length === 0 && (
            <div className="entity-picker-empty">No matching active staff. Add them from the Staff List page first.</div>
          )}
        </div>
      )}
    </div>
  );
}
