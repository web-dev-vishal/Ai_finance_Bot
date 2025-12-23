import dbConnection from '../config/database.js';

class IncomeModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('incomes');
  }

  async add({ name, amount }) {
    const income = {
      name,
      amount: Number(amount),
      createdAt: new Date()
    };
    
    await this.collection.insertOne(income);
    return 'Income transaction successfully recorded in database.';
  }

  async getTotal() {
    const [result] = await this.collection.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    return result?.total ?? 0;
  }

  async getAll() {
    return await this.collection.find({}).toArray();
  }
}

export default new IncomeModel();

// class IncomeModel {
//   constructor() {
//     this.collection = null;
//     this.isInitialized = false;
//   }

//   async initialize() {
//     try {
//       this.collection = dbConnection.getDatabase().collection('incomes');
//       // Create indexes for better performance (only if they don't exist)
//       await this.collection.createIndex({ createdAt: -1 }, { background: true });
//       await this.collection.createIndex({ amount: 1 }, { background: true });
//       await this.collection.createIndex({ name: 'text' }, { background: true });
//       this.isInitialized = true;
//       console.log('IncomeModel initialized successfully');
//     } catch (error) {
//       console.error('Failed to initialize IncomeModel:', error);
//       throw new Error('Database initialization failed');
//     }
//   }

//   _validateInitialization() {
//     if (!this.isInitialized || !this.collection) {
//       throw new Error('IncomeModel not initialized. Call initialize() first.');
//     }
//   }

//   _validateIncomeData({ name, amount, source }) {
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

//     if (source && typeof source !== 'string') {
//       errors.push('Source must be a string');
//     }

//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     return {
//       name: name.trim(),
//       amount: numAmount,
//       source: source?.trim() || 'Other'
//     };
//   }

//   async add({ name, amount, source, description }) {
//     this._validateInitialization();
    
//     try {
//       const validatedData = this._validateIncomeData({ name, amount, source });
      
//       const income = {
//         ...validatedData,
//         description: description?.trim() || '',
//         createdAt: new Date(),
//         updatedAt: new Date()
//       };

//       const result = await this.collection.insertOne(income);
      
//       console.log(`Income added: ${income.name} - $${income.amount}`);
      
//       return {
//         success: true,
//         message: 'Income transaction successfully recorded in database.',
//         id: result.insertedId,
//         income: { ...income, _id: result.insertedId }
//       };
//     } catch (error) {
//       console.error('Error adding income:', error);
//       throw new Error(`Failed to add income: ${error.message}`);
//     }
//   }

//   async update(id, updateData) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid income ID');
//       }

//       const validatedData = this._validateIncomeData(updateData);
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
//         throw new Error('Income not found');
//       }

//       console.log(`Income updated: ${id}`);
      
//       return {
//         success: true,
//         message: 'Income updated successfully',
//         modifiedCount: result.modifiedCount
//       };
//     } catch (error) {
//       console.error('Error updating income:', error);
//       throw new Error(`Failed to update income: ${error.message}`);
//     }
//   }

//   async delete(id) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid income ID');
//       }

//       const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
      
//       if (result.deletedCount === 0) {
//         throw new Error('Income not found');
//       }

//       console.log(`Income deleted: ${id}`);
      
//       return {
//         success: true,
//         message: 'Income deleted successfully',
//         deletedCount: result.deletedCount
//       };
//     } catch (error) {
//       console.error('Error deleting income:', error);
//       throw new Error(`Failed to delete income: ${error.message}`);
//     }
//   }

//   async getTotal({ from, to, source } = {}) {
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

//       if (source) {
//         match.source = source;
//       }

//       const [result] = await this.collection.aggregate([
//         { $match: match },
//         { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
//       ]).toArray();

//       return {
//         total: result?.total ?? 0,
//         count: result?.count ?? 0,
//         filters: { from, to, source }
//       };
//     } catch (error) {
//       console.error('Error calculating total income:', error);
//       throw new Error(`Failed to calculate total: ${error.message}`);
//     }
//   }

//   async getAll({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1, source, search } = {}) {
//     this._validateInitialization();
    
//     try {
//       // Validate pagination parameters
//       const pageNum = Math.max(1, parseInt(page));
//       const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Max 100 items per page
      
//       const match = {};
      
//       if (source) {
//         match.source = source;
//       }

//       if (search) {
//         match.$or = [
//           { name: { $regex: search, $options: 'i' } },
//           { description: { $regex: search, $options: 'i' } }
//         ];
//       }

//       const skip = (pageNum - 1) * limitNum;
//       const sort = { [sortBy]: parseInt(sortOrder) };

//       const [incomes, totalCount] = await Promise.all([
//         this.collection
//           .find(match)
//           .sort(sort)
//           .skip(skip)
//           .limit(limitNum)
//           .toArray(),
//         this.collection.countDocuments(match)
//       ]);

//       return {
//         incomes,
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
//       console.error('Error fetching incomes:', error);
//       throw new Error(`Failed to fetch incomes: ${error.message}`);
//     }
//   }

//   async getById(id) {
//     this._validateInitialization();
    
//     try {
//       if (!ObjectId.isValid(id)) {
//         throw new Error('Invalid income ID');
//       }

//       const income = await this.collection.findOne({ _id: new ObjectId(id) });
      
//       if (!income) {
//         throw new Error('Income not found');
//       }

//       return income;
//     } catch (error) {
//       console.error('Error fetching income by ID:', error);
//       throw new Error(`Failed to fetch income: ${error.message}`);
//     }
//   }

//   async getBySource() {
//     this._validateInitialization();
    
//     try {
//       const result = await this.collection.aggregate([
//         {
//           $group: {
//             _id: '$source',
//             total: { $sum: '$amount' },
//             count: { $sum: 1 },
//             avgAmount: { $avg: '$amount' }
//           }
//         },
//         { $sort: { total: -1 } }
//       ]).toArray();

//       return result.map(item => ({
//         source: item._id,
//         total: item.total,
//         count: item.count,
//         average: Math.round(item.avgAmount * 100) / 100
//       }));
//     } catch (error) {
//       console.error('Error fetching incomes by source:', error);
//       throw new Error(`Failed to fetch source breakdown: ${error.message}`);
//     }
//   }
// }

// export const expenseModel = new ExpenseModel();
// export const incomeModel = new IncomeModel();

// // Export default for backward compatibility
// export default { expenseModel, incomeModel };