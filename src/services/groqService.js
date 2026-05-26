import Groq from 'groq-sdk';

// Rough token estimate: 1 token ≈ 4 chars. We keep a sliding window so the
// conversation never exceeds ~12 000 tokens (well under the 32k context limit).
const MAX_HISTORY_CHARS = 48_000; // ~12k tokens

class GroqService {
  constructor() {
    this.groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  /**
   * Trims the message history to stay within the character budget.
   * Always keeps the system message (index 0) and the most recent messages.
   *
   * @param {object[]} messages
   * @returns {object[]}
   */
  trimHistory(messages) {
    if (!messages.length) return messages;

    const system = messages[0]; // always keep system prompt
    const rest   = messages.slice(1);

    let totalChars = JSON.stringify(system).length;
    const kept = [];

    // Walk backwards (newest first) and keep until we hit the budget
    for (let i = rest.length - 1; i >= 0; i--) {
      const size = JSON.stringify(rest[i]).length;
      if (totalChars + size > MAX_HISTORY_CHARS) break;
      kept.unshift(rest[i]);
      totalChars += size;
    }

    return [system, ...kept];
  }

  /**
   * Creates a chat completion with automatic retry on rate-limit (429) and
   * transient server errors (5xx).
   *
   * @param {object[]} messages
   * @param {object[]} tools
   * @param {number}   [maxRetries=3]
   * @returns {Promise<object>}
   */
  async createChatCompletion(messages, tools, maxRetries = 3) {
    const trimmed = this.trimHistory(messages);

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.groq.chat.completions.create({
          messages:    trimmed,
          model:       this.model,
          tools,
          tool_choice: 'auto',
        });
      } catch (err) {
        lastError = err;

        const status = err?.status ?? err?.statusCode ?? 0;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (!isRetryable || attempt === maxRetries) throw err;

        // Exponential back-off: 1s, 2s, 4s …
        const delay = Math.pow(2, attempt - 1) * 1000;
        process.stderr.write(`  ⚠  Groq API ${status} — retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})…\n`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  }
}

export default new GroqService();
