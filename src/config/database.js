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
      console.log('✅ Connected to MongoDB at', this.uri);
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async initializeCollections() {
    const expenseCol = this.db.collection('expenses');
    const incomeCol = this.db.collection('incomes');

    // Create seed documents to ensure collections exist
    await expenseCol.insertOne({ 
      _seed: true, 
      name: 'Seed expense', 
      amount: 1, 
      createdAt: new Date() 
    });
    
    await incomeCol.insertOne({ 
      _seed: true, 
      name: 'Seed income', 
      amount: 1, 
      createdAt: new Date() 
    });

    console.log('✅ Database', this.dbName, 'and collections created / verified.');
    console.log('💡 Open MongoDB Compass → connect → you should now see:', this.dbName);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB connection closed');
    }
  }

  getDatabase() {
    return this.db;
  }
}

export default new DatabaseConnection();

// import { MongoClient } from 'mongodb';
// const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
// const client = new MongoClient(uri);
// let db = null;
// export async function connect() {
// if (db) return db;               // already connected
// await client.connect();
// db = client.db('financeBot');
// console.log('✅  MongoDB connected');
// return db;
// }
// export function getDatabase() {
// if (!db) throw new Error('DB not connected. Call connect() first.');
// return db;
// }