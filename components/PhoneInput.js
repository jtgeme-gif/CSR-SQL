'use client';

import { formatPhoneDisplay, stripPhone } from '../lib/formatPhone';

// Type raw digits, see them formatted as (555) 123-4567.
// onChange always receives the plain digit string — components using this
// never need to think about formatting when saving to Supabase.
export default function PhoneInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatPhoneDisplay(value)}
      placeholder={placeholder || '(555) 123-4567'}
      onChange={(e) => onChange(stripPhone(e.target.value))}
    />
  );
}
