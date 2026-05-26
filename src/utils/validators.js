/**
 * Shared validation helpers.
 */

export function validateAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  return num;
}

export function validateName(name) {
  if (!name?.trim()) throw new Error('Name is required.');
  return name.trim();
}

export function validateMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Month must be in YYYY-MM format (e.g. "2025-05").');
  }
  return month;
}

export function validateDateRange(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  if (isNaN(f.getTime())) throw new Error(`Invalid "from" date: ${from}`);
  if (isNaN(t.getTime())) throw new Error(`Invalid "to" date: ${to}`);
  if (f > t) throw new Error('"from" date cannot be after "to" date.');
  return { from: f, to: t };
}

/** Returns the first and last day of the current month as ISO date strings. */
export function currentMonthRange() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const from  = new Date(year, month, 1).toISOString().split('T')[0];
  const to    = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return { from, to };
}
