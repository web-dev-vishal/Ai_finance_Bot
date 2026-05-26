import Groq from 'groq-sdk';

class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async createChatCompletion(messages, tools) {
    return await this.groq.chat.completions.create({
      messages,
      model: this.model,
      tools,
      tool_choice: 'auto',
    });
  }
}

export default new GroqService();
