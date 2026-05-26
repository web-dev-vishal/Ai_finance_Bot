import readline from 'node:readline/promises';
import dbConnection    from './config/database.js';
import expenseModel    from './models/expense.js';
import incomeModel     from './models/income.js';
import budgetModel     from './models/budget.js';
import groqService     from './services/groqService.js';
import financeService  from './services/financeService.js';
import { toolDefinitions } from './utils/toolDefinitions.js';

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  dim:    '\x1b[2m',
};
const clr = (color, text) => `${c[color]}${text}${c.reset}`;

// ── Banner ────────────────────────────────────────────────────────────────────
function printBanner() {
  console.log('\n' + clr('cyan', '╔══════════════════════════════════════════════════════╗'));
  console.log(clr('cyan',       '║') + clr('bold', '          💰  FinanceBot  — Personal Finance AI        ') + clr('cyan', '║'));
  console.log(clr('cyan',       '╚══════════════════════════════════════════════════════╝'));
  console.log(clr('dim', '  Powered by Groq LLaMA-3.3-70b  |  MongoDB  |  Node.js\n'));
}

// ── Help text ─────────────────────────────────────────────────────────────────
function printHelp() {
  const h = clr('yellow', '─'.repeat(56));
  console.log('\n' + h);
  console.log(clr('bold', '  📖 What you can ask FinanceBot:'));
  console.log(h);
  console.log(clr('green', '  Expenses'));
  console.log('    • Add expense 500 for groceries (category: Food)');
  console.log('    • Delete expense <id>');
  console.log('    • Update expense <id> amount to 600');
  console.log('    • Show all expenses');
  console.log('    • Total expenses this month');
  console.log('    • Expense breakdown by category');
  console.log(clr('green', '\n  Income'));
  console.log('    • Add income 50000 salary (source: Salary)');
  console.log('    • Delete income <id>');
  console.log('    • Show all incomes');
  console.log('    • Total income this year');
  console.log('    • Income breakdown by source');
  console.log(clr('green', '\n  Balance & Reports'));
  console.log('    • What is my balance?');
  console.log('    • Monthly summary for 2025');
  console.log('    • Full financial report');
  console.log(clr('green', '\n  Budget'));
  console.log('    • Set budget 20000 for 2025-05');
  console.log('    • Check budget for this month');
  console.log('    • List all budgets');
  console.log('    • Delete budget for 2025-04');
  console.log(clr('green', '\n  Search'));
  console.log('    • Search transactions for "amazon"');
  console.log(clr('dim', '\n  Type "help" to see this again  |  "bye" to exit\n'));
  console.log(h + '\n');
}

// ── FinanceBotApp ─────────────────────────────────────────────────────────────
class FinanceBotApp {
  constructor() {
    this.messages = [
      {
        role: 'system',
        content: `You are FinanceBot, a smart personal finance assistant for Indian users (currency: INR ₹).

You have access to these tools:
EXPENSE: addExpense, deleteExpense, updateExpense, getTotalExpense, listExpenses, expenseCategoryBreakdown
INCOME:  addIncome, deleteIncome, updateIncome, getTotalIncome, listIncomes, incomeSourceBreakdown
BALANCE: getMoneyBalance, getMonthlySummary, getFullReport
BUDGET:  setBudget, checkBudget, deleteBudget, listBudgets
SEARCH:  searchTransactions

Rules:
- Always call the appropriate tool(s) to answer finance questions. Never guess numbers.
- When the user says "this month", compute the correct YYYY-MM-DD range.
- When listing transactions, always call the list tool and show the result verbatim.
- For delete/update, ask for the ID if not provided (hint: use listExpenses/listIncomes to find it).
- Keep responses concise and friendly. Use ₹ for amounts.
- If the user asks something unrelated to finance, politely redirect them.`,
      },
    ];
  }

  async initialize() {
    await dbConnection.connect();
    await dbConnection.initializeCollections();
    expenseModel.initialize();
    incomeModel.initialize();
    budgetModel.initialize();
  }

