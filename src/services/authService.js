/**
 * AuthService — registration, login, logout, password reset, change password, delete account.
 *
 * Fix 2:  OTP uses crypto.randomInt (cryptographically secure).
 * Fix 5:  PASETO key pair cached at module load — not re-derived on every call.
 * Feature 4: register() and forgotPassword() are rate-limited (5/hour per email).
 */
import { V4 } from 'paseto';
import { createPublicKey, randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';
import userModel from '../models/user.js';
import expenseModel  from '../models/expense.js';
import incomeModel   from '../models/income.js';
import budgetModel   from '../models/budget.js';
import recurringModel from '../models/recurring.js';
import redisClient from '../config/redis.js';
import { clearSession } from '../utils/sessionStore.js';

const MAX_LOGIN_ATTEMPTS = 5;
const MAX_REG_ATTEMPTS   = 5;   // Feature 4
const MAX_OTP_ATTEMPTS   = 5;   // Feature 4

// ── Fix 5: Cache PASETO key pair at module load ───────────────────────────────
let _cachedPrivateKey = null;
let _cachedPublicKey  = null;

function loadKeyPair() {
  if (_cachedPrivateKey) return { privateKey: _cachedPrivateKey, publicKey: _cachedPublicKey };

  const hex = process.env.PASETO_SECRET_KEY;
  if (!hex) {
    throw new Error('PASETO_SECRET_KEY is not set in .env — see .env.example for the generation command.');
  }
  const keyBytes = Buffer.from(hex, 'hex');
  if (keyBytes.length !== 64) {
    throw new Error(`PASETO_SECRET_KEY must be 64 bytes (got ${keyBytes.length}). Re-generate it.`);
  }
  _cachedPrivateKey = V4.bytesToKeyObject(keyBytes, 'private');
  _cachedPublicKey  = createPublicKey(_cachedPrivateKey);
  return { privateKey: _cachedPrivateKey, publicKey: _cachedPublicKey };
}

// ── Token expiry ──────────────────────────────────────────────────────────────
function getExpirySeconds() {
  const raw   = process.env.PASETO_EXPIRY || '7d';
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 3600;
  const n    = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 7 * 24 * 3600;
}

// ── Token sign / verify ───────────────────────────────────────────────────────

async function signToken(payload) {
  const { privateKey } = loadKeyPair();
  return await V4.sign(payload, privateKey, { expiresIn: `${getExpirySeconds()}s` });
}

async function verifyToken(token) {
  const { publicKey } = loadKeyPair();
  let payload;
  try {
    payload = await V4.verify(token, publicKey);
  } catch {
    throw new Error('Invalid or expired session token. Please log in again.');
  }
  const blacklisted = await redisClient.isTokenBlacklisted(token);
  if (blacklisted) throw new Error('Session has been revoked. Please log in again.');
  return payload;
}

/**
 * Decode PASETO v4.public token without verifying signature.
 * Used only for extracting expiry on logout.
 * Payload = all bytes except last 64 (Ed25519 signature).
 */
function decodeTokenUnsafe(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v4' || parts[1] !== 'public') return null;
    const raw          = Buffer.from(parts[2], 'base64url');
    const payloadBytes = raw.slice(0, raw.length - 64);
    return JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return null;
  }
}

// ── Email transport ───────────────────────────────────────────────────────────

function detectService(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (domain === 'gmail.com')                                                        return 'gmail';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'hotmail';
  if (domain === 'yahoo.com'   || domain === 'yahoo.in')                             return 'yahoo';
  if (domain === 'icloud.com'  || domain === 'me.com')                               return 'iCloud';
  return null;
}

function createTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS in your .env file.');
  }
  const service = detectService(user);
  if (service) return nodemailer.createTransport({ service, auth: { user, pass } });
  const domain = user.split('@')[1];
  return nodemailer.createTransport({ host: `smtp.${domain}`, port: 587, secure: false, auth: { user, pass } });
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = createTransport();
  await transporter.sendMail({ from: `FinanceBot <${process.env.EMAIL_USER}>`, to, subject, text, html });
}

// ── Fix 2: Secure OTP using crypto.randomInt ──────────────────────────────────
function generateOTP() {
  return String(randomInt(100000, 1000000)); // cryptographically secure
}

// ── AuthService ───────────────────────────────────────────────────────────────

class AuthService {

