import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Converts an array of objects to a CSV string.
 * Handles nested objects by JSON-stringifying them.
 */
function toCSV(rows) {
  if (!rows.length) return '';

  // Collect all unique keys across all rows (some docs may have extra fields)
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== '_id');
  keys.unshift('id'); // put id first

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Wrap in quotes if contains comma, quote, or newline
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const header = keys.join(',');
  const lines  = rows.map(row => {
    return keys.map(k => {
      if (k === 'id') return escape(String(row._id ?? ''));
      return escape(row[k]);
    }).join(',');
  });

  return [header, ...lines].join('\n');
}

/**
 * Exports data to a file on the user's Desktop (or cwd as fallback).
 *
 * @param {{ expenses: object[], incomes: object[], format: 'csv'|'json', from?: string, to?: string }} opts
 * @returns {string} message with file path
 */
export async function exportData({ expenses, incomes, format = 'csv', from, to }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const range     = from && to ? `_${from}_to_${to}` : '';
  const filename  = `financebot_export${range}_${timestamp}.${format}`;

  // Try Desktop first, fall back to cwd
  let dir;
  try {
    dir = join(homedir(), 'Desktop');
  } catch {
    dir = process.cwd();
  }

  const filepath = join(dir, filename);

  let content;
  if (format === 'json') {
    content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        range: from && to ? { from, to } : 'all-time',
        expenses: expenses.map(r => ({ ...r, id: String(r._id), _id: undefined })),
        incomes:  incomes.map(r => ({ ...r, id: String(r._id), _id: undefined })),
      },
      null,
      2
    );
  } else {
    // CSV — two sections
    const expCSV = expenses.length ? `# EXPENSES\n${toCSV(expenses)}\n` : '# EXPENSES\n(none)\n';
    const incCSV = incomes.length  ? `# INCOMES\n${toCSV(incomes)}\n`   : '# INCOMES\n(none)\n';
    content = `# FinanceBot Export — ${new Date().toLocaleDateString('en-IN')}\n\n${expCSV}\n${incCSV}`;
  }

  await writeFile(filepath, content, 'utf8');
  return `📁 Exported to: ${filepath}`;
}