  async handleToolCall(toolCall) {
    const { name: fn, arguments: rawArgs } = toolCall.function;
    let args = {};
    try {
      args = JSON.parse(rawArgs || '{}');
    } catch {
      return `❌ Failed to parse tool arguments for ${fn}.`;
    }

    try {
      switch (fn) {
        // Expense
        case 'addExpense':               return await financeService.addExpense(args);
        case 'deleteExpense':            return await financeService.deleteExpense(args);
        case 'updateExpense':            return await financeService.updateExpense(args);
        case 'getTotalExpense':          return await financeService.getTotalExpense(args);
        case 'listExpenses':             return await financeService.listExpenses(args);
        case 'expenseCategoryBreakdown': return await financeService.expenseCategoryBreakdown(args);

        // Income
        case 'addIncome':                return await financeService.addIncome(args);
        case 'deleteIncome':             return await financeService.deleteIncome(args);
        case 'updateIncome':             return await financeService.updateIncome(args);
        case 'getTotalIncome':           return await financeService.getTotalIncome(args);
        case 'listIncomes':              return await financeService.listIncomes(args);
        case 'incomeSourceBreakdown':    return await financeService.incomeSouceBreakdown(args);

        // Balance & Reports
        case 'getMoneyBalance':          return await financeService.getMoneyBalance(args);
        case 'getMonthlySummary':        return await financeService.getMonthlySummary(args);
        case 'getFullReport':            return await financeService.getFullReport(args);

        // Budget
        case 'setBudget':                return await financeService.setBudget(args);
        case 'checkBudget':              return await financeService.checkBudget(args);
        case 'deleteBudget':             return await financeService.deleteBudget(args);
        case 'listBudgets':              return await financeService.listBudgets();

        // Search
        case 'searchTransactions':       return await financeService.searchTransactions(args);

        default:
          return `⚠️  Unknown tool: ${fn}`;
      }
    } catch (err) {
      return `❌ Error in ${fn}: ${err.message}`;
    }
  }

  async startChatLoop() {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });

    printBanner();
    printHelp();

    while (true) {
      const raw = await rl.question(clr('cyan', 'You: '));
      const userInput = raw.trim();

      if (!userInput) continue;

      if (['bye', 'exit', 'quit'].includes(userInput.toLowerCase())) {
        console.log(clr('green', '\n👋 Goodbye! Stay financially healthy.\n'));
        break;
      }

      if (userInput.toLowerCase() === 'help') {
        printHelp();
        continue;
      }

      this.messages.push({ role: 'user', content: userInput });

      // Agentic loop — keep calling until no more tool calls
      while (true) {
        let response;
        try {
          response = await groqService.createChatCompletion(this.messages, toolDefinitions);
        } catch (err) {
          console.error(clr('red', `\n❌ Groq API error: ${err.message}\n`));
          break;
        }

        const message   = response.choices[0].message;
        const toolCalls = message.tool_calls;

        this.messages.push(message);

        if (!toolCalls || toolCalls.length === 0) {
          console.log('\n' + clr('green', 'FinanceBot: ') + message.content + '\n');
          break;
        }

        // Execute all tool calls
        for (const toolCall of toolCalls) {
          const fnName = toolCall.function.name;
          process.stdout.write(clr('dim', `  ⚙  Calling ${fnName}…\r`));
          const output = await this.handleToolCall(toolCall);
          // Clear the "calling…" line
          process.stdout.write(' '.repeat(40) + '\r');
          this.messages.push({
            role:         'tool',
            content:      String(output),
            tool_call_id: toolCall.id,
          });
        }
      }
    }

    rl.close();
  }

  async shutdown() {
    await dbConnection.close();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const app = new FinanceBotApp();
  try {
    await app.initialize();
    await app.startChatLoop();
  } catch (err) {
    console.error(clr('red', `\n❌ Fatal error: ${err.message}`));
    process.exit(1);
  } finally {
    await app.shutdown();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
