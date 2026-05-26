/**
 * Redis client singleton using ioredis.
 *
 * Used for:
 *  - Session token blacklisting (logout)
 *  - Password-reset OTP storage (TTL = 15 min)
 *  - Login rate-limiting (max 5 attempts per 15 min per email)
 *
 * If Redis is not configured (REDIS_URL not set), the module falls back to an
 * in-memory Map so the app still works without Redis in development.
 */
import Redis from 'ioredis';

class RedisClient {
  constructor() {
    this.client = null;
    this._memStore = new Map(); // fallback when Redis is unavailable
    this._memTTL   = new Map(); // TTL tracking for in-memory fallback
    this.connected = false;
  }

  async connect() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('⚠️   REDIS_URL not set — using in-memory fallback (not suitable for production).');
      this.connected = false;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      await this.client.connect();
      this.connected = true;
      console.log(`✅  Redis connected  →  ${redisUrl}`);

      this.client.on('error', (err) => {
        // Log but don't crash — fall back gracefully
        console.error(`⚠️   Redis error: ${err.message}`);
      });
    } catch (err) {
      console.warn(`⚠️   Redis connection failed (${err.message}) — using in-memory fallback.`);
      this.client = null;
      this.connected = false;
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('✅  Redis connection closed.');
    }
  }

  // ── Core helpers ──────────────────────────────────────────────────────────

  /** Set a key with optional TTL in seconds */
  async set(key, value, ttlSeconds = null) {
    if (this.connected && this.client) {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } else {
      // In-memory fallback
      this._memStore.set(key, value);
      if (ttlSeconds) {
        const expiry = Date.now() + ttlSeconds * 1000;
        this._memTTL.set(key, expiry);
      }
    }
  }

  /** Get a key's value (returns null if missing or expired) */
  async get(key) {
    if (this.connected && this.client) {
      return await this.client.get(key);
    }
    // In-memory fallback with TTL check
    const expiry = this._memTTL.get(key);
    if (expiry && Date.now() > expiry) {
      this._memStore.delete(key);
      this._memTTL.delete(key);
      return null;
    }
    return this._memStore.get(key) ?? null;
  }

  /** Delete a key */
  async del(key) {
    if (this.connected && this.client) {
      await this.client.del(key);
    } else {
      this._memStore.delete(key);
      this._memTTL.delete(key);
    }
  }

  /** Increment a counter and set TTL on first increment */
  async incr(key, ttlSeconds = null) {
    if (this.connected && this.client) {
      const val = await this.client.incr(key);
      if (val === 1 && ttlSeconds) {
        await this.client.expire(key, ttlSeconds);
      }
      return val;
    }
    // In-memory fallback
    const current = parseInt(this._memStore.get(key) ?? '0', 10);
    const next = current + 1;
    this._memStore.set(key, String(next));
    if (next === 1 && ttlSeconds) {
      this._memTTL.set(key, Date.now() + ttlSeconds * 1000);
    }
    return next;
  }

  // ── Auth-specific helpers ─────────────────────────────────────────────────

  /** Blacklist a PASETO token (on logout). TTL = remaining token lifetime. */
  async blacklistToken(token, ttlSeconds) {
    await this.set(`blacklist:${token}`, '1', ttlSeconds);
  }

  /** Check if a token has been blacklisted */
  async isTokenBlacklisted(token) {
    const val = await this.get(`blacklist:${token}`);
    return val !== null;
  }

  /** Store a password-reset OTP for a user (TTL = 15 min) */
  async setResetOTP(email, otp) {
    await this.set(`reset:${email.toLowerCase()}`, otp, 15 * 60);
  }

  /** Retrieve the stored OTP for an email */
  async getResetOTP(email) {
    return await this.get(`reset:${email.toLowerCase()}`);
  }

  /** Delete the OTP after it has been used */
  async deleteResetOTP(email) {
    await this.del(`reset:${email.toLowerCase()}`);
  }

  /** Track login attempts for rate limiting (max 5 per 15 min) */
  async incrementLoginAttempts(email) {
    const key = `login_attempts:${email.toLowerCase()}`;
    return await this.incr(key, 15 * 60);
  }

  async getLoginAttempts(email) {
    const val = await this.get(`login_attempts:${email.toLowerCase()}`);
    return parseInt(val ?? '0', 10);
  }

  async clearLoginAttempts(email) {
    await this.del(`login_attempts:${email.toLowerCase()}`);
  }
}

export default new RedisClient();
