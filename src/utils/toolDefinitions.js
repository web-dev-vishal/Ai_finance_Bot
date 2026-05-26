/**
 * Groq / OpenAI function-calling tool definitions.
 * Every tool here must have a matching case in agent.js handleToolCall().
 *
 * NOTE: userId is NEVER included in these schemas — it is injected server-side
 * by agent.js from the authenticated session. The LLM never sees or sends it.
 */
export const toolDefinitions = [

  // ══════════════════════════════════════════════════════════════════════════
  // EXPENSE TOOLS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'addExpense',
      description: 'Record a new expense. Supports optional category, description, and a custom date for past transactions.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Short label (e.g. "Groceries", "Uber ride"). Max 200 chars.' },
          amount:      { type: 'number',  description: 'Amount in INR — must be positive' },
          category:    { type: 'string',  description: 'Category: Food, Transport, Rent, Entertainment, Health, Shopping, Utilities, Education, Other' },
          description: { type: 'string',  description: 'Optional extra notes. Max 500 chars.' },
          date:        { type: 'string',  description: 'Transaction date in YYYY-MM-DD format. Defaults to today.' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteExpense',
      description: 'Permanently delete an expense by its full MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the expense' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateExpense',
      description: 'Update one or more fields of an existing expense. Only provided fields are changed.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Full 24-character MongoDB ObjectId' },
          name:        { type: 'string' },
          amount:      { type: 'number' },
          category:    { type: 'string' },
          description: { type: 'string' },
          date:        { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTotalExpense',
      description: 'Get the sum of all expenses, optionally filtered by date range and/or category.',
      parameters: {
        type: 'object',
        properties: {
          from:     { type: 'string', description: 'Start date YYYY-MM-DD (inclusive)' },
          to:       { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' },
          category: { type: 'string', description: 'Filter by category name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listExpenses',
      description: 'List expenses with optional filters and pagination.',
      parameters: {
        type: 'object',
        properties: {
          from:     { type: 'string',  description: 'Start date YYYY-MM-DD' },
          to:       { type: 'string',  description: 'End date YYYY-MM-DD' },
          category: { type: 'string',  description: 'Filter by category' },
          search:   { type: 'string',  description: 'Full-text search keyword' },
          limit:    { type: 'integer', description: 'Records per page (default 20)' },
          page:     { type: 'integer', description: 'Page number (default 1)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expenseCategoryBreakdown',
      description: 'Show total, count, average, and max expenses grouped by category.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTopExpenses',
      description: 'Show the highest individual expense transactions.',
      parameters: {
        type: 'object',
        properties: {
          from:  { type: 'string',  description: 'Start date YYYY-MM-DD' },
          to:    { type: 'string',  description: 'End date YYYY-MM-DD' },
          limit: { type: 'integer', description: 'How many to show (default 5)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getExpenseById',
      description: 'Get full details of a single expense by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the expense' },
        },
        required: ['id'],
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INCOME TOOLS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'addIncome',
      description: 'Record a new income entry. Supports optional source, description, and a custom date.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Short label (e.g. "Salary May", "Freelance project"). Max 200 chars.' },
          amount:      { type: 'number',  description: 'Amount in INR — must be positive' },
          source:      { type: 'string',  description: 'Source: Salary, Freelance, Business, Investment, Rental, Gift, Other' },
          description: { type: 'string',  description: 'Optional extra notes. Max 500 chars.' },
          date:        { type: 'string',  description: 'Transaction date in YYYY-MM-DD format. Defaults to today.' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteIncome',
      description: 'Permanently delete an income record by its full MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateIncome',
      description: 'Update one or more fields of an existing income record.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Full 24-character MongoDB ObjectId' },
          name:        { type: 'string' },
          amount:      { type: 'number' },
          source:      { type: 'string' },
          description: { type: 'string' },
          date:        { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTotalIncome',
      description: 'Get the sum of all income, optionally filtered by date range and/or source.',
      parameters: {
        type: 'object',
        properties: {
          from:   { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:     { type: 'string', description: 'End date YYYY-MM-DD' },
          source: { type: 'string', description: 'Filter by source name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listIncomes',
      description: 'List income records with optional filters and pagination.',
      parameters: {
        type: 'object',
        properties: {
          from:   { type: 'string',  description: 'Start date YYYY-MM-DD' },
          to:     { type: 'string',  description: 'End date YYYY-MM-DD' },
          source: { type: 'string',  description: 'Filter by source' },
          search: { type: 'string',  description: 'Full-text search keyword' },
          limit:  { type: 'integer', description: 'Records per page (default 20)' },
          page:   { type: 'integer', description: 'Page number (default 1)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'incomeSourceBreakdown',
      description: 'Show total, count, average, and max income grouped by source.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getIncomeById',
      description: 'Get full details of a single income record by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the income' },
        },
        required: ['id'],
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BALANCE & ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'getMoneyBalance',
      description: 'Show net balance (income − expenses), transaction counts, and savings rate. Optionally scoped to a date range.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSavingsRate',
      description: 'Calculate what percentage of income was saved (not spent) in a given period.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMonthlySummary',
      description: 'Month-by-month income vs expense table for a given year, with totals row.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Year (e.g. 2025). Defaults to current year.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFullReport',
      description: 'Generate a complete financial report: balance, monthly summary, category breakdown, source breakdown, and top expenses — all scoped to a year.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Year for the report. Defaults to current year.' },
        },
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BUDGET TOOLS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'setBudget',
      description: 'Set or update a monthly spending budget with an optional alert threshold.',
      parameters: {
        type: 'object',
        properties: {
          month:   { type: 'string',  description: 'Month in YYYY-MM format (e.g. "2025-05")' },
          amount:  { type: 'number',  description: 'Budget amount in INR' },
          alertAt: { type: 'integer', description: 'Percentage at which to warn (default 80). Range: 1–100.' },
        },
        required: ['month', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkBudget',
      description: 'Check how much of the monthly budget has been spent, with a progress bar and status.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Month in YYYY-MM format. Defaults to current month.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteBudget',
      description: 'Delete the budget for a specific month.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Month in YYYY-MM format' },
        },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listBudgets',
      description: 'List all saved monthly budgets with their alert thresholds.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RECURRING TRANSACTIONS
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'addRecurring',
      description: 'Set up a recurring expense or income (e.g. monthly rent, weekly salary).',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Label for the recurring item. Max 200 chars.' },
          amount:      { type: 'number',  description: 'Amount in INR' },
          type:        { type: 'string',  description: '"expense" or "income"' },
          frequency:   { type: 'string',  description: '"daily", "weekly", "monthly", or "yearly"' },
          category:    { type: 'string',  description: 'Category (for expenses)' },
          source:      { type: 'string',  description: 'Source (for income)' },
          description: { type: 'string',  description: 'Optional notes. Max 500 chars.' },
          startDate:   { type: 'string',  description: 'First occurrence date YYYY-MM-DD. Defaults to today.' },
        },
        required: ['name', 'amount', 'type', 'frequency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listRecurring',
      description: 'List all active recurring transactions.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by "expense" or "income". Omit for all.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDueRecurring',
      description: 'Show recurring transactions that are due today or overdue.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'postRecurring',
      description: 'Post a due recurring transaction as an actual expense or income record and advance its next-due date.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the recurring item' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deactivateRecurring',
      description: 'Pause a recurring transaction without deleting it.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the recurring item' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reactivateRecurring',
      description: 'Re-enable a previously paused recurring transaction.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the recurring item' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateRecurring',
      description: 'Update the name, amount, frequency, category, source, or description of a recurring transaction.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Full 24-character MongoDB ObjectId of the recurring item' },
          name:        { type: 'string' },
          amount:      { type: 'number' },
          frequency:   { type: 'string', description: '"daily", "weekly", "monthly", or "yearly"' },
          category:    { type: 'string' },
          source:      { type: 'string' },
          description: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteRecurring',
      description: 'Permanently delete a recurring transaction template.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full 24-character MongoDB ObjectId of the recurring item' },
        },
        required: ['id'],
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SEARCH & EXPORT
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'searchTransactions',
      description: 'Full-text search across all expenses and incomes by name or description.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string',  description: 'Search keyword or phrase' },
          limit: { type: 'integer', description: 'Max results per type (default 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'exportTransactions',
      description: 'Export all transactions to a CSV or JSON file saved to the Desktop.',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string',  description: '"csv" (default) or "json"' },
          from:   { type: 'string',  description: 'Start date YYYY-MM-DD (optional)' },
          to:     { type: 'string',  description: 'End date YYYY-MM-DD (optional)' },
        },
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ACCOUNT / PROFILE  (Feature 1, 2, 3)
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'getProfile',
      description: 'Show the logged-in user\'s profile: name, email, account creation date, and transaction counts. Use when the user asks "who am I", "show my profile", or "what account am I using".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'changePassword',
      description: 'Change the logged-in user\'s password. Requires the current password for verification. The session will be invalidated and the user must log in again.',
      parameters: {
        type: 'object',
        properties: {
          currentPassword: { type: 'string', description: 'The user\'s current password' },
          newPassword:     { type: 'string', description: 'The new password (minimum 8 characters)' },
        },
        required: ['currentPassword', 'newPassword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteAccount',
      description: '⚠️ IRREVERSIBLE. Permanently delete the account and ALL associated data (expenses, incomes, budgets, recurring). Requires the user to type the exact phrase "DELETE MY ACCOUNT" as confirmation.',
      parameters: {
        type: 'object',
        properties: {
          confirmationPhrase: { type: 'string', description: 'Must be exactly: DELETE MY ACCOUNT' },
        },
        required: ['confirmationPhrase'],
      },
    },
  },
];
