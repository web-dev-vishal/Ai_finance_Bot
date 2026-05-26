import dbConnection from '../config/database.js';
import { validateMonth, validateAmount } from '../utils/validators.js';

class BudgetModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('budgets');
  }

  /**
   * Set or update a monthly budget.
   * @param {{ month: string, amount: number, alertAt?: number }} args
   * alertAt: percentage (0–100) at which to warn. Defaults to 80.
   */
  async set({ month, amount, alertAt = 80 }) {
    const validMonth  = validateMonth(month);
    const validAmount = validateAmount(amount);

    const alertPct = Math.min(100, Math.max(1, Number(alertAt) || 80));

    await this.collection.updateOne(
      { month: validMonth },
      {
        $set: {
          month:     validMonth,
          amount:    validAmount,
          alertAt:   alertPct,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    return `✅ Budget for ${validMonth} set to ₹${validAmount} (alert at ${alertPct}%).`;
  }

  /**
   * Get a single month's budget, or all budgets if month is omitted.
   */
  async get({ month } = {}) {
    if (!month) {
      return await this.collection.find({}).sort({ month: -1 }).toArray();
    }
    return await this.collection.findOne({ month });
  }

  async delete({ month }) {
    if (!month) throw new Error('Month is required.');
    validateMonth(month);
    const result = await this.collection.deleteOne({ month });
    if (result.deletedCount === 0) throw new Error(`No budget found for ${month}.`);
    return `🗑️  Budget for ${month} deleted.`;
  }
}

export default new BudgetModel();
