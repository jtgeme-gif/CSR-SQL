// Postgres `date` columns come back as plain "YYYY-MM-DD" strings with no
// time component. new Date("YYYY-MM-DD") parses that as UTC midnight, which
// then displays as the PREVIOUS day once .toLocaleDateString() renders it in
// any timezone behind UTC (i.e. all of the US). Splitting the parts and
// building the Date from local year/month/day avoids that shift entirely.
export function formatDateSafe(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString();
}
