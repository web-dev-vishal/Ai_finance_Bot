/**
 * Redis client singleton using ioredis.
 *
 * Connects to Redis Cloud (RedisLabs) using individual env vars:
 *   REDIS_HOST  — e.g. redis-14618.crce283.ap-south-1-2.ec2.cloud.redislabs.com
 *   REDIS_PORT  — e.g. 14618
 *   REDIS_USER  — e.g. default
 *   REDIS_PASS  — your Redis Cloud database password
 *
 * Falls back to REDIS_URL if the individual vars are not set.
 * Falls back to an in-memory Map if neither is configured (dev only).
 *
 * Used for:
 *  - PASETO token blacklisting on logout
 *  - Password-reset OTP storage (TTL = 15 min)
 *  - Login rate-limiting (max 5 attempts per 15 min per email)
 */
import Redis from 'ioredis';

class RedisClient {
  constructor() {
    this.client    = null;
    this._memStore = new Map(); // in-memory fallback
    this._memTTL   = new Map(); // TTL tracking for in-memory fallback
    this.connected = false;
  }

  // ── Build ioredis config from env vars ───────────────────────────────────
  _buildConfig() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;
    const user = process.env.REDIS_USER || 'default';
    const pass = process.env.REDIS_PASS;
    const url  = process.env.REDIS_URL;

    // Prefer individual vars (matches Redis Cloud / RedisLabs setup)
    if (host && port) {
      const config = {
        host,
        port:               parseInt(port, 10),
        username:           user,
        maxRetriesPerRequest: 3,
        enableReadyCheck:   true,
        lazyConnect:        true,
        // Redis Cloud requires TLS on most plans
        tls:                {},
        // Reconnect strategy: try 3 times with 500ms delay
        retryStrategy: (times) => (times <= 3 ? 500 : null),
      };
      if (pass) config.password = pass;
      return { type: 'options', value: config, label: `${host}:${port}` };
    }

    // Fall back to REDIS_URL
    if (url) {
      return {
        type:  'url',
        value: url,
        label: url.replace(/:\/\/[^@]+@/, '://***@'), // mask credentials in logs
      };
    }

    return null;
  }

  async connect() {
    const cfg = this._buildConfig();

    if (!cfg) {
      console.log('⚠️   Redis not configured — using in-memory fallback (not suitable for production).');
      console.log('    Set REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASS in .env to use Redis Cloud.');
      this.connected = false;
      return;
    }

    try {
      this.client = cfg.type === 'options'
        ? new Redis(cfg.value)
        : new Redis(cfg.value, {
            maxRetriesPerRequest: 3,
            enableReadyCheck:     true,
            lazyConnect:          true,
            retryStrategy: (times) => (times <= 3 ? 500 : null),
          });

      await this.client.connect();
      this.connected = true;
      console.log(`✅  Redis connected  →  ${cfg.label}`);

      this.client.on('error', (err) => {
        console.error(`⚠️   Redis error: ${err.message}`);
      });

      this.client.on('reconnecting', () => {
        console.log('⚠️   Redis reconnecting…');
      });
    } catch (err) {
      console.warn(`⚠️   Redis connection failed (${err.message}) — using in-memory fallback.`);
      this.client    = null;
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
      this._memStore.set(key, value);
      if (ttlSeconds) {
        this._memTTL.set(key, Date.now() + ttlSeconds * 1000);
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
    const next    = current + 1;
    this._memStore.set(key, String(next));
    if (next === 1 && ttlSeconds) {
      this._memTTL.set(key, Date.now() + ttlSeconds * 1000);
    }
    return next;
  }

  // ── Auth-specific helpers ─────────────────────────────────────────────────

  /** Blacklist a PASETO token on logout. TTL = remaining token lifetime. */
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
