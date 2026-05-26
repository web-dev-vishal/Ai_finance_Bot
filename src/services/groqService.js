import Groq from 'groq-sdk';

// Character budget for history trimming.
// 1 token ≈ 4 chars; 48 000 chars ≈ 12 000 tokens — well under the 32k limit.
const MAX_HISTORY_CHARS = 48_000;

class GroqService {
  constructor() {
    this.groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  /**
   * Trim conversation history to stay within the character budget.
   *
   * Rules:
   * 1. Always keep the system message (index 0).
   * 2. Walk backwards from the newest message, keeping whole "turns".
   * 3. A turn is: one user message + the assistant reply + all its tool results.
   *    We never split a turn — dropping half a tool-call chain causes API errors.
   *
   * @param {object[]} messages  Full message array (system + history)
   * @returns {object[]}         Trimmed array safe to send to the API
   */
  trimHistory(messages) {
    if (messages.length <= 1) return messages;

    const system = messages[0];
    const rest   = messages.slice(1);

    // Group messages into atomic turns so we never split them.
    // A turn boundary is every 'user' message.
    const turns = [];
    let current = [];
    for (const msg of rest) {
      if (msg.role === 'user' && current.length > 0) {
        turns.push(current);
        current = [];
      }
      current.push(msg);
    }
    if (current.length > 0) turns.push(current);

    // Walk backwards, accumulating whole turns until we hit the budget
    let totalChars = JSON.stringify(system).length;
    const kept = [];

    for (let i = turns.length - 1; i >= 0; i--) {
      const turnSize = turns[i].reduce((s, m) => s + JSON.stringify(m).length, 0);
      if (totalChars + turnSize > MAX_HISTORY_CHARS && kept.length > 0) break;
      kept.unshift(...turns[i]);
      totalChars += turnSize;
    }

    return [system, ...kept];
  }

  /**
   * Create a chat completion with automatic retry on rate-limit (429) and
   * transient server errors (5xx). Uses exponential back-off.
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

        const status      = err?.status ?? err?.statusCode ?? 0;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (!isRetryable || attempt === maxRetries) throw err;

        // Exponential back-off: 1 s, 2 s, 4 s …
        const delay = Math.pow(2, attempt - 1) * 1_000;
        process.stderr.write(
          `  ⚠  Groq ${status} — retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})…\n`
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  }
}

export default new GroqService();
