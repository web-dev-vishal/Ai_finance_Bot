import readline from 'node:readline/promises';
import dbConnection from './config/database.js';
import expenseModel from './models/expense.js';
import incomeModel from './models/income.js';
import groqService from './services/groqService.js';
import financeService from './services/financeService.js';
import { toolDefinitions } from './utils/toolDefinitions.js';

class FinanceBotApp {
  constructor() {
    this.messages = [
      {
        role: 'system',
        content: `You are FinanceBot.  
Functions:
1. getTotalExpense({from?, to?}) → string
2. addExpense({name, amount}) → string
3. addIncome({name, amount}) → string
4. getMoneyBalance() → string

Currencies are in INR.`,
      },
    ];
  }

  async initialize() {
    // Connect to database
    await dbConnection.connect();
    await dbConnection.initializeCollections();
    
    // Initialize models
    expenseModel.initialize();
    incomeModel.initialize();
  }

  async handleToolCall(toolCall) {
    const { name: functionName, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args || '{}');

    switch (functionName) {
      case 'getTotalExpense':
        return await financeService.getTotalExpense(parsedArgs);
      case 'addExpense':
        return await financeService.addExpense(parsedArgs);
      case 'addIncome':
        return await financeService.addIncome(parsedArgs);
      case 'getMoneyBalance':
        return await financeService.getMoneyBalance();
      default:
        return 'Unknown function called';
    }
  }

  async startChatLoop() {
    const rl = readline.createInterface({ 
      input: process.stdin, 
      output: process.stdout 
    });

    console.log('🤖 FinanceBot is ready! Type "bye" to exit.\n');

    while (true) {
      const userInput = await rl.question('User: ');
      
      if (userInput.trim().toLowerCase() === 'bye') {
        console.log('👋 Goodbye!');
        break;
      }

      this.messages.push({ role: 'user', content: userInput });

      // Handle AI response and tool calls
      while (true) {
        const response = await groqService.createChatCompletion(
          this.messages, 
          toolDefinitions
        );

        const message = response.choices[0].message;
        this.messages.push(message);

        const toolCalls = message.tool_calls;
        
        if (!toolCalls) {
          // No tool calls, display response and break
          console.log(`Assistant: ${message.content}\n`);
          break;
        }

        // Process tool calls
        for (const toolCall of toolCalls) {
          const output = await this.handleToolCall(toolCall);
          this.messages.push({ 
            role: 'tool', 
            content: output, 
            tool_call_id: toolCall.id 
          });
        }
      }
    }

    rl.close();
  }

  async shutdown() {
    await dbConnection.close();
  }
}

// Main execution
async function main() {
  const app = new FinanceBotApp();
  
  try {
    await app.initialize();
    await app.startChatLoop();
  } catch (error) {
    console.error('❌ Application error:', error);
  } finally {
    await app.shutdown();
  }
}

main().catch(console.error);