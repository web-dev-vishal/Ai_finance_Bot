import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

/**
 * Convert an array of MongoDB documents to a CSV string.
 * Replaces _id with a plain string `id` column.
 */
function toCSV(rows) {
  if (!rows.length) return '';

  // Collect all unique field names, excluding _id (we add 'id' manually)
  const fieldSet = new Set();
  rows.forEach(r => Object.keys(r).forEach(k => { if (k !== '_id') fieldSet.add(k); }));
  const fields = ['id', ...fieldSet];

  const header = fields.join(',');
  const lines  = rows.map(row =>
    fields.map(f => {
      if (f === 'id') return escapeCSV(String(row._id ?? ''));
      return escapeCSV(row[f]);
    }).join(',')
  );

  return [header, ...lines].join('\n');
}

/**
 * Serialize a MongoDB document to a plain JSON-safe object.
 * Converts _id → id string, removes undefined values.
 */
function toPlainObject(doc) {
  const { _id, ...rest } = doc;
  const out = { id: String(_id) };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ── Directory helper ──────────────────────────────────────────────────────────

/**
 * Returns a writable directory path.
 * Tries Desktop first, falls back to cwd.
 * Creates the directory if it doesn't exist.
 */
async function resolveOutputDir() {
  const candidates = [
    join(homedir(), 'Desktop'),
    join(homedir(), 'Documents'),
    process.cwd(),
  ];

  for (const dir of candidates) {
    try {
      await access(dir); // check it exists and is accessible
      return dir;
    } catch {
      try {
        await mkdir(dir, { recursive: true });
        return dir;
      } catch {
        // try next candidate
      }
    }
  }

  // Last resort: cwd (always writable)
  return process.cwd();
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Export expenses and incomes to a file.
 *
 * @param {{
 *   expenses: object[],
 *   incomes:  object[],
 *   format:   'csv' | 'json',
 *   from?:    string,
 *   to?:      string
 * }} opts
 * @returns {Promise<string>} Success message with file path
 */
export async function exportData({ expenses, incomes, format = 'csv', from, to }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const range     = from && to ? `_${from}_to_${to}` : '_all-time';
  const filename  = `financebot_export${range}_${timestamp}.${format}`;

  const dir      = await resolveOutputDir();
  const filepath = join(dir, filename);

  let content;

  if (format === 'json') {
    const payload = {
      exportedAt: new Date().toISOString(),
      range:      from && to ? { from, to } : 'all-time',
      summary: {
        totalExpenses: expenses.reduce((s, r) => s + (r.amount ?? 0), 0),
        totalIncome:   incomes.reduce((s, r)  => s + (r.amount ?? 0), 0),
        expenseCount:  expenses.length,
        incomeCount:   incomes.length,
      },
      expenses: expenses.map(toPlainObject),
      incomes:  incomes.map(toPlainObject),
    };
    content = JSON.stringify(payload, null, 2);
  } else {
    // CSV — two labelled sections
    const dateStr = new Date().toLocaleDateString('en-IN');
    const expCSV  = expenses.length
      ? toCSV(expenses)
      : '(no expense records)';
    const incCSV  = incomes.length
      ? toCSV(incomes)
      : '(no income records)';

    content = [
      `# FinanceBot Export — ${dateStr}`,
      from && to ? `# Range: ${from} to ${to}` : '# Range: all-time',
      `# Expenses: ${expenses.length}  |  Incomes: ${incomes.length}`,
      '',
      '## EXPENSES',
      expCSV,
      '',
      '## INCOMES',
      incCSV,
      '',
    ].join('\n');
  }

  await writeFile(filepath, content, 'utf8');
  return `📁 Exported ${expenses.length} expenses + ${incomes.length} incomes → ${filepath}`;
}
