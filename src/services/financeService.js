import expenseModel from '../models/expense.js';
import incomeModel from '../models/income.js';

class FinanceService {
  async getTotalExpense(args) {
    const total = await expenseModel.getTotal(args);
    return `Total expenses: ${total} INR`;
  }

  async addExpense(args) {
    return await expenseModel.add(args);
  }

  async addIncome(args) {
    return await incomeModel.add(args);
  }

  async getMoneyBalance() {
    const totalIncome = await incomeModel.getTotal();
    const totalExpense = await expenseModel.getTotal();
    const balance = totalIncome - totalExpense;
    
    return `Current account balance: ${balance} INR`;
  }
}

export default new FinanceService();