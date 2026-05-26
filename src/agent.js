/**
 * FinanceBot — AI-powered personal finance terminal assistant
 *
 * Fix 1:  userId injected into every tool call from the authenticated session.
 * Fix 4:  Ctrl+C in readPassword now triggers graceful shutdown via global handler.
 * Feature 5: Auto-post due recurring transactions on startup.
 */

import readline from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';

import dbConnection    from './config/database.js';
import redisClient     from './config/redis.js';
import expenseModel    from './models/expense.js';
import incomeModel     from './models/income.js';
import budgetModel     from './models/budget.js';
import recurringModel  from './models/recurring.js';
import userModel       from './models/user.js';
import groqService     from './services/groqService.js';
import financeService  from './services/financeService.js';
import { toolDefinitions } from './utils/toolDefinitions.js';
import { runAuthGate, runLogout } from './utils/authCLI.js';
import { loadSession } from './utils/sessionStore.js';

// ── Force UTF-8 output on Windows ────────────────────────────────────────────
if (process.platform === 'win32') {
  try {
    const { execSync } = await import('node:child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch { /* non-critical */ }
  if (stdout.setDefaultEncoding) stdout.setDefaultEncoding('utf8');
  if (process.stderr.setDefaultEncoding) process.stderr.setDefaultEncoding('utf8');
}

// ── Guards ────────────────────────────────────────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  console.error('\n❌  GROQ_API_KEY is not set in your .env file.');
  console.error('    Copy .env.example → .env and add your key.\n');
  exit(1);
}
if (!process.env.PASETO_SECRET_KEY) {
  console.error('\n❌  PASETO_SECRET_KEY is not set in your .env file.');
  console.error('    Generate one — see .env.example for the command.\n');
  exit(1);
}

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
};
const clr  = (color, text) => `${C[color]}${text}${C.reset}`;
const bold = (text)         => `${C.bold}${text}${C.reset}`;
const dim  = (text)         => `${C.dim}${text}${C.reset}`;

// ── UI helpers ────────────────────────────────────────────────────────────────
function printBanner() {
  const line = clr('cyan', '═'.repeat(58));
  console.log(`\n${line}`);
  console.log(clr('cyan', '║') + bold('       💰  FinanceBot  —  Personal Finance AI          ') + clr('cyan', '║'));
  console.log(`${line}`);
  console.log(dim('  Groq LLaMA-3.3-70b  ·  MongoDB  ·  Redis  ·  INR ₹\n'));
}

function printHelp() {
  const line = clr('yellow', '─'.repeat(58));
  const sec  = (t) => clr('green', `\n  ${t}`);
  const ex   = (t) => `    ${dim('›')} ${t}`;

  console.log(`\n${line}`);
  console.log(bold('  📖  What you can ask FinanceBot'));
  console.log(line);

  console.log(sec('Expenses'));
  console.log(ex('Add expense 500 for groceries (category: Food)'));
  console.log(ex('Add expense 1200 for Uber on 2025-05-10'));
  console.log(ex('Show all expenses this month'));
  console.log(ex('Total expenses in April 2025'));
  console.log(ex('Expense breakdown by category'));
  console.log(ex('Top 5 expenses this year'));
  console.log(ex('Show details of expense <id>'));
  console.log(ex('Update expense <id> amount to 600'));
  console.log(ex('Delete expense <id>'));

  console.log(sec('Income'));
  console.log(ex('Add income 50000 salary (source: Salary)'));
  console.log(ex('Show all incomes'));
  console.log(ex('Income breakdown by source'));
  console.log(ex('Total income this year'));
  console.log(ex('Show details of income <id>'));
  console.log(ex('Update income <id> source to Freelance'));
  console.log(ex('Delete income <id>'));

  console.log(sec('Balance & Analytics'));
  console.log(ex('What is my balance?'));
  console.log(ex('Balance for January 2025'));
  console.log(ex('What is my savings rate this month?'));
  console.log(ex('Monthly summary for 2025'));
  console.log(ex('Full financial report'));

  console.log(sec('Budget'));
  console.log(ex('Set budget ₹20000 for 2025-05'));
  console.log(ex('Set budget 15000 for 2025-06 with 75% alert'));
  console.log(ex('Check budget for this month'));
  console.log(ex('List all budgets'));
  console.log(ex('Delete budget for 2025-04'));

  console.log(sec('Recurring Transactions'));
  console.log(ex('Add recurring expense 12000 rent monthly'));
  console.log(ex('Add recurring income 50000 salary monthly'));
  console.log(ex('List recurring transactions'));
  console.log(ex('Show due recurring transactions'));
  console.log(ex('Post recurring <id>'));
  console.log(ex('Update recurring <id> amount to 13000'));
  console.log(ex('Reactivate recurring <id>'));
  console.log(ex('Deactivate recurring <id>'));

  console.log(sec('Search & Export'));
  console.log(ex('Search transactions for "amazon"'));
  console.log(ex('Export all transactions as CSV'));
  console.log(ex('Export transactions from 2025-01-01 to 2025-05-31 as JSON'));

  console.log(sec('Account'));
  console.log(ex('Show my profile / who am I'));
  console.log(ex('Change my password'));
  console.log(ex('Delete my account'));

  console.log(`\n${dim('  Commands: "help" · "clear" · "logout" · "bye" / "exit" / "quit"')}`);
  console.log(`${line}\n`);
}

