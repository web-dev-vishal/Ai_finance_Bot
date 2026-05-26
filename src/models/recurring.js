import { ObjectId } from 'mongodb';
import dbConnection from '../config/database.js';
import { validateName, validateAmount, validateObjectId } from '../utils/validators.js';

/**
 * Recurring transaction model.
 * Stores templates for transactions that repeat on a schedule.
 * The agent can list due recurring items and let the user confirm posting them.
 *
 * frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
 * type:      'expense' | 'income'
 */
class RecurringModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('recurring');
  }

  async add({ name, amount, type, frequency, category, source, description, startDate }) {
    const validName   = validateName(name);
    const validAmount = validateAmount(amount);

    if (!['expense', 'income'].includes(type)) {
      throw new Error('Type must be "expense" or "income".');
    }
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      throw new Error('Frequency must be daily, weekly, monthly, or yearly.');
    }

    const start = startDate ? new Date(startDate) : new Date();
    if (isNaN(start.getTime())) throw new Error(`Invalid startDate: "${startDate}".`);

    const doc = {
      name:        validName,
      amount:      validAmount,
      type,
      frequency,
      category:    type === 'expense' ? (category?.trim() || 'General') : undefined,
      source:      type === 'income'  ? (source?.trim()   || 'Other')   : undefined,
      description: description?.trim() || '',
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

  async list({ type, activeOnly = true } = {}) {
    const match = {};
    if (type)       match.type   = type;
    if (activeOnly) match.active = true;
    return await this.collection.find(match).sort({ nextDue: 1 }).toArray();
  }

  async getDue() {
    const now = new Date();
    return await this.collection
      .find({ active: true, nextDue: { $lte: now } })
      .sort({ nextDue: 1 })
      .toArray();
  }

  /**
   * Advance the nextDue date after a recurring item is posted.
   */
  async markPosted(id) {
    validateObjectId(id, 'recurring ID');
    const item = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!item) throw new Error(`Recurring item "${id}" not found.`);

    const next = new Date(item.nextDue);
    switch (item.frequency) {
      case 'daily':   next.setDate(next.getDate() + 1);       break;
      case 'weekly':  next.setDate(next.getDate() + 7);       break;
      case 'monthly': next.setMonth(next.getMonth() + 1);     break;
      case 'yearly':  next.setFullYear(next.getFullYear() + 1); break;
    }

    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { nextDue: next, lastPosted: new Date() } }
    );
    return next;
  }

  async deactivate(id) {
    validateObjectId(id, 'recurring ID');
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { active: false, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `⏸️  Recurring item ${id} deactivated.`;
  }

  async delete(id) {
    validateObjectId(id, 'recurring ID');
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new Error(`Recurring item "${id}" not found.`);
    return `🗑️  Recurring item ${id} deleted.`;
  }
}

export default new RecurringModel();
