import { MongoClient } from 'mongodb';

class DatabaseConnection {
  constructor() {
    this.uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    this.dbName = process.env.DB_NAME || 'financeBot';
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      console.log('✅ Connected to MongoDB →', this.uri);
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async initializeCollections() {
    const expenseCol = this.db.collection('expenses');
    const incomeCol  = this.db.collection('incomes');
    const budgetCol  = this.db.collection('budgets');

    // Create indexes for performance (idempotent)
    await expenseCol.createIndex({ createdAt: -1 });
    await expenseCol.createIndex({ category: 1 });
    await expenseCol.createIndex({ name: 'text', description: 'text' });

    await incomeCol.createIndex({ createdAt: -1 });
    await incomeCol.createIndex({ source: 1 });
    await incomeCol.createIndex({ name: 'text', description: 'text' });

    await budgetCol.createIndex({ month: 1 }, { unique: true });

    console.log(`✅ Database "${this.dbName}" ready.`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB connection closed.');
    }
  }

  getDatabase() {
    if (!this.db) throw new Error('DB not connected. Call connect() first.');
    return this.db;
  }
}

export default new DatabaseConnection();