// ── FinanceBotApp ─────────────────────────────────────────────────────────────
class FinanceBotApp {
  constructor() {
    this.rl           = null;
    this.history      = [];
    this.currentUser  = null;
    this.sessionToken = null;
  }

  // ── System prompt ────────────────────────────────────────────────────────
  get systemMessage() {
    const today    = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const year     = new Date().getFullYear();
    const userName = this.currentUser?.name || 'User';

    return {
      role: 'system',
      content: `You are FinanceBot, a smart and friendly personal finance assistant for Indian users.
Currency is always INR (₹). Today's date is ${today}.
The logged-in user's name is ${userName}.

Available tools:
  EXPENSE:   addExpense, deleteExpense, updateExpense, getTotalExpense, listExpenses, expenseCategoryBreakdown, getTopExpenses, getExpenseById
  INCOME:    addIncome, deleteIncome, updateIncome, getTotalIncome, listIncomes, incomeSourceBreakdown, getIncomeById
  ANALYTICS: getMoneyBalance, getSavingsRate, getMonthlySummary, getFullReport
  BUDGET:    setBudget, checkBudget, deleteBudget, listBudgets
  RECURRING: addRecurring, listRecurring, getDueRecurring, postRecurring, updateRecurring, deactivateRecurring, reactivateRecurring, deleteRecurring
  SEARCH:    searchTransactions
  EXPORT:    exportTransactions
  ACCOUNT:   getProfile, changePassword, deleteAccount

Strict rules:
1. ALWAYS call the appropriate tool to answer finance questions. Never invent or guess numbers.
2. When the user says "this month", compute the correct YYYY-MM-DD date range using today's date above.
3. When the user says "this year", use ${year}-01-01 to ${year}-12-31.
4. For delete/update operations, if no ID is given, first call listExpenses or listIncomes so the user can identify the record.
5. Show tool output verbatim — do not paraphrase tables or numbers.
6. Keep conversational replies concise. Use ₹ for all amounts.
7. If asked something unrelated to personal finance, politely decline and redirect.
8. When a user adds a past transaction, use the date field — do not default to today.
9. To show full details of one record, use getExpenseById or getIncomeById with the full ID.
10. NEVER include userId in tool arguments — it is injected automatically.`,
    };
  }

  // ── Initialise DB and models ──────────────────────────────────────────────
  async initialize() {
    await dbConnection.connect();
    await dbConnection.initializeCollections();
    await redisClient.connect();
    expenseModel.initialize();
    incomeModel.initialize();
    budgetModel.initialize();
    recurringModel.initialize();
    userModel.initialize();
  }

  // ── Fix 1: inject userId into every tool call ─────────────────────────────
  _withUser(args) {
    return { ...args, userId: this.currentUser._id };
  }

