/**
 * Budget model — Fix 1: All queries now scoped by userId.
 * Compound unique index on [userId, month] instead of just month.
 */
import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';
import { validateMonth, validateAmount } from '../utils/validators.js';

class BudgetModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('budgets');
  }

  // ── Set / upsert ──────────────────────────────────────────────────────────
  async set({ userId, month, amount, alertAt = 80 }) {
    if (!userId) throw new Error('userId is required.');
    const validMonth  = validateMonth(month);
    const validAmount = validateAmount(amount);
    const alertPct    = Math.min(100, Math.max(1, Number(alertAt) || 80));
    const uid         = new ObjectId(String(userId));

    await this.collection.updateOne(
      { userId: uid, month: validMonth },
      {
        $set: {
          userId:    uid,
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

  // ── Get one or all ────────────────────────────────────────────────────────
  async get({ userId, month } = {}) {
    if (!userId) throw new Error('userId is required.');
    const uid = new ObjectId(String(userId));
    if (!month) {
      return await this.collection.find({ userId: uid }).sort({ month: -1 }).toArray();
    }
    return await this.collection.findOne({ userId: uid, month });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete({ userId, month }) {
    if (!userId) throw new Error('userId is required.');
    if (!month) throw new Error('Month is required.');
    validateMonth(month);
    const result = await this.collection.deleteOne({
      userId: new ObjectId(String(userId)),
      month,
    });
    if (result.deletedCount === 0) throw new Error(`No budget found for ${month}.`);
    return `🗑️  Budget for ${month} deleted.`;
  }

  // ── Delete all by user (for account deletion) ─────────────────────────────
  async deleteAllByUser(userId) {
    if (!userId) throw new Error('userId is required.');
    return await this.collection.deleteMany({ userId: new ObjectId(String(userId)) });
  }
}

export default new BudgetModel();
