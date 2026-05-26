/**
 * FinanceBot — AI-powered personal finance terminal assistant
 * Entry point: src/agent.js
 */

import readline from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';

import dbConnection    from './config/database.js';
import expenseModel    from './models/expense.js';
import incomeModel     from './models/income.js';
import budgetModel     from './models/budget.js';
import recurringModel  from './models/recurring.js';
import groqService     from './services/groqService.js';
import financeService  from './services/financeService.js';
import { toolDefinitions } from './utils/toolDefinitions.js';

// ── Force UTF-8 output on Windows (fixes box-drawing characters in cmd/PS) ───
if (process.platform === 'win32') {
  try {
    const { execSync } = await import('node:child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch { /* non-critical */ }
  // Also set stdout/stderr encoding
  if (stdout.setDefaultEncoding) stdout.setDefaultEncoding('utf8');
  if (process.stderr.setDefaultEncoding) process.stderr.setDefaultEncoding('utf8');
}

// ── Guard: fail fast if API key is missing ────────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  console.error('\n❌  GROQ_API_KEY is not set in your .env file.');
  console.error('    Copy .env.example → .env and add your key.\n');
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
  console.log(dim('  Groq LLaMA-3.3-70b  ·  MongoDB  ·  Node.js  ·  INR ₹\n'));
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

  console.log(`\n${dim('  Commands: "help" · "clear" · "bye" / "exit" / "quit"')}`);
  console.log(`${line}\n`);
}

// ── FinanceBotApp ─────────────────────────────────────────────────────────────
class FinanceBotApp {
  constructor() {
    this.rl = null;
    // Conversation history (excludes system message — injected fresh per call)
    this.history = [];
  }

  // ── System prompt (rebuilt each turn so the date is always current) ─────
  get systemMessage() {
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const year = new Date().getFullYear();

    return {
      role: 'system',
      content: `You are FinanceBot, a smart and friendly personal finance assistant for Indian users.
Currency is always INR (₹). Today's date is ${today}.

Available tools:
  EXPENSE:   addExpense, deleteExpense, updateExpense, getTotalExpense, listExpenses, expenseCategoryBreakdown, getTopExpenses, getExpenseById
  INCOME:    addIncome, deleteIncome, updateIncome, getTotalIncome, listIncomes, incomeSourceBreakdown, getIncomeById
  ANALYTICS: getMoneyBalance, getSavingsRate, getMonthlySummary, getFullReport
  BUDGET:    setBudget, checkBudget, deleteBudget, listBudgets
  RECURRING: addRecurring, listRecurring, getDueRecurring, postRecurring, updateRecurring, deactivateRecurring, reactivateRecurring, deleteRecurring
  SEARCH:    searchTransactions
  EXPORT:    exportTransactions

Strict rules:
1. ALWAYS call the appropriate tool to answer finance questions. Never invent or guess numbers.
2. When the user says "this month", compute the correct YYYY-MM-DD date range using today's date above.
3. When the user says "this year", use ${year}-01-01 to ${year}-12-31.
4. For delete/update operations, if no ID is given, first call listExpenses or listIncomes so the user can identify the record.
5. Show tool output verbatim — do not paraphrase tables or numbers.
6. Keep conversational replies concise. Use ₹ for all amounts.
7. If asked something unrelated to personal finance, politely decline and redirect.
8. When a user adds a past transaction, use the date field — do not default to today.
9. To show full details of one record, use getExpenseById or getIncomeById with the full ID.`,
    };
  }

  // ── Initialise DB and models ────────────────────────────────────────────
  async initialize() {
    await dbConnection.connect();
    await dbConnection.initializeCollections();
    expenseModel.initialize();
    incomeModel.initialize();
    budgetModel.initialize();
    recurringModel.initialize();
  }

  // ── Dispatch a single tool call to the right service method ────────────
  async handleToolCall(toolCall) {
    const { name: fn, arguments: rawArgs } = toolCall.function;

    let args = {};
    try {
      args = JSON.parse(rawArgs || '{}');
    } catch {
      return `❌ Could not parse arguments for tool "${fn}".`;
    }

    try {
      switch (fn) {
        // ── Expense ──────────────────────────────────────────────────────
        case 'addExpense':               return await financeService.addExpense(args);
        case 'deleteExpense':            return await financeService.deleteExpense(args);
        case 'updateExpense':            return await financeService.updateExpense(args);
        case 'getTotalExpense':          return await financeService.getTotalExpense(args);
        case 'listExpenses':             return await financeService.listExpenses(args);
        case 'expenseCategoryBreakdown': return await financeService.expenseCategoryBreakdown(args);
        case 'getTopExpenses':           return await financeService.getTopExpenses(args);
        case 'getExpenseById':           return await financeService.getExpenseById(args);

        // ── Income ───────────────────────────────────────────────────────
        case 'addIncome':                return await financeService.addIncome(args);
        case 'deleteIncome':             return await financeService.deleteIncome(args);
        case 'updateIncome':             return await financeService.updateIncome(args);
        case 'getTotalIncome':           return await financeService.getTotalIncome(args);
        case 'listIncomes':              return await financeService.listIncomes(args);
        case 'incomeSourceBreakdown':    return await financeService.incomeSourceBreakdown(args);
        case 'getIncomeById':            return await financeService.getIncomeById(args);

        // ── Analytics ────────────────────────────────────────────────────
        case 'getMoneyBalance':          return await financeService.getMoneyBalance(args);
        case 'getSavingsRate':           return await financeService.getSavingsRate(args);
        case 'getMonthlySummary':        return await financeService.getMonthlySummary(args);
        case 'getFullReport':            return await financeService.getFullReport(args);

        // ── Budget ───────────────────────────────────────────────────────
        case 'setBudget':                return await financeService.setBudget(args);
        case 'checkBudget':              return await financeService.checkBudget(args);
        case 'deleteBudget':             return await financeService.deleteBudget(args);
        case 'listBudgets':              return await financeService.listBudgets();

        // ── Recurring ────────────────────────────────────────────────────
        case 'addRecurring':             return await financeService.addRecurring(args);
        case 'listRecurring':            return await financeService.listRecurring(args);
        case 'getDueRecurring':          return await financeService.getDueRecurring();
        case 'postRecurring':            return await financeService.postRecurring(args);
        case 'deactivateRecurring':      return await financeService.deactivateRecurring(args);
        case 'reactivateRecurring':      return await financeService.reactivateRecurring(args);
        case 'updateRecurring':          return await financeService.updateRecurring(args);
        case 'deleteRecurring':          return await financeService.deleteRecurring(args);

        // ── Search & Export ──────────────────────────────────────────────
        case 'searchTransactions':       return await financeService.searchTransactions(args);
        case 'exportTransactions':       return await financeService.exportTransactions(args);

        default:
          return `⚠️  Unknown tool called: "${fn}". This is a bug — please report it.`;
      }
    } catch (err) {
      // Return the error as a tool result so the AI can relay it to the user
      return `❌ ${fn} failed: ${err.message}`;
    }
  }

  // ── One full agentic turn (user message → tool calls → final reply) ─────
  async runTurn(userInput) {
    this.history.push({ role: 'user', content: userInput });

    // Agent-side history cap: keep last 40 messages (20 turns) to prevent
    // unbounded memory growth. groqService also trims for the API token limit.
    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }

    // Agentic loop: keep calling until the model stops issuing tool calls
    while (true) {
      let response;
      try {
        response = await groqService.createChatCompletion(
          [this.systemMessage, ...this.history],
          toolDefinitions
        );
      } catch (err) {
        console.error(clr('red', `\n❌ Groq API error: ${err.message}\n`));
        // Remove the failed user message so the history stays clean
        this.history.pop();
        return;
      }

      const message   = response.choices[0].message;
      const toolCalls = message.tool_calls;

      // Push assistant message to history (may contain tool_calls)
      this.history.push(message);

      // No tool calls → final text response
      if (!toolCalls || toolCalls.length === 0) {
        const text = message.content?.trim();
        if (text) {
          console.log('\n' + clr('green', 'FinanceBot') + clr('dim', ' ›') + ' ' + text + '\n');
        }
        return;
      }

      // Execute each tool call and collect results
      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;

        // Show a subtle "working" indicator
        stdout.write(clr('dim', `  ⚙  ${fnName}…`) + '\r');

        const output = await this.handleToolCall(toolCall);

        // Clear the indicator line
        stdout.write(' '.repeat(50) + '\r');

        this.history.push({
          role:         'tool',
          content:      String(output),
          tool_call_id: toolCall.id,
        });
      }
      // Loop back — the model will now see the tool results and either
      // call more tools or produce a final text response.
    }
  }

  // ── Check for due recurring transactions on startup ─────────────────────
  async checkDueRecurring() {
    try {
      const due = await recurringModel.getDue();
      if (due.length > 0) {
        console.log(clr('yellow', `\n  ⏰  ${due.length} recurring transaction(s) are due. Type "show due recurring" to review.\n`));
      }
    } catch {
      // Non-critical — silently ignore
    }
  }

  // ── Main chat loop ───────────────────────────────────────────────────────
  async startChatLoop() {
    this.rl = readline.createInterface({ input: stdin, output: stdout });

    printBanner();
    printHelp();

    await this.checkDueRecurring();

    while (true) {
      let raw;
      try {
        raw = await this.rl.question(clr('cyan', 'You') + clr('dim', ' › '));
      } catch {
        // readline closed (e.g. Ctrl+D)
        break;
      }

      const input = raw.trim();
      if (!input) continue;

      const lower = input.toLowerCase();

      // ── Built-in commands ──────────────────────────────────────────────
      if (['bye', 'exit', 'quit'].includes(lower)) {
        console.log(clr('green', '\n👋  Goodbye! Stay financially healthy.\n'));
        break;
      }

      if (lower === 'help') {
        printHelp();
        continue;
      }

      if (lower === 'clear') {
        console.clear();
        printBanner();
        continue;
      }

      // ── AI turn ────────────────────────────────────────────────────────
      await this.runTurn(input);
    }

    this.rl.close();
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────
  async shutdown() {
    try {
      this.rl?.close();
    } catch { /* ignore */ }
    await dbConnection.close();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const app = new FinanceBotApp();

  // Handle Ctrl+C and kill signals gracefully
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