  // ── Dispatch tool calls ───────────────────────────────────────────────────
  async handleToolCall(toolCall) {
    const { name: fn, arguments: rawArgs } = toolCall.function;

    let args = {};
    try {
      args = JSON.parse(rawArgs || '{}');
    } catch {
      return `❌ Could not parse arguments for tool "${fn}".`;
    }

    // Inject userId for every call — LLM never sends it
    const a = this._withUser(args);

    try {
      switch (fn) {
        // ── Expense ────────────────────────────────────────────────────────
        case 'addExpense':               return await financeService.addExpense(a);
        case 'deleteExpense':            return await financeService.deleteExpense(a);
        case 'updateExpense':            return await financeService.updateExpense(a);
        case 'getTotalExpense':          return await financeService.getTotalExpense(a);
        case 'listExpenses':             return await financeService.listExpenses(a);
        case 'expenseCategoryBreakdown': return await financeService.expenseCategoryBreakdown(a);
        case 'getTopExpenses':           return await financeService.getTopExpenses(a);
        case 'getExpenseById':           return await financeService.getExpenseById(a);

        // ── Income ─────────────────────────────────────────────────────────
        case 'addIncome':                return await financeService.addIncome(a);
        case 'deleteIncome':             return await financeService.deleteIncome(a);
        case 'updateIncome':             return await financeService.updateIncome(a);
        case 'getTotalIncome':           return await financeService.getTotalIncome(a);
        case 'listIncomes':              return await financeService.listIncomes(a);
        case 'incomeSourceBreakdown':    return await financeService.incomeSourceBreakdown(a);
        case 'getIncomeById':            return await financeService.getIncomeById(a);

        // ── Analytics ──────────────────────────────────────────────────────
        case 'getMoneyBalance':          return await financeService.getMoneyBalance(a);
        case 'getSavingsRate':           return await financeService.getSavingsRate(a);
        case 'getMonthlySummary':        return await financeService.getMonthlySummary(a);
        case 'getFullReport':            return await financeService.getFullReport(a);

        // ── Budget ─────────────────────────────────────────────────────────
        case 'setBudget':                return await financeService.setBudget(a);
        case 'checkBudget':              return await financeService.checkBudget(a);
        case 'deleteBudget':             return await financeService.deleteBudget(a);
        case 'listBudgets':              return await financeService.listBudgets(a);

        // ── Recurring ──────────────────────────────────────────────────────
        case 'addRecurring':             return await financeService.addRecurring(a);
        case 'listRecurring':            return await financeService.listRecurring(a);
        case 'getDueRecurring':          return await financeService.getDueRecurring(a);
        case 'postRecurring':            return await financeService.postRecurring(a);
        case 'deactivateRecurring':      return await financeService.deactivateRecurring(a);
        case 'reactivateRecurring':      return await financeService.reactivateRecurring(a);
        case 'updateRecurring':          return await financeService.updateRecurring(a);
        case 'deleteRecurring':          return await financeService.deleteRecurring(a);

        // ── Search & Export ────────────────────────────────────────────────
        case 'searchTransactions':       return await financeService.searchTransactions(a);
        case 'exportTransactions':       return await financeService.exportTransactions(a);

        // ── Account (Feature 1, 2, 3) ──────────────────────────────────────
        case 'getProfile':
          return await financeService.getProfile(a);

        case 'changePassword':
          // Pass session token so it can be blacklisted after password change
          return await financeService.changePassword({ ...a, token: this.sessionToken });

        case 'deleteAccount':
          return await financeService.deleteAccount({ ...a, token: this.sessionToken });

        default:
          return `⚠️  Unknown tool called: "${fn}". This is a bug — please report it.`;
      }
    } catch (err) {
      return `❌ ${fn} failed: ${err.message}`;
    }
  }

  // ── Agentic turn ──────────────────────────────────────────────────────────
  async runTurn(userInput) {
    this.history.push({ role: 'user', content: userInput });

    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }

