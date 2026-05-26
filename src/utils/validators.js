/**
 * Shared validation helpers — used by all models.
 *
 * Cleanup 1: validateName now caps at 200 chars.
 * Cleanup 2: Removed unused exports (currentMonthRange, validateDateRange).
 * Cleanup 4: Added parseSafeDate() helper for safe date construction.
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
 * Max 200 characters (Cleanup 1).
 * @param {*} name
 * @returns {string}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required and must be a non-empty string.');
  }
  const trimmed = name.trim();
  if (trimmed.length > 200) {
    throw new Error('Name must be 200 characters or fewer.');
  }
  return trimmed;
}

/**
 * Validates and trims an optional description/notes field.
 * Max 500 characters (Cleanup 1).
 * @param {string|undefined} text
 * @returns {string}
 */
export function validateDescription(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.length > 500) {
    throw new Error('Description must be 500 characters or fewer.');
  }
  return trimmed;
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
 * Safely parse a date string (YYYY-MM-DD or ISO).
 * Throws a clear error if the string is not a valid date.
 * Use this instead of `new Date(str)` directly (Cleanup 4).
 * @param {string} str
 * @param {string} [label='date']
 * @returns {Date}
 */
export function parseSafeDate(str, label = 'date') {
  if (!str || typeof str !== 'string') {
    throw new Error(`Invalid ${label}: value is required.`);
  }
  // Accept YYYY-MM-DD or full ISO strings
  if (!/^\d{4}-\d{2}-\d{2}/.test(str)) {
    throw new Error(`Invalid ${label}: "${str}". Use YYYY-MM-DD format.`);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ${label}: "${str}". Use YYYY-MM-DD format.`);
  }
  return d;
}

/**
 * Build an end-of-day Date for a YYYY-MM-DD string.
 * Replaces the unsafe `new Date(\`${to}T23:59:59.999Z\`)` pattern (Cleanup 4).
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {Date}
 */
export function endOfDay(dateStr) {
  const d = parseSafeDate(dateStr, 'end date');
  d.setUTCHours(23, 59, 59, 999);
  return d;
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

/**
 * Validates an email address format.
 * @param {string} email
 * @returns {string} normalised lowercase email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Email is required.');
  }
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Invalid email format. Please enter a valid email address.');
  }
  return trimmed;
}
