/**
 * User model.
 * Fix 3: Email format validated with regex before saving.
 * Feature 2 & 3: changePassword and deleteUser methods added.
 */
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import dbConnection from '../config/database.js';
import { validateEmail } from '../utils/validators.js';

const SALT_ROUNDS = 12;

class UserModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('users');
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async create({ name, email, password }) {
    if (!name?.trim())  throw new Error('Name is required.');
    if (password?.length < 8) throw new Error('Password must be at least 8 characters.');

    // Fix 3: validate email format
    const normalizedEmail = validateEmail(email);

    const existing = await this.collection.findOne({ email: normalizedEmail });
    if (existing) throw new Error(`An account with email "${normalizedEmail}" already exists.`);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const doc = {
      name:         name.trim(),
      email:        normalizedEmail,
      passwordHash,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    };

    const result = await this.collection.insertOne(doc);
    const { passwordHash: _ph, ...safe } = doc;
    return { ...safe, _id: result.insertedId };
  }

  // ── Find by email ─────────────────────────────────────────────────────────
  async findByEmail(email) {
    if (!email) return null;
    return await this.collection.findOne({ email: email.trim().toLowerCase() });
  }

  // ── Find by ID ────────────────────────────────────────────────────────────
  async findById(id) {
    if (!id || !/^[a-f\d]{24}$/i.test(id)) return null;
    return await this.collection.findOne({ _id: new ObjectId(id) });
  }

  // ── Verify password ───────────────────────────────────────────────────────
  async verifyCredentials(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  // ── Update password (used by forgotPassword reset flow) ───────────────────
  async updatePassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { passwordHash, updatedAt: new Date() } }
    );
  }

  // ── Change password (Feature 2: verify current, set new) ─────────────────
  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword) throw new Error('Current password is required.');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    const user = await this.collection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error('User not found.');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new Error('Current password is incorrect.');

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from the current password.');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { passwordHash, updatedAt: new Date() } }
    );
  }

  // ── Delete user (Feature 3) ───────────────────────────────────────────────
  async deleteUser(userId) {
    if (!userId) throw new Error('userId is required.');
    await this.collection.deleteOne({ _id: new ObjectId(userId) });
  }
}

export default new UserModel();
