export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'getTotalExpense',
      description: 'Calculate total expenses within a date range.',
      parameters: { 
        type: 'object', 
        properties: { 
          from: { type: 'string' }, 
          to: { type: 'string' } 
        } 
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addExpense',
      description: 'Record a new expense.',
      parameters: { 
        type: 'object', 
        properties: { 
          name: { type: 'string' }, 
          amount: { type: 'string' } 
        }, 
        required: ['name', 'amount'] 
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addIncome',
      description: 'Record a new income.',
      parameters: { 
        type: 'object', 
        properties: { 
          name: { type: 'string' }, 
          amount: { type: 'string' } 
        }, 
        required: ['name', 'amount'] 
      },
    },
  },
  {
    type: 'function',
    function: { 
      name: 'getMoneyBalance', 
      description: 'Return current balance.' 
    },
  },
];