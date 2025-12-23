import Groq from 'groq-sdk';

class GroqService {
  constructor() {
    this.groq = new Groq({ 
      apiKey: process.env.GROQ_API_KEY 
    });
  }

  async createChatCompletion(messages, tools) {
    return await this.groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      tools
    });
  }
}

export default new GroqService();