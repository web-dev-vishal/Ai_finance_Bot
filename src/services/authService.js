/**
 * AuthService — handles registration, login, logout, and password reset.
 *
 * Token strategy: PASETO v4.public (Ed25519 asymmetric signing)
 *  - Replaces JWT entirely — no JWT_SECRET needed
 *  - PASETO_SECRET_KEY in .env holds the 64-byte Ed25519 private key as hex
 *  - Tokens are signed with the private key; verified with the derived public key
 *  - Logout blacklists the token in Redis until it expires
 *  - Password reset: 6-digit OTP sent via email, stored in Redis (15 min TTL)
 *  - Login rate-limited: max 5 failed attempts per email per 15 min
 *
 * Email config: only EMAIL_USER and EMAIL_PASS are required in .env.
 * The service auto-detects Gmail / Outlook / Yahoo from the email domain.
 */
import { V4 } from 'paseto';
import { createPublicKey } from 'node:crypto';
import nodemailer from 'nodemailer';
import userModel from '../models/user.js';
import redisClient from '../config/redis.js';

const MAX_LOGIN_ATTEMPTS = 5;

// Token expiry in seconds (default 7 days)
function getExpirySeconds() {
  const raw = process.env.PASETO_EXPIRY || '7d';
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 3600;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 7 * 24 * 3600;
}

// ── PASETO key helpers ────────────────────────────────────────────────────────

/**
 * Load the Ed25519 private key from PASETO_SECRET_KEY (hex string).
 * Throws a clear error if the env var is missing or malformed.
 */
function getPrivateKey() {
  const hex = process.env.PASETO_SECRET_KEY;
  if (!hex) {
    throw new Error(
      'PASETO_SECRET_KEY is not set in .env\n' +
      '  Generate one with: node -e "const {generateKeyPairSync}=require(\'crypto\');' +
      'const {privateKey}=generateKeyPairSync(\'ed25519\');' +
      'console.log(privateKey.export({type:\'pkcs8\',format:\'der\'}).toString(\'hex\'))"'
    );
  }
  try {
    const keyBytes = Buffer.from(hex, 'hex');
    return V4.bytesToKeyObject(keyBytes, 'private');
  } catch {
    throw new Error('PASETO_SECRET_KEY is invalid. Re-generate it using the command in .env.example.');
  }
}

/**
 * Derive the Ed25519 public key from the private key.
 * Used for token verification.
 */
function getPublicKey(privateKey) {
  return createPublicKey(privateKey);
}

// ── Token sign / verify ───────────────────────────────────────────────────────

/**
 * Sign a PASETO v4.public token.
 * @param {object} payload  Claims to embed (userId, email, etc.)
 * @returns {Promise<string>} PASETO token string
 */
async function signToken(payload) {
  const privateKey = getPrivateKey();
  const expiresIn  = `${getExpirySeconds()}s`;
  return await V4.sign(payload, privateKey, { expiresIn });
}

/**
 * Verify a PASETO v4.public token and check it hasn't been blacklisted.
 * Returns the decoded payload or throws.
 * @param {string} token
 * @returns {Promise<object>} decoded payload
 */
async function verifyToken(token) {
  const privateKey = getPrivateKey();
  const publicKey  = getPublicKey(privateKey);

  let payload;
  try {
    payload = await V4.verify(token, publicKey);
  } catch (err) {
    throw new Error('Invalid or expired session token. Please log in again.');
  }

  const blacklisted = await redisClient.isTokenBlacklisted(token);
  if (blacklisted) throw new Error('Session has been revoked. Please log in again.');

  return payload;
}

/**
 * Decode a PASETO token without verifying the signature.
 * Used only for extracting the expiry on logout.
 * @param {string} token
 * @returns {{ exp?: string } | null}
 */
function decodeTokenUnsafe(token) {
  try {
    // PASETO v4.public format: v4.public.<base64url-payload>.<base64url-footer>
    const parts = token.split('.');
    if (parts.length < 3) return null;
    const raw = Buffer.from(parts[2], 'base64url').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Email transport ───────────────────────────────────────────────────────────

/**
 * Detect the nodemailer service name from an email address domain.
 * Falls back to a generic SMTP config for unknown domains.
 */
function detectService(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (domain === 'gmail.com')                                                  return 'gmail';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'hotmail';
  if (domain === 'yahoo.com'   || domain === 'yahoo.in')                       return 'yahoo';
  if (domain === 'icloud.com'  || domain === 'me.com')                         return 'iCloud';
  return null;
}

/**
 * Build a nodemailer transporter using only EMAIL_USER and EMAIL_PASS.
 */
function createTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in your .env file.'
    );
  }

  const service = detectService(user);

  if (service) {
    return nodemailer.createTransport({ service, auth: { user, pass } });
  }

  // Unknown domain — attempt generic SMTP on port 587
  const domain = user.split('@')[1];
  return nodemailer.createTransport({
    host:   `smtp.${domain}`,
    port:   587,
    secure: false,
    auth:   { user, pass },
  });
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = createTransport();
  const from = `FinanceBot <${process.env.EMAIL_USER}>`;
  await transporter.sendMail({ from, to, subject, text, html });
}

