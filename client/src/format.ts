export function formatMoney(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// The server stores timestamps as SQLite's `datetime('now')`, which is UTC
// with no timezone marker (e.g. "2026-07-20 08:07:50"). Parsed as-is, that
// string is 3 hours behind Nairobi (UTC+3). Treat it as UTC explicitly, then
// let the browser render it in whatever timezone the till is actually in.
export function formatServerDate(value: string): string {
  const isoUtc = `${value.replace(" ", "T")}Z`;
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-KE");
}
