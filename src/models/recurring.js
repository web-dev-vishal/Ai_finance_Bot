/**
 * Recurring transaction model — Fix 1: All queries scoped by userId.
 * Cleanup 3: findById no longer does a full collection scan for short IDs.
 */
import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';
import {
  validateName,
  validateAmount,
  validateObjectId,
  validateDescription,
  parseSafeDate,
} from '../utils/validators.js';

class RecurringModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('recurring');
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async add({ userId, name, amount, type, frequency, category, source, description, startDate }) {
    if (!userId) throw new Error('userId is required.');
    const validName   = validateName(name);
    const validAmount = validateAmount(amount);
    const validDesc   = validateDescription(description);

    if (!['expense', 'income'].includes(type)) {
      throw new Error('Type must be "expense" or "income".');
    }
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      throw new Error('Frequency must be daily, weekly, monthly, or yearly.');
    }

    const start = startDate ? parseSafeDate(startDate, 'startDate') : new Date();

    const doc = {
      userId:      new ObjectId(String(userId)),
      name:        validName,
      amount:      validAmount,
      type,
      frequency,
      category:    type === 'expense' ? (category?.trim() || 'General') : undefined,
      source:      type === 'income'  ? (source?.trim()   || 'Other')   : undefined,
      description: validDesc,
      startDate:   start,
      nextDue:     start,
      active:      true,
      createdAt:   new Date(),
    };

    // Remove undefined fields
    Object.keys(doc).forEach(k => doc[k] === undefined && delete doc[k]);

    const result = await this.collection.insertOne(doc);
    return `✅ Recurring ${type} added — ${doc.name} | ₹${doc.amount} | ${doc.frequency} | ID: ${result.insertedId}`;
  }

  // ── List ──────────────────────────────────────────────────────────────────
  async list({ userId, type, activeOnly = true } = {}) {
    if (!userId) throw new Error('userId is required.');
    const match = { userId: new ObjectId(String(userId)) };
    if (type)       match.type   = type;
    if (activeOnly) match.active = true;
    return await this.collection.find(match).sort({ nextDue: 1 }).toArray();
  }

  // ── Get due ───────────────────────────────────────────────────────────────
  async getDue(userId) {
    if (!userId) throw new Error('userId is required.');
    const now = new Date();
    return await this.collection
      .find({ userId: new ObjectId(String(userId)), active: true, nextDue: { $lte: now } })
      .sort({ nextDue: 1 })
      .toArray();
  }

  // ── Mark posted (advance nextDue) ─────────────────────────────────────────
  async markPosted(id) {
    validateObjectId(id, 'recurring ID');
    const item = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!item) throw new Error(`Recurring item "${id}" not found.`);

    const next = new Date(item.nextDue);
    switch (item.frequency) {
      case 'daily':   next.setDate(next.getDate() + 1);         break;
      case 'weekly':  next.setDate(next.getDate() + 7);         break;
      case 'monthly': next.setMonth(next.getMonth() + 1);       break;
      case 'yearly':  next.setFullYear(next.getFullYear() + 1); break;
    }

    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { nextDue: next, lastPosted: new Date() } }
    );
    return next;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update({ userId, id, name, amount, frequency, category, source, description }) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'recurring ID');

    const upd = { updatedAt: new Date() };
    if (name        !== undefined) upd.name        = validateName(name);
    if (amount      !== undefined) upd.amount      = validateAmount(amount);
    if (frequency   !== undefined) {
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
        throw new Error('Frequency must be daily, weekly, monthly, or yearly.');
      }
      upd.frequency = frequency;
    }
    if (category    !== undefined) upd.category    = category?.trim() || 'General';
    if (source      !== undefined) upd.source      = source?.trim()   || 'Other';
    if (description !== undefined) upd.description = validateDescription(description);

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(userId)) },
      { $set: upd }
    );
    if (result.matchedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `✏️  Recurring item ${id} updated.`;
  }

  // ── Deactivate ────────────────────────────────────────────────────────────
  async deactivate(userId, id) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'recurring ID');
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(userId)) },
      { $set: { active: false, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `⏸️  Recurring item ${id} deactivated.`;
  }

  // ── Reactivate ────────────────────────────────────────────────────────────
  async reactivate(userId, id) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'recurring ID');
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(userId)) },
      { $set: { active: true, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `▶️  Recurring item ${id} reactivated.`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete(userId, id) {
    if (!userId) throw new Error('userId is required.');
    validateObjectId(id, 'recurring ID');
    const result = await this.collection.deleteOne({
      _id:    new ObjectId(id),
      userId: new ObjectId(String(userId)),
    });
    if (result.deletedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `🗑️  Recurring item ${id} deleted.`;
  }

  // ── Find by ID (Cleanup 3: no full-collection scan) ───────────────────────
  /**
   * Find a recurring item by full 24-char ObjectId.
   * Short IDs are no longer supported — the LLM always receives full IDs.
   * Returns null if not found.
   */
  async findById(userId, id) {
    if (!userId) throw new Error('userId is required.');
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new Error(`Invalid recurring ID "${id}". Please use the full 24-character ID shown in the list.`);
    }
    return await this.collection.findOne({
      _id:    new ObjectId(id),
      userId: new ObjectId(String(userId)),
    });
  }

  // ── Delete all by user (for account deletion) ─────────────────────────────
  async deleteAllByUser(userId) {
    if (!userId) throw new Error('userId is required.');
    return await this.collection.deleteMany({ userId: new ObjectId(String(userId)) });
  }
}

export default new RecurringModel();
