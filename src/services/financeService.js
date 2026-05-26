/**
 * FinanceService — Fix 1: userId injected into every model call.
 * Feature 1: getProfile()
 * Feature 2: changePassword()
 * Feature 3: deleteAccount()
 */
import expenseModel   from '../models/expense.js';
import incomeModel    from '../models/income.js';
import budgetModel    from '../models/budget.js';
import recurringModel from '../models/recurring.js';
import authService    from './authService.js';
import userModel      from '../models/user.js';
import { exportData } from '../utils/exporter.js';
import { monthToDateRange } from '../utils/validators.js';

// ── Month name lookup ─────────────────────────────────────────────────────────
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d, fallback) {
  const target = d || fallback;
  if (!target) return '—';
  return new Date(target).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pad(str, width) {
  const s = String(str ?? '');
  if (s.length > width) return s.slice(0, width - 1) + '…';
  return s.padEnd(width);
}

function row(cols, widths) {
  return cols.map((c, i) => pad(c, widths[i])).join(' │ ');
}

function sep(widths) {
  return widths.map(w => '─'.repeat(w)).join('─┼─');
}

function table(headers, widths, dataRows) {
  return [row(headers, widths), sep(widths), ...dataRows.map(cols => row(cols, widths))].join('\n');
}

function progressBar(pct, width = 20) {
  const filled = Math.round(Math.min(pct, 100) / 100 * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${pct.toFixed(1)}%`;
}

// ── FinanceService ────────────────────────────────────────────────────────────
class FinanceService {

  // ════════════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ════════════════════════════════════════════════════════════════════════════

  async addExpense(args) {
    return await expenseModel.add(args);
  }

  async deleteExpense(args) {
    return await expenseModel.delete(args);
  }

  async updateExpense(args) {
    return await expenseModel.update(args);
  }

  async getTotalExpense(args) {
    const { total, count } = await expenseModel.getTotal(args);
    const range = args?.from && args?.to ? ` (${args.from} → ${args.to})` : '';
    return `📊 Total Expenses${range}: ${fmt(total)} across ${count} transaction(s).`;
  }

  async listExpenses(args) {
    const { rows, total, page, limit } = await expenseModel.getAll(args);
    if (!rows.length) return '📭 No expenses found matching your criteria.';

    const widths  = [22, 12, 14, 12, 8];
    const headers = ['Name', 'Amount', 'Category', 'Date', 'ID…'];
    const data    = rows.map(r => [
      r.name, fmt(r.amount), r.category || 'General',
      fmtDate(r.date, r.createdAt), String(r._id).slice(-6),
    ]);

    const totalPages = Math.ceil(total / limit);
    const pagination = totalPages > 1
      ? `  Page ${page}/${totalPages} — showing ${rows.length} of ${total} records\n` : '';

    return `\n📋 Expenses (${rows.length} shown, ${total} total):\n${table(headers, widths, data)}\n${pagination}`;
  }

  async expenseCategoryBreakdown(args) {
    const rows = await expenseModel.getByCategory(args);
    if (!rows.length) return '📭 No expense data found.';

    const widths  = [18, 14, 7, 14, 14];
    const headers = ['Category', 'Total', 'Count', 'Average', 'Max'];
    const data    = rows.map(r => [r._id || 'General', fmt(r.total), r.count, fmt(r.avg), fmt(r.max)]);
    return `\n📊 Expense by Category:\n${table(headers, widths, data)}\n`;
  }

  async getTopExpenses(args) {
    const rows = await expenseModel.getTopExpenses(args);
    if (!rows.length) return '📭 No expenses found.';

    const widths  = [22, 12, 14, 12];
    const headers = ['Name', 'Amount', 'Category', 'Date'];
    const data    = rows.map(r => [r.name, fmt(r.amount), r.category || 'General', fmtDate(r.date, r.createdAt)]);
    return `\n🏆 Top Expenses:\n${table(headers, widths, data)}\n`;
  }

  async getExpenseById(args) {
    const r = await expenseModel.getById(args);
    return (
      `\n📄 Expense Detail:\n` +
      `   ID          : ${r._id}\n` +
      `   Name        : ${r.name}\n` +
      `   Amount      : ${fmt(r.amount)}\n` +
      `   Category    : ${r.category || 'General'}\n` +
      `   Date        : ${fmtDate(r.date, r.createdAt)}\n` +
      `   Description : ${r.description || '—'}\n` +
      `   Created     : ${fmtDate(r.createdAt)}\n` +
      (r.updatedAt ? `   Updated     : ${fmtDate(r.updatedAt)}\n` : '')
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INCOME
  // ════════════════════════════════════════════════════════════════════════════

  async addIncome(args) {
    return await incomeModel.add(args);
  }

  async deleteIncome(args) {
    return await incomeModel.delete(args);
  }

  async updateIncome(args) {
    return await incomeModel.update(args);
  }

  async getTotalIncome(args) {
    const { total, count } = await incomeModel.getTotal(args);
    const range = args?.from && args?.to ? ` (${args.from} → ${args.to})` : '';
    return `📊 Total Income${range}: ${fmt(total)} across ${count} transaction(s).`;
  }

  async listIncomes(args) {
    const { rows, total, page, limit } = await incomeModel.getAll(args);
    if (!rows.length) return '📭 No income records found matching your criteria.';

    const widths  = [22, 12, 14, 12, 8];
    const headers = ['Name', 'Amount', 'Source', 'Date', 'ID…'];
    const data    = rows.map(r => [
      r.name, fmt(r.amount), r.source || 'Other',
      fmtDate(r.date, r.createdAt), String(r._id).slice(-6),
    ]);

    const totalPages = Math.ceil(total / limit);
    const pagination = totalPages > 1
      ? `  Page ${page}/${totalPages} — showing ${rows.length} of ${total} records\n` : '';

    return `\n💰 Incomes (${rows.length} shown, ${total} total):\n${table(headers, widths, data)}\n${pagination}`;
  }

  async incomeSourceBreakdown(args) {
    const rows = await incomeModel.getBySource(args);
    if (!rows.length) return '📭 No income data found.';

    const widths  = [18, 14, 7, 14, 14];
    const headers = ['Source', 'Total', 'Count', 'Average', 'Max'];
    const data    = rows.map(r => [r._id || 'Other', fmt(r.total), r.count, fmt(r.avg), fmt(r.max)]);
    return `\n📊 Income by Source:\n${table(headers, widths, data)}\n`;
  }

  async getIncomeById(args) {
    const r = await incomeModel.getById(args);
    return (
      `\n📄 Income Detail:\n` +
      `   ID          : ${r._id}\n` +
      `   Name        : ${r.name}\n` +
      `   Amount      : ${fmt(r.amount)}\n` +
      `   Source      : ${r.source || 'Other'}\n` +
      `   Date        : ${fmtDate(r.date, r.createdAt)}\n` +
      `   Description : ${r.description || '—'}\n` +
      `   Created     : ${fmtDate(r.createdAt)}\n` +
      (r.updatedAt ? `   Updated     : ${fmtDate(r.updatedAt)}\n` : '')
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BALANCE & ANALYTICS
  // ════════════════════════════════════════════════════════════════════════════

  async getMoneyBalance(args) {
    const [incData, expData] = await Promise.all([
      incomeModel.getTotal(args),
      expenseModel.getTotal(args),
    ]);
    const balance     = incData.total - expData.total;
    const sign        = balance >= 0 ? '🟢' : '🔴';
    const savingsRate = incData.total > 0 ? ((balance / incData.total) * 100).toFixed(1) : '0.0';
    const range       = args?.from && args?.to ? ` (${args.from} → ${args.to})` : '';

    return (
      `\n💼 Financial Summary${range}:\n` +
      `   Total Income   : ${fmt(incData.total)}  (${incData.count} transactions)\n` +
      `   Total Expenses : ${fmt(expData.total)}  (${expData.count} transactions)\n` +
      `   ─────────────────────────────────────\n` +
      `   ${sign} Net Balance   : ${fmt(balance)}\n` +
      `   📈 Savings Rate : ${savingsRate}%\n`
    );
  }

  async getSavingsRate(args) {
    const [incData, expData] = await Promise.all([
      incomeModel.getTotal(args),
      expenseModel.getTotal(args),
    ]);
    const balance     = incData.total - expData.total;
    const savingsRate = incData.total > 0 ? ((balance / incData.total) * 100).toFixed(1) : '0.0';
    const range       = args?.from && args?.to ? ` (${args.from} → ${args.to})` : '';

    return (
      `\n📈 Savings Rate${range}:\n` +
      `   Income  : ${fmt(incData.total)}\n` +
      `   Saved   : ${fmt(balance)}\n` +
      `   Rate    : ${savingsRate}%\n` +
      `   ${progressBar(Number(savingsRate))}\n`
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ════════════════════════════════════════════════════════════════════════════

  async getMonthlySummary(args = {}) {
    const y = args.year || new Date().getFullYear();
    const userId = args.userId;
    const [expRows, incRows] = await Promise.all([
      expenseModel.getMonthlySummary({ userId, year: y }),
      incomeModel.getMonthlySummary({ userId, year: y }),
    ]);

    const map = {};
    for (const r of incRows) {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      map[key] = { ...map[key], income: r.total, month: r._id.month, year: r._id.year };
    }
    for (const r of expRows) {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      map[key] = { ...map[key], expense: r.total, month: r._id.month, year: r._id.year };
    }

    const keys = Object.keys(map).sort();
    if (!keys.length) return `📭 No transactions found for ${y}.`;

    const widths  = [16, 14, 14, 14];
    const headers = ['Month', 'Income', 'Expense', 'Balance'];
    const data    = keys.map(k => {
      const d = map[k];
      const inc = d.income ?? 0, exp = d.expense ?? 0;
      return [`${MONTH_NAMES[d.month]} ${d.year}`, fmt(inc), fmt(exp), fmt(inc - exp)];
    });

    const totInc = keys.reduce((s, k) => s + (map[k].income  ?? 0), 0);
    const totExp = keys.reduce((s, k) => s + (map[k].expense ?? 0), 0);
    data.push(['─'.repeat(16), '─'.repeat(14), '─'.repeat(14), '─'.repeat(14)]);
    data.push(['TOTAL', fmt(totInc), fmt(totExp), fmt(totInc - totExp)]);

    return `\n📅 Monthly Summary — ${y}:\n${table(headers, widths, data)}\n`;
  }

  async getFullReport(args = {}) {
    const y    = args.year || new Date().getFullYear();
    const from = `${y}-01-01`, to = `${y}-12-31`;
    const uid  = args.userId;

    const [balance, monthly, catBreak, srcBreak, topExp] = await Promise.all([
      this.getMoneyBalance({ userId: uid, from, to }),
      this.getMonthlySummary({ userId: uid, year: y }),
      this.expenseCategoryBreakdown({ userId: uid, from, to }),
      this.incomeSourceBreakdown({ userId: uid, from, to }),
      this.getTopExpenses({ userId: uid, from, to, limit: 5 }),
    ]);

    const line = '═'.repeat(62);
    return `\n${line}\n  📑  FULL FINANCIAL REPORT — ${y}\n${line}\n${balance}\n${monthly}\n${catBreak}\n${srcBreak}\n${topExp}\n${line}\n`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BUDGET
  // ════════════════════════════════════════════════════════════════════════════

  async setBudget(args) {
    return await budgetModel.set(args);
  }

  async checkBudget(args = {}) {
    const now = new Date();
    const m   = args.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const budget = await budgetModel.get({ userId: args.userId, month: m });
    if (!budget) return `⚠️  No budget set for ${m}.\n   Tip: "Set budget ₹20000 for ${m}"`;

    const { from, to }     = monthToDateRange(m);
    const { total: spent } = await expenseModel.getTotal({ userId: args.userId, from, to });

    const remaining = budget.amount - spent;
    const pct       = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    const alertAt   = budget.alertAt ?? 80;
    const status    = pct >= 100 ? '🔴 Over budget'
                    : pct >= alertAt ? `🟡 Warning — past ${alertAt}% threshold`
                    : '🟢 Under budget';

    return (
      `\n🎯 Budget Check — ${m}:\n` +
      `   Budget    : ${fmt(budget.amount)}\n` +
      `   Spent     : ${fmt(spent)}\n` +
      `   Remaining : ${fmt(remaining)}\n` +
      `   Progress  : ${progressBar(pct)}\n` +
      `   Status    : ${status}\n`
    );
  }

  async deleteBudget(args) {
    return await budgetModel.delete(args);
  }

  async listBudgets(args) {
    const rows = await budgetModel.get(args);
    if (!rows.length) return '📭 No budgets set.';

    const widths  = [10, 16, 10];
    const headers = ['Month', 'Budget', 'Alert At'];
    const data    = rows.map(r => [r.month, fmt(r.amount), `${r.alertAt ?? 80}%`]);
    return `\n🎯 Monthly Budgets:\n${table(headers, widths, data)}\n`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RECURRING TRANSACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  async addRecurring(args) {
    return await recurringModel.add(args);
  }

  async listRecurring(args) {
    const rows = await recurringModel.list(args);
    if (!rows.length) return '📭 No recurring transactions set up.';

    const widths  = [20, 10, 10, 12, 12];
    const headers = ['Name', 'Amount', 'Type', 'Frequency', 'Next Due'];
    const data    = rows.map(r => [r.name, fmt(r.amount), r.type, r.frequency, fmtDate(r.nextDue)]);
    return `\n🔁 Recurring Transactions:\n${table(headers, widths, data)}\n`;
  }

  async getDueRecurring(args) {
    const rows = await recurringModel.getDue(args.userId);
    if (!rows.length) return '✅ No recurring transactions are due right now.';

    const widths  = [20, 10, 10, 12, 26];
    const headers = ['Name', 'Amount', 'Type', 'Frequency', 'Full ID'];
    const data    = rows.map(r => [r.name, fmt(r.amount), r.type, r.frequency, String(r._id)]);

    return (
      `\n⏰ Due Recurring Transactions (${rows.length}):\n` +
      `${table(headers, widths, data)}\n` +
      `\n  Tip: Say "post recurring <Full ID>" to record one as a transaction.\n`
    );
  }

  async postRecurring(args) {
    const rec = await recurringModel.findById(args.userId, args.id);
    if (!rec) return `❌ Recurring item "${args.id}" not found. Use "list recurring" to see IDs.`;

    let result;
    if (rec.type === 'expense') {
      result = await expenseModel.add({
        userId:      args.userId,
        name:        rec.name,
        amount:      rec.amount,
        category:    rec.category,
        description: `Auto-posted from recurring (${rec.frequency})`,
      });
    } else {
      result = await incomeModel.add({
        userId:      args.userId,
        name:        rec.name,
        amount:      rec.amount,
        source:      rec.source,
        description: `Auto-posted from recurring (${rec.frequency})`,
      });
    }

    const nextDue = await recurringModel.markPosted(String(rec._id));
    return `${result}\n🔁 Next due: ${fmtDate(nextDue)}`;
  }

  async deactivateRecurring(args) {
    return await recurringModel.deactivate(args.userId, args.id);
  }

  async reactivateRecurring(args) {
    return await recurringModel.reactivate(args.userId, args.id);
  }

  async updateRecurring(args) {
    return await recurringModel.update(args);
  }

  async deleteRecurring(args) {
    return await recurringModel.delete(args.userId, args.id);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ════════════════════════════════════════════════════════════════════════════

  async searchTransactions(args) {
    if (!args.query?.trim()) return '⚠️  Please provide a search query.';

    const [expResult, incResult] = await Promise.all([
      expenseModel.getAll({ userId: args.userId, search: args.query, limit: args.limit || 10 }),
      incomeModel.getAll({ userId: args.userId, search: args.query, limit: args.limit || 10 }),
    ]);

    const expenses = expResult.rows;
    const incomes  = incResult.rows;

    if (!expenses.length && !incomes.length) return `🔍 No results found for "${args.query}".`;

    let out = `\n🔍 Search results for "${args.query}":\n`;
    if (expenses.length) {
      out += `\n  Expenses (${expenses.length}):\n`;
      expenses.forEach(r => {
        out += `    • ${r.name} — ${fmt(r.amount)} [${r.category || 'General'}] on ${fmtDate(r.date, r.createdAt)}  ID: ${r._id}\n`;
      });
    }
    if (incomes.length) {
      out += `\n  Incomes (${incomes.length}):\n`;
      incomes.forEach(r => {
        out += `    • ${r.name} — ${fmt(r.amount)} [${r.source || 'Other'}] on ${fmtDate(r.date, r.createdAt)}  ID: ${r._id}\n`;
      });
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════════════════════════

  async exportTransactions(args) {
    const [expenses, incomes] = await Promise.all([
      expenseModel.exportAll({ userId: args.userId, from: args.from, to: args.to }),
      incomeModel.exportAll({ userId: args.userId, from: args.from, to: args.to }),
    ]);

    if (!expenses.length && !incomes.length) return '📭 No transactions to export.';
    return await exportData({ expenses, incomes, format: args.format || 'csv', from: args.from, to: args.to });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROFILE (Feature 1)
  // ════════════════════════════════════════════════════════════════════════════

  async getProfile(args) {
    const user = await userModel.findById(String(args.userId));
    if (!user) return '❌ User not found.';

    const [expCount, incCount] = await Promise.all([
      expenseModel.countByUser(args.userId),
      incomeModel.countByUser(args.userId),
    ]);

    return (
      `\n👤 Your Profile:\n` +
      `   Name            : ${user.name}\n` +
      `   Email           : ${user.email}\n` +
      `   Account created : ${fmtDate(user.createdAt)}\n` +
      `   Total expenses  : ${expCount} transaction(s)\n` +
      `   Total incomes   : ${incCount} transaction(s)\n`
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD (Feature 2)
  // ════════════════════════════════════════════════════════════════════════════

  async changePassword(args) {
    return await authService.changePassword(args);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE ACCOUNT (Feature 3)
  // ════════════════════════════════════════════════════════════════════════════

  async deleteAccount(args) {
    return await authService.deleteAccount(args);
  }
}

export default new FinanceService();
