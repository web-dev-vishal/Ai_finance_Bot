/**
 * Expense model — Fix 1: All queries now scoped by userId.
 * Cleanup 4: Uses parseSafeDate / endOfDay instead of string interpolation.
 * Cleanup 1: validateDescription enforces 500-char limit.
 */
import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';
import {
  validateName,
  validateAmount,
  validateObjectId,
  validateDescription,
  parseSafeDate,
  endOfDay,
} from '../utils/validators.js';

class ExpenseModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('expenses');
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async add({ userId, name, amount, category = 'General', description = '', date }) {
    if (!userId) throw new Error('userId is required.');
    const validName   = validateName(name);
    const validAmount = validateAmount(amount);
    const validDesc   = validateDescription(description);

    const txDate = date ? parseSafeDate(date, 'transaction date') : new Date();

    const doc = {
      userId:      new ObjectId(String(userId)),
      name:        validName,
      amount:      validAmount,
      category:    (category?.trim() || 'General'),
      description: validDesc,
      date:        txDate,
      createdAt:   new Date(),
    };

    const result = await this.collection.insertOne(doc);
    return `✅ Expense recorded — ${doc.name} | ₹${doc.amount} | Category: ${doc.category} | ID: ${result.insertedId}`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete({ userId, id }) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'expense ID');
    const result = await this.collection.deleteOne({
      _id:    new ObjectId(id),
      userId: new ObjectId(String(userId)),
    });
    if (result.deletedCount === 0) throw new Error(`Expense with ID "${id}" not found.`);
    return `🗑️  Expense deleted (ID: ${id}).`;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update({ userId, id, name, amount, category, description, date }) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'expense ID');

    const update = { updatedAt: new Date() };
    if (name        !== undefined) update.name        = validateName(name);
    if (amount      !== undefined) update.amount      = validateAmount(amount);
    if (category    !== undefined) update.category    = category?.trim() || 'General';
    if (description !== undefined) update.description = validateDescription(description);
    if (date        !== undefined) update.date        = parseSafeDate(date, 'transaction date');

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(userId)) },
      { $set: update }
    );
    if (result.matchedCount === 0) throw new Error(`Expense with ID "${id}" not found.`);
    return `✏️  Expense updated (ID: ${id}).`;
  }

  // ── Get total ─────────────────────────────────────────────────────────────
  async getTotal({ userId, from, to, category } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (from && to) {
      match.date = { $gte: parseSafeDate(from, 'from date'), $lte: endOfDay(to) };
    }
    if (category) match.category = category;

    const [result] = await this.collection.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    return { total: result?.total ?? 0, count: result?.count ?? 0 };
  }

  // ── Get all ───────────────────────────────────────────────────────────────
  async getAll({ userId, from, to, category, search, limit = 20, page = 1 } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (from && to) match.date = { $gte: parseSafeDate(from, 'from date'), $lte: endOfDay(to) };
    if (category)   match.category = category;
    if (search)     match.$text    = { $search: search };

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      this.collection
        .find(match)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .toArray(),
      this.collection.countDocuments(match),
    ]);

    return { rows, total, page: Number(page), limit: Number(limit) };
  }

  // ── Top N expenses ────────────────────────────────────────────────────────
  async getTopExpenses({ userId, from, to, limit = 5 } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (from && to) match.date = { $gte: parseSafeDate(from, 'from date'), $lte: endOfDay(to) };

    return await this.collection
      .find(match)
      .sort({ amount: -1 })
      .limit(Number(limit))
      .toArray();
  }

  // ── Category breakdown ────────────────────────────────────────────────────
  async getByCategory({ userId, from, to } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (from && to) match.date = { $gte: parseSafeDate(from, 'from date'), $lte: endOfDay(to) };

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id:   '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avg:   { $avg: '$amount' },
          max:   { $max: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray();
  }

  // ── Monthly summary ───────────────────────────────────────────────────────
  async getMonthlySummary({ userId, year } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (year) {
      match.date = {
        $gte: parseSafeDate(`${year}-01-01`),
        $lte: endOfDay(`${year}-12-31`),
      };
    }

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).toArray();
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────
  async getById({ userId, id }) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'expense ID');
    const doc = await this.collection.findOne({
      _id:    new ObjectId(id),
      userId: new ObjectId(String(userId)),
    });
    if (!doc) throw new Error(`Expense with ID "${id}" not found.`);
    return doc;
  }

  // ── Count (for profile) ───────────────────────────────────────────────────
  async countByUser(userId) {
    if (!userId) return 0;
    return await this.collection.countDocuments({ userId: new ObjectId(String(userId)) });
  }

  // ── Export all ────────────────────────────────────────────────────────────
  async exportAll({ userId, from, to } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (from && to) match.date = { $gte: parseSafeDate(from, 'from date'), $lte: endOfDay(to) };
    return await this.collection.find(match).sort({ date: -1 }).toArray();
  }

  // ── Delete all by user (for account deletion) ─────────────────────────────
  async deleteAllByUser(userId) {
    if (!userId) throw new Error('userId is required.');
    return await this.collection.deleteMany({ userId: new ObjectId(String(userId)) });
  }
}

export default new ExpenseModel();