    while (true) {
      let response;
      try {
        response = await groqService.createChatCompletion(
          [this.systemMessage, ...this.history],
          toolDefinitions
        );
      } catch (err) {
        console.error(clr('red', `\n❌ Groq API error: ${err.message}\n`));
        this.history.pop();
        return;
      }

      const message   = response.choices[0].message;
      const toolCalls = message.tool_calls;
      this.history.push(message);

      if (!toolCalls || toolCalls.length === 0) {
        const text = message.content?.trim();
        if (text) console.log('\n' + clr('green', 'FinanceBot') + clr('dim', ' ›') + ' ' + text + '\n');
        return;
      }

      for (const toolCall of toolCalls) {
        stdout.write(clr('dim', `  ⚙  ${toolCall.function.name}…`) + '\r');
        const output = await this.handleToolCall(toolCall);
        stdout.write(' '.repeat(50) + '\r');
        this.history.push({ role: 'tool', content: String(output), tool_call_id: toolCall.id });
      }
    }
  }

  // ── Feature 5: Auto-post due recurring transactions on startup ────────────
  async autoPostDueRecurring() {
    try {
      const userId = this.currentUser._id;
      const due    = await recurringModel.getDue(userId);
      if (!due.length) return;

      // Only auto-post items not already posted today
      const today     = new Date();
      today.setHours(0, 0, 0, 0);
      const toPost    = due.filter(r => !r.lastPosted || new Date(r.lastPosted) < today);

      if (!toPost.length) {
        console.log(clr('dim', `\n  ⏰  ${due.length} recurring item(s) due but already posted today.\n`));
        return;
      }

      console.log(clr('yellow', `\n  ⏰  Auto-posting ${toPost.length} due recurring transaction(s)…`));

      let posted = 0;
      for (const rec of toPost) {
        try {
          if (rec.type === 'expense') {
            await expenseModel.add({
              userId,
              name:        rec.name,
              amount:      rec.amount,
              category:    rec.category,
              description: `Auto-posted from recurring (${rec.frequency})`,
            });
          } else {
            await incomeModel.add({
              userId,
              name:        rec.name,
              amount:      rec.amount,
              source:      rec.source,
              description: `Auto-posted from recurring (${rec.frequency})`,
            });
          }
          await recurringModel.markPosted(String(rec._id));
          console.log(clr('green', `     ✅  ${rec.name} — ₹${rec.amount} (${rec.frequency})`));
          posted++;
        } catch (err) {
          console.log(clr('red', `     ❌  ${rec.name} failed: ${err.message}`));
        }
      }

      console.log(clr('green', `\n  ✅  Auto-posted ${posted}/${toPost.length} recurring transaction(s).\n`));
    } catch {
      // Non-critical — silently ignore
    }
  }

  // ── Main chat loop ────────────────────────────────────────────────────────
  async startChatLoop() {
    this.rl = readline.createInterface({ input: stdin, output: stdout });

    // Fix 4: expose shutdown so authCLI's Ctrl+C handler can call it
    // The global SIGINT handler below already covers this — authCLI emits SIGINT
    this.currentUser  = await runAuthGate(this.rl);
    this.sessionToken = await loadSession();

    printBanner();
    printHelp();

    // Feature 5: auto-post due recurring items right after login
    await this.autoPostDueRecurring();

    while (true) {
      let raw;
      try {
        raw = await this.rl.question(clr('cyan', 'You') + clr('dim', ' › '));
      } catch {
        break; // readline closed (Ctrl+D)
      }

      const input = raw.trim();
      if (!input) continue;

      const lower = input.toLowerCase();

      if (['bye', 'exit', 'quit'].includes(lower)) {
        console.log(clr('green', '\n👋  Goodbye! Stay financially healthy.\n'));
        break;
      }

      if (lower === 'logout') {
        if (this.sessionToken) {
          await runLogout(this.sessionToken);
          this.sessionToken = null;
        }
        console.log(clr('yellow', '\n  Logged out. Restart the app to log in again.\n'));
        break;
      }

      if (lower === 'help')  { printHelp(); continue; }
      if (lower === 'clear') { console.clear(); printBanner(); continue; }

      await this.runTurn(input);
    }

    this.rl.close();
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  async shutdown() {
    try { this.rl?.close(); } catch { /* ignore */ }
    await redisClient.close();
    await dbConnection.close();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const app = new FinanceBotApp();

  // Fix 4: SIGINT handler is registered BEFORE the auth gate starts.
  // authCLI's readPassword calls process.exit(0) on Ctrl+C which triggers this.
  const onSignal = async (signal) => {
    console.log(clr('yellow', `\n\n  Received ${signal} — shutting down…`));
    await app.shutdown();
    exit(0);
  };
  process.on('SIGINT',  () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  try {
    await app.initialize();
    await app.startChatLoop();
  } catch (err) {
    console.error(clr('red', `\n❌  Fatal error: ${err.message}`));
    if (process.env.NODE_ENV === 'development') console.error(err.stack);
    exit(1);
  } finally {
    await app.shutdown();
  }
}

main();
