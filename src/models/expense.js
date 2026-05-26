import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';

class ExpenseModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('expenses');
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async add({ name, amount, category = 'General', description = '' }) {
    if (!name?.trim()) throw new Error('Expense name is required.');
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) throw new Error('Amount must be a positive number.');

    const doc = {
      name: name.trim(),
      amount: num,
      category: category.trim() || 'General',
      description: description.trim(),
      createdAt: new Date(),
    };

    const result = await this.collection.insertOne(doc);
    return `✅ Expense recorded — ${doc.name} | ₹${doc.amount} | Category: ${doc.category} | ID: ${result.insertedId}`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete({ id }) {
    if (!id || !ObjectId.isValid(id)) throw new Error('Valid expense ID is required.');
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new Error('Expense not found.');
    return `🗑️  Expense ${id} deleted successfully.`;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update({ id, name, amount, category, description }) {
    if (!id || !ObjectId.isValid(id)) throw new Error('Valid expense ID is required.');
    const update = {};
    if (name)        update.name        = name.trim();
    if (amount)      update.amount      = Number(amount);
    if (category)    update.category    = category.trim();
    if (description !== undefined) update.description = description.trim();
    update.updatedAt = new Date();

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) throw new Error('Expense not found.');
    return `✏️  Expense ${id} updated successfully.`;
  }

  // ── Get total ─────────────────────────────────────────────────────────────
  async getTotal({ from, to, category } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) {
      match.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (category) match.category = category;

    const [result] = await this.collection.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    return { total: result?.total ?? 0, count: result?.count ?? 0 };
  }

  // ── Get all (with optional filters) ──────────────────────────────────────
  async getAll({ from, to, category, search, limit = 20 } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) match.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    if (category)   match.category  = category;
    if (search)     match.$text     = { $search: search };

    return await this.collection
      .find(match)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();
  }

  // ── Category breakdown ────────────────────────────────────────────────────
  async getByCategory({ from, to } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) match.createdAt = { $gte: new Date(from), $lte: new Date(to) };

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avg: { $avg: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray();
  }

  // ── Monthly summary ───────────────────────────────────────────────────────
  async getMonthlySummary({ year } = {}) {
    const match = { _seed: { $exists: false } };
    if (year) {
      match.createdAt = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31T23:59:59`),
      };
    }

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).toArray();
  }
}

export default new ExpenseModel();
