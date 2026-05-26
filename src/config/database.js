/**
 * MongoDB connection singleton.
 * Manages connection lifecycle and ensures all indexes exist on startup.
 */
import { MongoClient } from 'mongodb';

class DatabaseConnection {
  constructor() {
    this.uri    = process.env.MONGO_URI || 'mongodb://localhost:27017';
    this.dbName = process.env.DB_NAME   || 'financeBot';
    this.client = null;
    this.db     = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is not running
      });
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      console.log(`✅  MongoDB connected  →  ${this.uri}  /  ${this.dbName}`);
      return this.db;
    } catch (err) {
      console.error(`❌  MongoDB connection failed: ${err.message}`);
      console.error('    Make sure MongoDB is running (mongod) and MONGO_URI is correct in .env');
      throw err;
    }
  }

  /**
   * Create all indexes idempotently.
   * Safe to call on every startup — MongoDB ignores duplicate index creation.
   */
  async initializeCollections() {
    const expenses  = this.db.collection('expenses');
    const incomes   = this.db.collection('incomes');
    const budgets   = this.db.collection('budgets');
    const recurring = this.db.collection('recurring');
    const users     = this.db.collection('users');

    await Promise.all([
      // Expenses — compound userId indexes (Fix 1)
      expenses.createIndex({ userId: 1, date: -1 }),
      expenses.createIndex({ userId: 1, createdAt: -1 }),
      expenses.createIndex({ userId: 1, category: 1 }),
      expenses.createIndex({ name: 'text', description: 'text' }),

      // Incomes — compound userId indexes (Fix 1)
      incomes.createIndex({ userId: 1, date: -1 }),
      incomes.createIndex({ userId: 1, createdAt: -1 }),
      incomes.createIndex({ userId: 1, source: 1 }),
      incomes.createIndex({ name: 'text', description: 'text' }),

      // Budgets — compound unique [userId, month] (Fix 1)
      budgets.createIndex({ userId: 1, month: 1 }, { unique: true }),

      // Recurring — compound userId indexes (Fix 1)
      recurring.createIndex({ userId: 1, nextDue: 1 }),
      recurring.createIndex({ userId: 1, active: 1 }),
      recurring.createIndex({ userId: 1, type: 1 }),

      // Users
      users.createIndex({ email: 1 }, { unique: true }),
      users.createIndex({ createdAt: -1 }),
    ]);

    console.log(`✅  Collections and indexes ready.`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✅  MongoDB connection closed.');
    }
  }

  /**
   * Returns the active database instance.
   * Throws if called before connect().
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() before using the database.');
    }
    return this.db;
  }
}

export default new DatabaseConnection();
