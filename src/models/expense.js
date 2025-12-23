import dbConnection from '../config/database.js';

class ExpenseModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('expenses');
  }

  async add({ name, amount }) {
    const expense = {
      name,
      amount: Number(amount),
      createdAt: new Date()
    };
    
    await this.collection.insertOne(expense);
    return 'Expense transaction successfully recorded in database.';
  }

  async getTotal({ from, to } = {}) {
    const match = {};
    
    if (from && to) {
      match.createdAt = { 
        $gte: new Date(from), 
        $lte: new Date(to) 
      };
    }

    const [result] = await this.collection.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    return result?.total ?? 0;
  }

  async getAll() {
    return await this.collection.find({}).toArray();
  }
}

export default new ExpenseModel();


// import dbConnection from '../config/database.js';
// import { ObjectId } from 'mongodb';

// class ExpenseModel {
//   constructor() {
//     this.collection = null;
//     this.isInitialized = false;
//   }

//   async initialize() {
//     try {
//       this.collection = dbConnection.getDatabase().collection('expenses');
//       // Create indexes for better performance (only if they don't exist)
//       await this.collection.createIndex({ createdAt: -1 }, { background: true });
//       await this.collection.createIndex({ amount: 1 }, { background: true });
//       await this.collection.createIndex({ name: 'text' }, { background: true });
//       this.isInitialized = true;
//       console.log('ExpenseModel initialized successfully');
//     } catch (error) {
//       console.error('Failed to initialize ExpenseModel:', error);
//       throw new Error('Database initialization failed');
//     }
//   }

//   _validateInitialization() {
//     if (!this.isInitialized || !this.collection) {
//       throw new Error('ExpenseModel not initialized. Call initialize() first.');
//     }
//   }

//   _validateExpenseData({ name, amount, category }) {
//     const errors = [];

//     if (!name || typeof name !== 'string' || name.trim().length === 0) {
//       errors.push('Name is required and must be a non-empty string');
//     }

//     if (amount === undefined || amount === null) {
//       errors.push('Amount is required');
//     }

//     const numAmount = Number(amount);
//     if (isNaN(numAmount) || numAmount <= 0) {
//       errors.push('Amount must be a positive number');
//     }

//     if (category && typeof category !== 'string') {
//       errors.push('Category must be a string');
//     }

//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     return {
//       name: name.trim(),
//       amount: numAmount,
//       category: category?.trim() || 'General'
//     };
//   }

//   async add({ name, amount, category, description }) {
//     this._validateInitialization();
    
//     try {
//       const validatedData = this._validateExpenseData({ name, amount, category });
      
//       const expense = {
//         ...validatedData,
//         description: description?.trim() || '',
//         createdAt: new Date(),
//         updatedAt: new Date()
//       };

//       const result = await this.collection.insertOne(expense);
      
//       console.log(`Expense added: ${expense.name} - $${expense.amount}`);
      
//       return {
//         success: true,
//         message: 'Expense transaction successfully recorded in database.',
//         id: result.insertedId,
//         expense: { ...expense, _id: result.insertedId }
//       };
//     } catch (error) {
//       console.error('Error adding expense:', error);
//       throw new Error(`Failed to add expense: ${error.message}`);
//     }
//   }

//   async update(id, updateData) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid expense ID');
//       }

//       const validatedData = this._validateExpenseData(updateData);
//       const updateDoc = {
//         ...validatedData,
//         updatedAt: new Date()
//       };

//       if (updateData.description !== undefined) {
//         updateDoc.description = updateData.description?.trim() || '';
//       }

//       const result = await this.collection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updateDoc }
//       );

//       if (result.matchedCount === 0) {
//         throw new Error('Expense not found');
//       }

//       console.log(`Expense updated: ${id}`);
      
//       return {
//         success: true,
//         message: 'Expense updated successfully',
//         modifiedCount: result.modifiedCount
//       };
//     } catch (error) {
//       console.error('Error updating expense:', error);
//       throw new Error(`Failed to update expense: ${error.message}`);
//     }
//   }