  // ── Register ──────────────────────────────────────────────────────────────
  async register({ name, email, password }) {
    const normalizedEmail = email?.trim().toLowerCase() ?? '';

    // Feature 4: rate-limit registrations per email
    const regKey      = `reg_attempts:${normalizedEmail}`;
    const regAttempts = await redisClient.incr(regKey, 3600);
    if (regAttempts > MAX_REG_ATTEMPTS) {
      throw new Error('Too many registration attempts for this email. Please try again in 1 hour.');
    }

    const user  = await userModel.create({ name, email, password });
    const token = await signToken({ userId: String(user._id), email: user.email });
    return { user, token };
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login({ email, password }) {
    if (!email?.trim()) throw new Error('Email is required.');
    if (!password)      throw new Error('Password is required.');

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await userModel.findByEmail(normalizedEmail);
    if (!exists) {
      throw new Error(`No account found for "${normalizedEmail}". Please register first (choose option 2).`);
    }

    const attempts = await redisClient.getLoginAttempts(normalizedEmail);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error('Too many failed login attempts. Please wait 15 minutes or reset your password (option 3).');
    }

    const user = await userModel.verifyCredentials(normalizedEmail, password);
    if (!user) {
      await redisClient.incrementLoginAttempts(normalizedEmail);
      const remaining = MAX_LOGIN_ATTEMPTS - (attempts + 1);
      throw new Error(
        remaining > 0
          ? `Wrong password. ${remaining} attempt(s) remaining before lockout.`
          : 'Too many failed login attempts. Please wait 15 minutes or reset your password (option 3).'
      );
    }

    await redisClient.clearLoginAttempts(normalizedEmail);
    const token = await signToken({ userId: String(user._id), email: user.email });
    return { user, token };
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(token) {
    try {
      const payload = decodeTokenUnsafe(token);
      if (payload?.exp) {
        const ttl = Math.floor((new Date(payload.exp).getTime() - Date.now()) / 1000);
        if (ttl > 0) await redisClient.blacklistToken(token, ttl);
      }
    } catch { /* ignore */ }
  }

  // ── Verify session ────────────────────────────────────────────────────────
  async verifySession(token) {
    const payload = await verifyToken(token);
    const user    = await userModel.findById(payload.userId);
    if (!user) throw new Error('User account not found.');
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async forgotPassword(email) {
    if (!email?.trim()) throw new Error('Email is required.');
    const normalizedEmail = email.trim().toLowerCase();

    // Feature 4: rate-limit OTP requests per email
    const otpKey      = `otp_req:${normalizedEmail}`;
    const otpAttempts = await redisClient.incr(otpKey, 3600);
    if (otpAttempts > MAX_OTP_ATTEMPTS) {
      throw new Error('Too many password reset requests. Please try again in 1 hour.');
    }

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
          </div>`,
      });
    }
    return 'If that email is registered, a reset OTP has been sent.';
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async resetPassword({ email, otp, newPassword }) {
    if (!email?.trim())         throw new Error('Email is required.');
    if (!otp?.trim())           throw new Error('OTP is required.');
    if (!newPassword)           throw new Error('New password is required.');
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');

    const normalizedEmail = email.trim().toLowerCase();
    const storedOTP       = await redisClient.getResetOTP(normalizedEmail);
    if (!storedOTP)             throw new Error('OTP has expired or was never requested. Please request a new one.');
    if (storedOTP !== otp.trim()) throw new Error('Invalid OTP. Please check the code sent to your email.');

    const user = await userModel.findByEmail(normalizedEmail);
    if (!user) throw new Error('User not found.');

    await userModel.updatePassword(String(user._id), newPassword);
    await redisClient.deleteResetOTP(normalizedEmail);
    return '✅ Password reset successfully. You can now log in with your new password.';
  }

  // ── Change password (Feature 2) ───────────────────────────────────────────
  async changePassword({ userId, currentPassword, newPassword, token }) {
    await userModel.changePassword(userId, currentPassword, newPassword);
    // Invalidate current session so user must log in again
    await this.logout(token);
    await clearSession();
    return '✅ Password changed successfully. Please log in again with your new password.';
  }

  // ── Delete account (Feature 3) ────────────────────────────────────────────
  async deleteAccount({ userId, confirmationPhrase, token }) {
    if (confirmationPhrase !== 'DELETE MY ACCOUNT') {
      throw new Error('Confirmation phrase must be exactly: DELETE MY ACCOUNT');
    }
    // Delete all user data
    await Promise.all([
      expenseModel.deleteAllByUser(userId),
      incomeModel.deleteAllByUser(userId),
      budgetModel.deleteAllByUser(userId),
      recurringModel.deleteAllByUser(userId),
    ]);
    await userModel.deleteUser(userId);
    // Blacklist token and clear session
    await this.logout(token);
    await clearSession();
    return '✅ Account and all associated data permanently deleted.';
  }
}

export default new AuthService();
