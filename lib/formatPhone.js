// Shared phone formatting: store raw digits everywhere, format only for display/typing.

export function formatPhoneDisplay(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function stripPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}
