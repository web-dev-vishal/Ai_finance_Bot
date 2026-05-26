import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';

class IncomeModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('incomes');
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async add({ name, amount, source = 'Other', description = '' }) {
    if (!name?.trim()) throw new Error('Income name is required.');
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) throw new Error('Amount must be a positive number.');

    const doc = {
      name: name.trim(),
      amount: num,
      source: source.trim() || 'Other',
      description: description.trim(),
      createdAt: new Date(),
    };

    const result = await this.collection.insertOne(doc);
    return `✅ Income recorded — ${doc.name} | ₹${doc.amount} | Source: ${doc.source} | ID: ${result.insertedId}`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete({ id }) {
    if (!id || !ObjectId.isValid(id)) throw new Error('Valid income ID is required.');
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new Error('Income not found.');
    return `🗑️  Income ${id} deleted successfully.`;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update({ id, name, amount, source, description }) {
    if (!id || !ObjectId.isValid(id)) throw new Error('Valid income ID is required.');
    const update = {};
    if (name)        update.name        = name.trim();
    if (amount)      update.amount      = Number(amount);
    if (source)      update.source      = source.trim();
    if (description !== undefined) update.description = description.trim();
    update.updatedAt = new Date();

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) throw new Error('Income not found.');
    return `✏️  Income ${id} updated successfully.`;
  }

  // ── Get total ─────────────────────────────────────────────────────────────
  async getTotal({ from, to, source } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) {
      match.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (source) match.source = source;

    const [result] = await this.collection.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    return { total: result?.total ?? 0, count: result?.count ?? 0 };
  }

  // ── Get all ───────────────────────────────────────────────────────────────
  async getAll({ from, to, source, search, limit = 20 } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) match.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    if (source)     match.source    = source;
    if (search)     match.$text     = { $search: search };

    return await this.collection
      .find(match)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();
  }

  // ── Source breakdown ──────────────────────────────────────────────────────
  async getBySource({ from, to } = {}) {
    const match = { _seed: { $exists: false } };
    if (from && to) match.createdAt = { $gte: new Date(from), $lte: new Date(to) };

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$source',
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

export default new IncomeModel();