// ── OTP generator ─────────────────────────────────────────────────────────────

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── AuthService ───────────────────────────────────────────────────────────────

class AuthService {

  // ── Register ──────────────────────────────────────────────────────────────
  /**
   * Register a new user.
   * @param {{ name, email, password }} args
   * @returns {Promise<{ user, token }>}
   */
  async register({ name, email, password }) {
    const user  = await userModel.create({ name, email, password });
    const token = await signToken({ userId: String(user._id), email: user.email });
    return { user, token };
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  /**
   * Authenticate with email + password.
   * Enforces rate limiting: 5 failed attempts → 15-min lockout.
   * @param {{ email, password }} args
   * @returns {Promise<{ user, token }>}
   */
  async login({ email, password }) {
    if (!email?.trim()) throw new Error('Email is required.');
    if (!password)      throw new Error('Password is required.');

    const normalizedEmail = email.trim().toLowerCase();

    // Rate-limit check
    const attempts = await redisClient.getLoginAttempts(normalizedEmail);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error(
        'Too many failed login attempts. Please wait 15 minutes or reset your password.'
      );
    }

    const user = await userModel.verifyCredentials(normalizedEmail, password);
    if (!user) {
      await redisClient.incrementLoginAttempts(normalizedEmail);
      const remaining = MAX_LOGIN_ATTEMPTS - (attempts + 1);
      throw new Error(
        remaining > 0
          ? `Invalid email or password. ${remaining} attempt(s) remaining.`
          : 'Too many failed login attempts. Please wait 15 minutes or reset your password.'
      );
    }

    // Successful login — clear attempt counter
    await redisClient.clearLoginAttempts(normalizedEmail);

    const token = await signToken({ userId: String(user._id), email: user.email });
    return { user, token };
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  /**
   * Blacklist the current PASETO token so it can't be reused.
   * @param {string} token  The raw PASETO token string
   */
  async logout(token) {
    try {
      const payload = decodeTokenUnsafe(token);
      if (payload?.exp) {
        const expMs  = new Date(payload.exp).getTime();
        const ttl    = Math.floor((expMs - Date.now()) / 1000);
        if (ttl > 0) {
          await redisClient.blacklistToken(token, ttl);
        }
      }
    } catch {
      // If decode fails, ignore — token is already invalid
    }
  }

  // ── Verify session token ──────────────────────────────────────────────────
  /**
   * Verify a stored PASETO token and return the user.
   * @param {string} token
   * @returns {Promise<object>} user document (without passwordHash)
   */
  async verifySession(token) {
    const payload = await verifyToken(token);
    const user    = await userModel.findById(payload.userId);
    if (!user) throw new Error('User account not found.');
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  // ── Forgot password (send OTP) ────────────────────────────────────────────
  /**
   * Generate a 6-digit OTP, store it in Redis (15 min), and email it.
   * Always returns a generic message (don't reveal if email exists).
   * @param {string} email
   */
  async forgotPassword(email) {
    if (!email?.trim()) throw new Error('Email is required.');
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userModel.findByEmail(normalizedEmail);

    if (user) {
      const otp = generateOTP();
      await redisClient.setResetOTP(normalizedEmail, otp);

      await sendEmail({
        to:      normalizedEmail,
        subject: 'FinanceBot — Password Reset OTP',
        text:    `Your password reset OTP is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#0ea5e9">FinanceBot Password Reset</h2>
            <p>Your one-time password (OTP) is:</p>
            <div style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#0f172a;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">
              ${otp}
            </div>
            <p style="color:#64748b;font-size:0.9rem">This code expires in <strong>15 minutes</strong>.</p>
            <p style="color:#64748b;font-size:0.9rem">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    }

    return 'If that email is registered, a reset OTP has been sent.';
  }

  // ── Reset password (verify OTP + set new password) ────────────────────────
  /**
   * Verify the OTP and update the user's password.
   * @param {{ email, otp, newPassword }} args
   */
  async resetPassword({ email, otp, newPassword }) {
    if (!email?.trim())         throw new Error('Email is required.');
    if (!otp?.trim())           throw new Error('OTP is required.');
    if (!newPassword)           throw new Error('New password is required.');
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');

    const normalizedEmail = email.trim().toLowerCase();

    const storedOTP = await redisClient.getResetOTP(normalizedEmail);
    if (!storedOTP) {
      throw new Error('OTP has expired or was never requested. Please request a new one.');
    }
    if (storedOTP !== otp.trim()) {
      throw new Error('Invalid OTP. Please check the code sent to your email.');
    }

    const user = await userModel.findByEmail(normalizedEmail);
    if (!user) throw new Error('User not found.');

    await userModel.updatePassword(String(user._id), newPassword);
    await redisClient.deleteResetOTP(normalizedEmail);

    return '✅ Password reset successfully. You can now log in with your new password.';
  }
}

export default new AuthService();
