export const toolDefinitions = [
  // ── Expense tools ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'addExpense',
      description: 'Record a new expense with optional category and description.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Short label for the expense (e.g. "Groceries")' },
          amount:      { type: 'number',  description: 'Amount in INR (must be positive)' },
          category:    { type: 'string',  description: 'Category such as Food, Transport, Rent, Entertainment, Health, etc.' },
          description: { type: 'string',  description: 'Optional extra details' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteExpense',
      description: 'Delete an expense by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full MongoDB ObjectId of the expense to delete' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateExpense',
      description: 'Update an existing expense by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Full MongoDB ObjectId of the expense' },
          name:        { type: 'string' },
          amount:      { type: 'number' },
          category:    { type: 'string' },
          description: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTotalExpense',
      description: 'Get total expenses, optionally filtered by date range and/or category.',
      parameters: {
        type: 'object',
        properties: {
          from:     { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:       { type: 'string', description: 'End date YYYY-MM-DD' },
          category: { type: 'string', description: 'Filter by category' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listExpenses',
      description: 'List recent expenses with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          from:     { type: 'string',  description: 'Start date YYYY-MM-DD' },
          to:       { type: 'string',  description: 'End date YYYY-MM-DD' },
          category: { type: 'string',  description: 'Filter by category' },
          search:   { type: 'string',  description: 'Full-text search keyword' },
          limit:    { type: 'integer', description: 'Max rows to return (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expenseCategoryBreakdown',
      description: 'Show total expenses grouped by category.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },

  // ── Income tools ───────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'addIncome',
      description: 'Record a new income with optional source and description.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Short label (e.g. "Salary May")' },
          amount:      { type: 'number',  description: 'Amount in INR (must be positive)' },
          source:      { type: 'string',  description: 'Source such as Salary, Freelance, Business, Investment, Gift, etc.' },
          description: { type: 'string',  description: 'Optional extra details' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteIncome',
      description: 'Delete an income record by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Full MongoDB ObjectId of the income to delete' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateIncome',
      description: 'Update an existing income record by its MongoDB ObjectId.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Full MongoDB ObjectId of the income' },
          name:        { type: 'string' },
          amount:      { type: 'number' },
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
      name: 'getTotalIncome',
      description: 'Get total income, optionally filtered by date range and/or source.',
      parameters: {
        type: 'object',
        properties: {
          from:   { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:     { type: 'string', description: 'End date YYYY-MM-DD' },
          source: { type: 'string', description: 'Filter by source' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listIncomes',
      description: 'List recent income records with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          from:   { type: 'string',  description: 'Start date YYYY-MM-DD' },
          to:     { type: 'string',  description: 'End date YYYY-MM-DD' },
          source: { type: 'string',  description: 'Filter by source' },
          search: { type: 'string',  description: 'Full-text search keyword' },
          limit:  { type: 'integer', description: 'Max rows to return (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'incomeSourceBreakdown',
      description: 'Show total income grouped by source.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD' },
          to:   { type: 'string', description: 'End date YYYY-MM-DD' },
        },
      },
    },
  },

  // ── Balance & Reports ──────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getMoneyBalance',
      description: 'Return current balance (total income minus total expenses). Optionally filter by date range.',
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
      description: 'Show a month-by-month income vs expense breakdown for a given year.',
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
      description: 'Generate a complete financial report including balance, monthly summary, category and source breakdowns.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Year for the report. Defaults to current year.' },
        },
      },
    },
  },

  // ── Budget tools ───────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'setBudget',
      description: 'Set or update a monthly spending budget.',
      parameters: {
        type: 'object',
        properties: {
          month:  { type: 'string', description: 'Month in YYYY-MM format (e.g. "2025-05")' },
          amount: { type: 'number', description: 'Budget amount in INR' },
        },
        required: ['month', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkBudget',
      description: 'Check how much of the budget has been spent for a given month.',
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
      description: 'List all saved monthly budgets.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'searchTransactions',
      description: 'Full-text search across all expenses and incomes.',
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
];
