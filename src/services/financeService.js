import expenseModel from '../models/expense.js';
import incomeModel  from '../models/income.js';
import budgetModel  from '../models/budget.js';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function tableRow(cols, widths) {
  return cols.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' │ ');
}

function tableSep(widths) {
  return widths.map(w => '─'.repeat(w)).join('─┼─');
}

// ── FinanceService ────────────────────────────────────────────────────────────
class FinanceService {

  // ── Expense ─────────────────────────────────────────────────────────────
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
    const rows = await expenseModel.getAll(args);
    if (!rows.length) return '📭 No expenses found.';

    const widths = [24, 12, 16, 20, 10];
    const header = tableRow(['Name', 'Amount', 'Category', 'Date', 'ID (last 6)'], widths);
    const sep    = tableSep(widths);
    const lines  = rows.map(r =>
      tableRow([
        r.name,
        fmt(r.amount),
        r.category || 'General',
        r.createdAt.toLocaleDateString('en-IN'),
        String(r._id).slice(-6),
      ], widths)
    );
    return `\n📋 Expenses (${rows.length}):\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  async expenseCategoryBreakdown(args) {
    const rows = await expenseModel.getByCategory(args);
    if (!rows.length) return '📭 No expense data found.';

    const widths = [20, 14, 8, 14];
    const header = tableRow(['Category', 'Total', 'Count', 'Average'], widths);
    const sep    = tableSep(widths);
    const lines  = rows.map(r =>
      tableRow([r._id || 'General', fmt(r.total), r.count, fmt(r.avg)], widths)
    );
    return `\n📊 Expense by Category:\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  // ── Income ──────────────────────────────────────────────────────────────
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
    const rows = await incomeModel.getAll(args);
    if (!rows.length) return '📭 No income records found.';

    const widths = [24, 12, 16, 20, 10];
    const header = tableRow(['Name', 'Amount', 'Source', 'Date', 'ID (last 6)'], widths);
    const sep    = tableSep(widths);
    const lines  = rows.map(r =>
      tableRow([
        r.name,
        fmt(r.amount),
        r.source || 'Other',
        r.createdAt.toLocaleDateString('en-IN'),
        String(r._id).slice(-6),
      ], widths)
    );
    return `\n💰 Incomes (${rows.length}):\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  async incomeSouceBreakdown(args) {
    const rows = await incomeModel.getBySource(args);
    if (!rows.length) return '📭 No income data found.';

    const widths = [20, 14, 8, 14];
    const header = tableRow(['Source', 'Total', 'Count', 'Average'], widths);
    const sep    = tableSep(widths);
    const lines  = rows.map(r =>
      tableRow([r._id || 'Other', fmt(r.total), r.count, fmt(r.avg)], widths)
    );
    return `\n📊 Income by Source:\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  // ── Balance ─────────────────────────────────────────────────────────────
  async getMoneyBalance(args) {
    const [incData, expData] = await Promise.all([
      incomeModel.getTotal(args),
      expenseModel.getTotal(args),
    ]);
    const balance = incData.total - expData.total;
    const sign    = balance >= 0 ? '🟢' : '🔴';
    return (
      `\n💼 Financial Summary:\n` +
      `   Total Income  : ${fmt(incData.total)}\n` +
      `   Total Expense : ${fmt(expData.total)}\n` +
      `   ─────────────────────────\n` +
      `   ${sign} Balance     : ${fmt(balance)}\n`
    );
  }

