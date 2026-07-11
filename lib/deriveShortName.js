// Auto-derives a matter's Short Name from its Case Name, per the finalized
// Outlook calendar sync design: take everything before " v " / " v. "
// (case-insensitive), e.g. "Walby v Hancock et al" -> "Walby". Returns ''
// if no " v "/" v. " separator is found, so callers can fall back to the
// full Case Name instead when a clean short form can't be derived.
export function deriveShortName(caseName) {
  if (!caseName) return '';
  const match = caseName.match(/^(.*?)\s+v\.?\s+/i);
  return match ? match[1].trim() : '';
}
