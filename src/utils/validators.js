/**
 * Shared validation helpers — used by all models.
 */

/**
 * Validates and returns a positive numeric amount.
 * @param {*} amount
 * @returns {number}
 */
export function validateAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  return num;
}

/**
 * Validates and trims a required string name.
 * @param {*} name
 * @returns {string}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required and must be a non-empty string.');
  }
  return name.trim();
}

/**
 * Validates a month string in YYYY-MM format.
 * @param {string} month
 * @returns {string}
 */
export function validateMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Month must be in YYYY-MM format (e.g. "2025-05").');
  }
  const [y, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) throw new Error('Month value must be between 01 and 12.');
  if (y < 2000 || y > 2100) throw new Error('Year must be between 2000 and 2100.');
  return month;
}

/**
 * Validates a date string (YYYY-MM-DD or ISO).
 * Returns a Date object.
 * @param {string} dateStr
 * @param {string} [label='date']
 * @returns {Date}
 */
export function validateDate(dateStr, label = 'date') {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${label}: "${dateStr}". Use YYYY-MM-DD format.`);
  return d;
}

/**
 * Validates a from/to date range.
 * @param {string} from
 * @param {string} to
 * @returns {{ from: Date, to: Date }}
 */
export function validateDateRange(from, to) {
  const f = validateDate(from, '"from" date');
  const t = validateDate(to,   '"to" date');
  if (f > t) throw new Error('"from" date cannot be after "to" date.');
  return { from: f, to: t };
}

/**
 * Returns the first and last day of the current month as ISO date strings (YYYY-MM-DD).
 * Uses local time to avoid UTC-offset issues.
 * @returns {{ from: string, to: string }}
 */
export function currentMonthRange() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const from  = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to    = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/**
 * Returns the first and last day of a given YYYY-MM month string.
 * @param {string} month  e.g. "2025-05"
 * @returns {{ from: string, to: string }}
 */
export function monthToDateRange(month) {
  validateMonth(month);
  const [year, m] = month.split('-').map(Number);
  const lastDay   = new Date(year, m, 0).getDate();
  return {
    from: `${month}-01`,
    to:   `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Validates a MongoDB ObjectId string (24 hex chars).
 * @param {string} id
 * @param {string} [label='ID']
 * @returns {string}
 */
export function validateObjectId(id, label = 'ID') {
  if (!id || typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(`Invalid ${label}. Must be a 24-character hex string.`);
  }
  return id;
}
