import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';
import {
  validateName,
  validateAmount,
  validateObjectId,
} from '../utils/validators.js';

class IncomeModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('incomes');
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  /**
   * @param {{ name, amount, source?, description?, date? }} args
   * date: optional ISO date string for recording past income (defaults to now)
   */
  async add({ name, amount, source = 'Other', description = '', date }) {
    const validName   = validateName(name);
    const validAmount = validateAmount(amount);

    const txDate = date ? new Date(date) : new Date();
    if (isNaN(txDate.getTime())) throw new Error(`Invalid date: "${date}". Use YYYY-MM-DD.`);

    const doc = {
      name:        validName,
      amount:      validAmount,
      source:      (source?.trim() || 'Other'),
      description: (description?.trim() || ''),
      date:        txDate,
      createdAt:   new Date(),
    };

    const result = await this.collection.insertOne(doc);
    return `✅ Income recorded — ${doc.name} | ₹${doc.amount} | Source: ${doc.source} | ID: ${result.insertedId}`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete({ id }) {
    validateObjectId(id, 'income ID');
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new Error(`Income with ID "${id}" not found.`);
    return `🗑️  Income deleted (ID: ${id}).`;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update({ id, name, amount, source, description, date }) {
    validateObjectId(id, 'income ID');

    const update = { updatedAt: new Date() };
    if (name        !== undefined) update.name        = validateName(name);
    if (amount      !== undefined) update.amount      = validateAmount(amount);
    if (source      !== undefined) update.source      = source?.trim() || 'Other';
    if (description !== undefined) update.description = description?.trim() || '';
    if (date        !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) throw new Error(`Invalid date: "${date}".`);
      update.date = d;
    }

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) throw new Error(`Income with ID "${id}" not found.`);
    return `✏️  Income updated (ID: ${id}).`;
  }

  // ── Get total ─────────────────────────────────────────────────────────────
  async getTotal({ from, to, source } = {}) {
    const match = {};
    if (from && to) {
      match.date = { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) };
    }
    if (source) match.source = source;

    const [result] = await this.collection.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    return { total: result?.total ?? 0, count: result?.count ?? 0 };
  }

  // ── Get all ───────────────────────────────────────────────────────────────
  async getAll({ from, to, source, search, limit = 20, page = 1 } = {}) {
    const match = {};
    if (from && to) match.date = { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) };
    if (source)     match.source = source;
    if (search)     match.$text  = { $search: search };

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

  // ── Source breakdown ──────────────────────────────────────────────────────
  async getBySource({ from, to } = {}) {
    const match = {};
    if (from && to) match.date = { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) };

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id:   '$source',
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
  async getMonthlySummary({ year } = {}) {
    const match = {};
    if (year) {
      match.date = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }

    return await this.collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year:  { $year: '$date' },
            month: { $month: '$date' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).toArray();
  }

  // ── Export all ────────────────────────────────────────────────────────────
  async exportAll({ from, to } = {}) {
    const match = {};
    if (from && to) match.date = { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) };
    return await this.collection.find(match).sort({ date: -1 }).toArray();
  }
}

export default new IncomeModel();
