import dbConnection from '../config/database.js';

class BudgetModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('budgets');
  }

  // month format: "YYYY-MM"
  async set({ month, amount }) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error('Month must be in YYYY-MM format.');
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) throw new Error('Budget amount must be a positive number.');

    await this.collection.updateOne(
      { month },
      { $set: { month, amount: num, updatedAt: new Date() } },
      { upsert: true }
    );
    return `✅ Budget for ${month} set to ₹${num}`;
  }

  async get({ month }) {
    if (!month) {
      // return all budgets
      return await this.collection.find({}).sort({ month: -1 }).toArray();
    }
    return await this.collection.findOne({ month });
  }

  async delete({ month }) {
    if (!month) throw new Error('Month is required.');
    const result = await this.collection.deleteOne({ month });
    if (result.deletedCount === 0) throw new Error(`No budget found for ${month}.`);
    return `🗑️  Budget for ${month} deleted.`;
  }
}

export default new BudgetModel();
