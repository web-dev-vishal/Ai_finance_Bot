# 💰 FinanceBot

An AI-powered personal finance terminal assistant built with **Groq LLaMA-3.3-70b**, **MongoDB**, and **Node.js**. Talk to it in plain English to track your income, expenses, budgets, and more — all from your terminal.

---

## Features

| Category | What it does |
|---|---|
| **Expenses** | Add, update, delete, list, filter by date/category, category breakdown, top-N |
| **Income** | Add, update, delete, list, filter by date/source, source breakdown |
| **Analytics** | Net balance, savings rate, month-by-month summary, full annual report |
| **Budget** | Set monthly budgets with custom alert thresholds, progress bar, over/under status |
| **Recurring** | Set up daily/weekly/monthly/yearly transactions, see what's due, post with one command |
| **Search** | Full-text search across all expenses and incomes |
| **Export** | Export all transactions to CSV or JSON on your Desktop |
| **Past dates** | Record transactions on any past date — not just today |
| **Pagination** | List commands support `page` and `limit` parameters |

---

## Requirements

- **Node.js** ≥ 20.6.0
- **MongoDB** running locally (`mongod`) or a MongoDB Atlas connection string
- A free **Groq API key** from [console.groq.com](https://console.groq.com)

---

## Setup

```bash
# 1. Clone / download the project
cd AI_Agent

# 2. Install dependencies
npm install

# 3. Configure environment
copy .env.example .env
# Then open .env and fill in your GROQ_API_KEY

# 4. Start MongoDB (if running locally)
mongod

# 5. Run FinanceBot
npm start
```

---

## Usage

Once running, just type naturally:

```
You › Add expense 500 for groceries
You › Add income 50000 salary for May
You › What is my balance?
You › Show all expenses this month
You › Set budget 20000 for 2025-05
You › Check budget for this month
You › Monthly summary for 2025
You › Full financial report
You › Add recurring expense 12000 rent monthly
You › Show due recurring transactions
You › Export all transactions as CSV
You › Search transactions for "amazon"
You › help
You › bye
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key |
| `GROQ_MODEL` | No | Model name (default: `llama-3.3-70b-versatile`) |
| `MONGO_URI` | No | MongoDB connection string (default: `mongodb://localhost:27017/financeBot`) |
| `DB_NAME` | No | Database name (default: `financeBot`) |

---

## Project Structure

```
src/
├── agent.js              # Main entry point — terminal UI and agentic loop
├── config/
│   └── database.js       # MongoDB connection singleton
├── models/
│   ├── expense.js        # Expense CRUD + aggregations
│   ├── income.js         # Income CRUD + aggregations
│   ├── budget.js         # Monthly budget management
│   └── recurring.js      # Recurring transaction templates
├── services/
│   ├── financeService.js # Business logic + formatted output
│   └── groqService.js    # Groq API wrapper with retry + context trimming
└── utils/
    ├── toolDefinitions.js # OpenAI function-calling schemas (30 tools)
    ├── validators.js      # Shared input validation helpers
    └── exporter.js        # CSV / JSON export to Desktop
```

---

## Scripts

```bash
npm start   # Run the bot
npm run dev # Run with --watch (auto-restart on file changes)
```

---

## License

MIT