  // ── Monthly Report ───────────────────────────────────────────────────────
  async getMonthlySummary({ year } = {}) {
    const y = year || new Date().getFullYear();
    const [expRows, incRows] = await Promise.all([
      expenseModel.getMonthlySummary({ year: y }),
      incomeModel.getMonthlySummary({ year: y }),
    ]);

    // Build a map month → { income, expense }
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

    const widths = [14, 14, 14, 14];
    const header = tableRow(['Month', 'Income', 'Expense', 'Balance'], widths);
    const sep    = tableSep(widths);
    const lines  = keys.map(k => {
      const d = map[k];
      const inc = d.income  ?? 0;
      const exp = d.expense ?? 0;
      return tableRow([
        `${MONTHS[d.month]} ${d.year}`,
        fmt(inc),
        fmt(exp),
        fmt(inc - exp),
      ], widths);
    });

    return `\n📅 Monthly Summary — ${y}:\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  // ── Budget ───────────────────────────────────────────────────────────────
  async setBudget(args) {
    return await budgetModel.set(args);
  }

  async checkBudget({ month } = {}) {
    const m = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const budget = await budgetModel.get({ month: m });
    if (!budget) return `⚠️  No budget set for ${m}. Use "set budget for ${m}" to set one.`;

    const start = `${m}-01`;
    const end   = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0)
                    .toISOString().split('T')[0];
    const { total: spent } = await expenseModel.getTotal({ from: start, to: end });

    const remaining = budget.amount - spent;
    const pct       = ((spent / budget.amount) * 100).toFixed(1);
    const status    = remaining >= 0 ? '🟢 Under budget' : '🔴 Over budget';

    return (
      `\n🎯 Budget Check — ${m}:\n` +
      `   Budget    : ${fmt(budget.amount)}\n` +
      `   Spent     : ${fmt(spent)} (${pct}%)\n` +
      `   Remaining : ${fmt(remaining)}\n` +
      `   Status    : ${status}\n`
    );
  }

  async deleteBudget(args) {
    return await budgetModel.delete(args);
  }

  async listBudgets() {
    const rows = await budgetModel.get({});
    if (!rows.length) return '📭 No budgets set.';

    const widths = [12, 16];
    const header = tableRow(['Month', 'Budget'], widths);
    const sep    = tableSep(widths);
    const lines  = rows.map(r => tableRow([r.month, fmt(r.amount)], widths));
    return `\n🎯 Budgets:\n${header}\n${sep}\n${lines.join('\n')}\n`;
  }

  // ── Search ───────────────────────────────────────────────────────────────
  async searchTransactions({ query, limit = 10 }) {
    if (!query) return '⚠️  Please provide a search query.';
    const [expenses, incomes] = await Promise.all([
      expenseModel.getAll({ search: query, limit }),
      incomeModel.getAll({ search: query, limit }),
    ]);

    let out = `\n🔍 Search results for "${query}":\n`;

    if (expenses.length) {
      out += `\n  Expenses (${expenses.length}):\n`;
      expenses.forEach(r => {
        out += `    • ${r.name} — ${fmt(r.amount)} [${r.category}] on ${r.createdAt.toLocaleDateString('en-IN')} (ID: ...${String(r._id).slice(-6)})\n`;
      });
    }
    if (incomes.length) {
      out += `\n  Incomes (${incomes.length}):\n`;
      incomes.forEach(r => {
        out += `    • ${r.name} — ${fmt(r.amount)} [${r.source}] on ${r.createdAt.toLocaleDateString('en-IN')} (ID: ...${String(r._id).slice(-6)})\n`;
      });
    }
    if (!expenses.length && !incomes.length) out += '  No results found.\n';

    return out;
  }

  // ── Full Report ──────────────────────────────────────────────────────────
  async getFullReport({ year } = {}) {
    const y = year || new Date().getFullYear();
    const [balance, monthly, catBreak, srcBreak] = await Promise.all([
      this.getMoneyBalance(),
      this.getMonthlySummary({ year: y }),
      this.expenseCategoryBreakdown(),
      this.incomeSouceBreakdown(),
    ]);

    return (
      `\n${'═'.repeat(60)}\n` +
      `  📑 FULL FINANCIAL REPORT — ${y}\n` +
      `${'═'.repeat(60)}\n` +
      balance + '\n' +
      monthly + '\n' +
      catBreak + '\n' +
      srcBreak +
      `\n${'═'.repeat(60)}\n`
    );
  }
}

export default new FinanceService();