//   async delete(id) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid expense ID');
//       }

//       const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
      
//       if (result.deletedCount === 0) {
//         throw new Error('Expense not found');
//       }

//       console.log(`Expense deleted: ${id}`);
      
//       return {
//         success: true,
//         message: 'Expense deleted successfully',
//         deletedCount: result.deletedCount
//       };
//     } catch (error) {
//       console.error('Error deleting expense:', error);
//       throw new Error(`Failed to delete expense: ${error.message}`);
//     }
//   }

//   async getTotal({ from, to, category } = {}) {
//     this._validateInitialization();
    
//     try {
//       const match = {};

//       if (from && to) {
//         const fromDate = new Date(from);
//         const toDate = new Date(to);
        
//         if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
//           throw new Error('Invalid date format');
//         }
        
//         if (fromDate > toDate) {
//           throw new Error('From date cannot be later than to date');
//         }

//         match.createdAt = {
//           $gte: fromDate,
//           $lte: toDate
//         };
//       }

//       if (category) {
//         match.category = category;
//       }

//       const [result] = await this.collection.aggregate([
//         { $match: match },
//         { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
//       ]).toArray();

//       return {
//         total: result?.total ?? 0,
//         count: result?.count ?? 0,
//         filters: { from, to, category }
//       };
//     } catch (error) {
//       console.error('Error calculating total expenses:', error);
//       throw new Error(`Failed to calculate total: ${error.message}`);
//     }
//   }

//   async getAll({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1, category, search } = {}) {
//     this._validateInitialization();
    
//     try {
//       // Validate pagination parameters
//       const pageNum = Math.max(1, parseInt(page));
//       const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Max 100 items per page
      
//       const match = {};
      
//       if (category) {
//         match.category = category;
//       }

//       if (search) {
//         match.$or = [
//           { name: { $regex: search, $options: 'i' } },
//           { description: { $regex: search, $options: 'i' } }
//         ];
//       }

//       const skip = (pageNum - 1) * limitNum;
//       const sort = { [sortBy]: parseInt(sortOrder) };

//       const [expenses, totalCount] = await Promise.all([
//         this.collection
//           .find(match)
//           .sort(sort)
//           .skip(skip)
//           .limit(limitNum)
//           .toArray(),
//         this.collection.countDocuments(match)
//       ]);

//       return {
//         expenses,
//         pagination: {
//           currentPage: pageNum,
//           totalPages: Math.ceil(totalCount / limitNum),
//           totalItems: totalCount,
//           itemsPerPage: limitNum,
//           hasNext: pageNum * limitNum < totalCount,
//           hasPrev: pageNum > 1
//         }
//       };
//     } catch (error) {
//       console.error('Error fetching expenses:', error);
//       throw new Error(`Failed to fetch expenses: ${error.message}`);
//     }
//   }

//   async getById(id) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid expense ID');
//       }

//       const expense = await this.collection.findOne({ _id: new ObjectId(id) });
      
//       if (!expense) {
//         throw new Error('Expense not found');
//       }

//       return expense;
//     } catch (error) {
//       console.error('Error fetching expense by ID:', error);
//       throw new Error(`Failed to fetch expense: ${error.message}`);
//     }
//   }

//   async getByCategory() {
//     this._validateInitialization();
    
//     try {
//       const result = await this.collection.aggregate([
//         {
//           $group: {
//             _id: '$category',
//             total: { $sum: '$amount' },
//             count: { $sum: 1 },
//             avgAmount: { $avg: '$amount' }
//           }
//         },
//         { $sort: { total: -1 } }
//       ]).toArray();

//       return result.map(item => ({
//         category: item._id,
//         total: item.total,
//         count: item.count,
//         average: Math.round(item.avgAmount * 100) / 100
//       }));
//     } catch (error) {
//       console.error('Error fetching expenses by category:', error);
//       throw new Error(`Failed to fetch category breakdown: ${error.message}`);
//     }
//   }
// }

// // Create and export a singleton instance
// const expenseModel = new ExpenseModel();
// export default expenseModel;